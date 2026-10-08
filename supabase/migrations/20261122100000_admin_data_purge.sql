-- Admin-only lifecycle deletion. Financial rows and their minimal parent references survive.
alter table public.events add column purged_at timestamptz;
alter table public.organizations add column purged_at timestamptz;
create index vote_batches_event_purge on public.vote_batches(event_id,id) where payment_attempt_id is null;

create table public.admin_deletion_jobs (
 id uuid primary key default gen_random_uuid(),
 target_kind text not null check(target_kind in ('event','organization')),
 target_id uuid not null, target_name text not null,
 requested_by uuid references auth.users(id) on delete set null,
 reason text not null check(char_length(btrim(reason)) between 20 and 1000),
 status text not null default 'pending' check(status in ('pending','completed','cancelled')),
 scheduled_for timestamptz not null, created_at timestamptz not null default now(),
 completed_at timestamptz, cancelled_at timestamptz,
 attempts integer not null default 0, last_attempt_at timestamptz,
 next_attempt_at timestamptz not null default now(), last_error text, result jsonb
);
create unique index admin_deletion_one_pending on public.admin_deletion_jobs(target_kind,target_id) where status='pending';
create index admin_deletion_due on public.admin_deletion_jobs(scheduled_for,next_attempt_at) where status='pending';
alter table public.admin_deletion_jobs enable row level security;
revoke all on public.admin_deletion_jobs from public,anon,authenticated;
grant select on public.admin_deletion_jobs to authenticated;
grant all on public.admin_deletion_jobs to service_role;
create policy deletion_jobs_admin_read on public.admin_deletion_jobs for select to authenticated using(private.is_platform_admin());

-- Transaction-local authorization cannot be forged through a client-set configuration value.
create table private.admin_purge_context(transaction_id bigint primary key);
revoke all on private.admin_purge_context from public,anon,authenticated,service_role;
create function private.purge_is_authorized() returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from private.admin_purge_context where transaction_id=txid_current());
$$;
revoke all on function private.purge_is_authorized() from public,anon,authenticated,service_role;

-- Free-vote details can expire through the purge worker; paid votes, ledger and audit stay immutable.
create or replace function private.reject_immutable_row_change() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='vote_batches' and tg_op='DELETE' and old.payment_attempt_id is null and private.purge_is_authorized() then return old; end if;
 raise exception 'This record is immutable' using errcode='55000';
end $$;
alter function private.guard_organization_content() rename to guard_organization_content_before_purge;
create function private.guard_organization_content() returns trigger language plpgsql security definer set search_path='' as $$
declare org_id uuid; event_id uuid; row_data jsonb;
begin
 if private.purge_is_authorized() then if tg_op='DELETE' then return old; else return new; end if; end if;
 if tg_op='DELETE' then row_data:=to_jsonb(old); else row_data:=to_jsonb(new); end if;
 if tg_table_name='events' then event_id:=(row_data->>'id')::uuid; org_id:=(row_data->>'organization_id')::uuid;
 elsif tg_table_name='nominees' then select c.event_id,e.organization_id into event_id,org_id from public.categories c join public.events e on e.id=c.event_id where c.id=(row_data->>'category_id')::uuid;
 elsif row_data ? 'event_id' then event_id:=(row_data->>'event_id')::uuid; select organization_id into org_id from public.events where id=event_id;
 else org_id:=(row_data->>'organization_id')::uuid; end if;
 if exists(select 1 from public.admin_deletion_jobs j where j.status='pending' and ((j.target_kind='event' and j.target_id=event_id) or (j.target_kind='organization' and j.target_id=org_id)))
 or exists(select 1 from public.events e where e.id=event_id and e.purged_at is not null) then
  raise exception 'This workspace or event is scheduled for deletion or already purged' using errcode='42501';
 end if;
 if auth.uid() is null or (private.is_platform_admin() and tg_table_name='organization_invitations' and tg_op='UPDATE' and to_jsonb(new)->>'status'='revoked') then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 perform private.require_active_organization(org_id);
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
-- Renaming a trigger function does not repoint the existing triggers.
do $$ declare t text; begin
 foreach t in array array['events','categories','nominees','organization_invitations','organization_members','event_voter_list_entries','event_access_codes'] loop
  execute format('drop trigger organization_content_guard on public.%I',t);
  execute format('create trigger organization_content_guard before insert or update or delete on public.%I for each row execute function private.guard_organization_content()',t);
 end loop;
end $$;
revoke all on function private.guard_organization_content(),private.guard_organization_content_before_purge() from public,anon,authenticated,service_role;

create function private.deletion_blocker(p_kind text,p_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare org_id uuid;
begin
 if p_kind='organization' then return private.organization_closure_blocker(p_id); end if;
 select organization_id into org_id from public.events where id=p_id;
 if exists(select 1 from public.payment_attempts where event_id=p_id and status in ('created','pending')) then return 'Resolve pending event payments first'; end if;
 if exists(select 1 from public.payout_requests where organization_id=org_id and status in ('requested','approved','processing')) then return 'Resolve outstanding organization payouts first'; end if;
 if exists(select 1 from public.payment_account_operations where organization_id=org_id) then return 'Resolve the payment account operation first'; end if;
 return null;
end $$;

create function private.deletion_preview(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org_id uuid; target_name text; target_status text; purged timestamptz; financial boolean; immediate boolean; result jsonb; job jsonb;
begin
 if p_kind='event' then
  select organization_id,name,status,purged_at into org_id,target_name,target_status,purged from public.events where id=p_id;
 elsif p_kind='organization' then
  select id,name,moderation_status,purged_at into org_id,target_name,target_status,purged from public.organizations where id=p_id;
 else raise exception 'Invalid deletion target' using errcode='22023'; end if;
 if not found then raise exception 'Deletion target not found' using errcode='P0002'; end if;
 financial:=exists(select 1 from public.payment_attempts where (p_kind='event' and event_id=p_id) or (p_kind='organization' and organization_id=p_id))
  or exists(select 1 from public.paid_vote_ledger where (p_kind='event' and event_id=p_id) or (p_kind='organization' and organization_id=p_id));
 if p_kind='organization' then financial:=financial or exists(select 1 from public.ledger_entries where organization_id=p_id)
  or exists(select 1 from public.payout_requests where organization_id=p_id) or exists(select 1 from public.sms_credit_purchases where organization_id=p_id)
  or exists(select 1 from public.sms_credit_usage where organization_id=p_id) or exists(select 1 from public.payment_account_history where organization_id=p_id)
  or exists(select 1 from public.organization_paystack_accounts where organization_id=p_id); end if;
 immediate:=not financial and case when p_kind='event' then target_status='draft' and not exists(select 1 from public.vote_batches where event_id=p_id)
  else not exists(select 1 from public.events where organization_id=p_id) end;
 select to_jsonb(j) into job from public.admin_deletion_jobs j where target_kind=p_kind and target_id=p_id and status='pending';
 result:=jsonb_build_object('name',target_name,'status',target_status,'purged_at',purged,'financial_history',financial,'immediate',immediate,
  'blocker',private.deletion_blocker(p_kind,p_id),'job',job,'cancellable',case when job is not null then (job->>'scheduled_for')::timestamptz>now() else false end,
  'retained_reference',financial or (p_kind='organization' and exists(select 1 from public.audit_logs where organization_id=p_id)),
  'counts',jsonb_build_object(
   'events',(select count(*) from public.events where (p_kind='event' and id=p_id) or (p_kind='organization' and organization_id=p_id)),
   'categories',(select count(*) from public.categories c join public.events e on e.id=c.event_id where (p_kind='event' and e.id=p_id) or (p_kind='organization' and e.organization_id=p_id)),
   'nominees',(select count(*) from public.nominees n join public.categories c on c.id=n.category_id join public.events e on e.id=c.event_id where (p_kind='event' and e.id=p_id) or (p_kind='organization' and e.organization_id=p_id)),
   'free_vote_batches',(select count(*) from public.vote_batches v join public.events e on e.id=v.event_id where v.payment_attempt_id is null and ((p_kind='event' and e.id=p_id) or (p_kind='organization' and e.organization_id=p_id))),
   'roster_entries',(select count(*) from public.event_voter_list_entries v join public.events e on e.id=v.event_id where (p_kind='event' and e.id=p_id) or (p_kind='organization' and e.organization_id=p_id)),
   'access_codes',(select count(*) from public.event_access_codes c join public.events e on e.id=c.event_id where (p_kind='event' and e.id=p_id) or (p_kind='organization' and e.organization_id=p_id)),
   'images',(select count(*) from storage.objects s where bucket_id='nominee-images' and exists(select 1 from public.events e where e.id::text=split_part(s.name,'/',1) and ((p_kind='event' and e.id=p_id) or (p_kind='organization' and e.organization_id=p_id)))),
   'members',case when p_kind='organization' then (select count(*) from public.organization_members where organization_id=p_id) else 0 end));
 return result;
end $$;
create function public.get_admin_deletion_preview(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform admin access required' using errcode='42501'; end if;
 return private.deletion_preview(p_kind,p_id);
end $$;

create function private.purge_event(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare keep_reference boolean;
begin
 if not private.purge_is_authorized() then raise exception 'Purge authorization required' using errcode='42501'; end if;
 keep_reference:=exists(select 1 from public.payment_attempts where event_id=p_id) or exists(select 1 from public.paid_vote_ledger where event_id=p_id);
 insert into public.event_image_cleanup(path) select name from storage.objects where bucket_id='nominee-images' and split_part(name,'/',1)=p_id::text on conflict do nothing;
 delete from public.vote_batches where id in(select id from public.vote_batches where event_id=p_id and payment_attempt_id is null order by id limit 5000);
 delete from public.event_access_code_redemptions where id in(select r.id from public.event_access_code_redemptions r join public.event_access_codes c on c.id=r.access_code_id where c.event_id=p_id limit 5000);
 delete from public.event_access_codes where id in(select c.id from public.event_access_codes c where c.event_id=p_id and not exists(select 1 from public.event_access_code_redemptions r where r.access_code_id=c.id) order by c.id limit 100);
 delete from public.event_voter_list_entries where id in(select id from public.event_voter_list_entries where event_id=p_id order by id limit 5000);
 delete from public.ussd_sessions where session_id in(select session_id from public.ussd_sessions where event_id=p_id limit 5000);
 delete from public.event_analytics_daily where ctid in(select ctid from public.event_analytics_daily where event_id=p_id limit 5000);
 delete from private.event_analytics_visitors where ctid in(select ctid from private.event_analytics_visitors where event_id=p_id limit 5000);
 delete from public.event_correction_requests where id in(select id from public.event_correction_requests where event_id=p_id limit 5000);
 delete from public.event_notices where id in(select id from public.event_notices where event_id=p_id limit 5000);
 delete from public.moderation_flags where id in(select id from public.moderation_flags where event_id=p_id limit 5000);
 if exists(select 1 from public.vote_batches where event_id=p_id and payment_attempt_id is null)
 or exists(select 1 from public.event_access_codes where event_id=p_id)
 or exists(select 1 from public.event_voter_list_entries where event_id=p_id)
 or exists(select 1 from public.ussd_sessions where event_id=p_id)
 or exists(select 1 from public.event_analytics_daily where event_id=p_id)
 or exists(select 1 from private.event_analytics_visitors where event_id=p_id)
 or exists(select 1 from public.event_correction_requests where event_id=p_id)
 or exists(select 1 from public.event_notices where event_id=p_id)
 or exists(select 1 from public.moderation_flags where event_id=p_id) then return null; end if;
 -- Remove even the unreferenced nominees/categories from an event with financial history.
 delete from public.nominees n where category_id in(select id from public.categories where event_id=p_id)
  and not exists(select 1 from public.payment_attempts p where p.nominee_id=n.id)
  and not exists(select 1 from public.vote_batches v where v.nominee_id=n.id);
 delete from public.categories c where event_id=p_id and not exists(select 1 from public.nominees n where n.category_id=c.id)
  and not exists(select 1 from public.payment_attempts p where p.category_id=c.id);
 if keep_reference then
  update public.nominees set biography=null,image_path=null,public_code=null,is_active=false where category_id in(select id from public.categories where event_id=p_id);
  update public.categories set description=null,is_active=false where event_id=p_id;
  update public.events set description=null,voting_rules=null,image_path=null,status='archived',archived_at=coalesce(archived_at,now()),results_visibility='hidden',purged_at=now() where id=p_id;
 else delete from public.events where id=p_id; end if;
 return keep_reference;
end $$;

create function private.execute_admin_purge(p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.admin_deletion_jobs; org_id uuid; event_id uuid; blocker text; keep_reference boolean:=false; retained_events integer:=0; summary jsonb; event_finished boolean;
begin
 select * into j from public.admin_deletion_jobs where id=p_job for update;
 if not found or j.status<>'pending' then raise exception 'Pending deletion not found' using errcode='P0002'; end if;
 if j.scheduled_for>now() then raise exception 'Deletion grace period has not ended' using errcode='22023'; end if;
 if j.target_kind='event' then select organization_id into org_id from public.events where id=j.target_id; else org_id:=j.target_id; end if;
 perform 1 from public.organizations where id=org_id for update;
 if j.target_kind='event' then perform 1 from public.events where id=j.target_id for update; end if;
 blocker:=private.deletion_blocker(j.target_kind,j.target_id);
 if blocker is not null then raise exception '%',blocker using errcode='22023'; end if;
 insert into private.admin_purge_context values(txid_current()) on conflict do nothing;
 if j.target_kind='event' then
  keep_reference:=private.purge_event(j.target_id);
  if keep_reference is null then
   delete from private.admin_purge_context where transaction_id=txid_current();
   update public.admin_deletion_jobs set last_error=null,next_attempt_at=now() where id=j.id;
   return jsonb_build_object('pending',true);
  end if;
 else
  for event_id in select id from public.events where organization_id=org_id and purged_at is null order by id limit 2 for update loop
   event_finished:=private.purge_event(event_id);
  end loop;
  if exists(select 1 from public.events where organization_id=org_id and purged_at is null) then
   delete from private.admin_purge_context where transaction_id=txid_current();
   update public.admin_deletion_jobs set last_error=null,next_attempt_at=now() where id=j.id;
   return jsonb_build_object('pending',true);
  end if;
  select count(*) into retained_events from public.events where organization_id=org_id;
  delete from public.organization_invitations where organization_id=org_id;
  delete from public.organization_members where organization_id=org_id;
  delete from public.organization_closure_requests where organization_id=org_id;
  delete from public.notifications where organization_id=org_id;
  delete from public.moderation_flags where organization_id=org_id;
  delete from public.sms_sponsorships where organization_id=org_id;
  delete from public.paystack_account_requests where organization_id=org_id;
  -- Financial account and SMS balance/history remain available for reconciliation.
  keep_reference:=retained_events>0 or exists(select 1 from public.audit_logs where organization_id=org_id)
   or exists(select 1 from public.ledger_entries where organization_id=org_id) or exists(select 1 from public.payout_requests where organization_id=org_id)
   or exists(select 1 from public.sms_credit_purchases where organization_id=org_id) or exists(select 1 from public.sms_credit_usage where organization_id=org_id)
   or exists(select 1 from public.payment_account_history where organization_id=org_id) or exists(select 1 from public.organization_paystack_accounts where organization_id=org_id);
  if keep_reference then update public.organizations set purged_at=now(),moderation_status='closed',archived_at=coalesce(archived_at,now()),created_by=null where id=org_id;
  else delete from public.organizations where id=org_id; end if;
 end if;
 delete from private.admin_purge_context where transaction_id=txid_current();
 summary:=jsonb_build_object('retained_reference',keep_reference,'retained_events',retained_events,'images_queued',true);
 update public.admin_deletion_jobs set status='completed',completed_at=now(),result=summary,last_error=null where id=j.id;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(j.requested_by,'data_purged',j.target_kind,j.target_id,j.reason);
 return summary;
end $$;

create function public.admin_request_deletion(p_kind text,p_id uuid,p_confirmation_name text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare preview jsonb; org_id uuid; job_id uuid; due_at timestamptz; result jsonb;
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active and role='admin') then raise exception 'Only platform administrators can delete data' using errcode='42501'; end if;
 if p_kind='event' then select organization_id into org_id from public.events where id=p_id; elsif p_kind='organization' then org_id:=p_id; else raise exception 'Invalid deletion target' using errcode='22023'; end if;
 -- Serialize with financial activity, organization closure and other deletion requests.
 perform 1 from public.organizations where id=org_id for update;
 if p_kind='event' then perform 1 from public.events where id=p_id for update; end if;
 preview:=private.deletion_preview(p_kind,p_id);
 if preview->>'purged_at' is not null then raise exception 'This item is already purged' using errcode='22023'; end if;
 if p_confirmation_name is distinct from preview->>'name' then raise exception 'Type the exact name to confirm deletion' using errcode='22023'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 20 and 1000 then raise exception 'Provide a deletion reason of 20 to 1000 characters' using errcode='22023'; end if;
 if preview->>'blocker' is not null then raise exception '%',preview->>'blocker' using errcode='22023'; end if;
 if preview->'job'<>'null'::jsonb then raise exception 'Deletion is already scheduled' using errcode='23505'; end if;
 if p_kind='event' and exists(select 1 from public.admin_deletion_jobs where target_kind='organization' and target_id=org_id and status='pending') then raise exception 'The organization is already scheduled for deletion' using errcode='22023'; end if;
 if p_kind='organization' and exists(select 1 from public.admin_deletion_jobs j join public.events e on e.id=j.target_id where j.target_kind='event' and j.status='pending' and e.organization_id=org_id) then raise exception 'Cancel pending event deletions before deleting the organization' using errcode='22023'; end if;
 due_at:=case when (preview->>'immediate')::boolean then now() else now()+interval '30 days' end;
 insert into private.admin_purge_context values(txid_current()) on conflict do nothing;
 if p_kind='event' then update public.events set status='archived',archived_at=now(),results_visibility='hidden' where id=p_id;
 elsif (preview->>'immediate')::boolean then
  update public.organizations set moderation_status='closed',archived_at=coalesce(archived_at,now()),closed_by=auth.uid(),closure_reason=btrim(p_reason) where id=p_id;
 elsif preview->>'status'<>'closed' then perform public.admin_close_organization(p_id,p_confirmation_name,p_reason,null); end if;
 delete from private.admin_purge_context where transaction_id=txid_current();
 insert into public.admin_deletion_jobs(target_kind,target_id,target_name,requested_by,reason,scheduled_for)
 values(p_kind,p_id,preview->>'name',auth.uid(),btrim(p_reason),due_at) returning id into job_id;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(auth.uid(),'deletion_requested',p_kind,p_id,btrim(p_reason));
 if (preview->>'immediate')::boolean then result:=private.execute_admin_purge(job_id); else result:=null; end if;
 return jsonb_build_object('id',job_id,'scheduled_for',due_at,'immediate',(preview->>'immediate')::boolean,'result',result);
end $$;

create function public.admin_cancel_deletion(p_job uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare j public.admin_deletion_jobs;
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active and role='admin') then raise exception 'Only platform administrators can cancel deletion' using errcode='42501'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Provide a cancellation reason' using errcode='22023'; end if;
 select * into j from public.admin_deletion_jobs where id=p_job for update;
 if not found or j.status<>'pending' then raise exception 'Pending deletion not found' using errcode='P0002'; end if;
 if j.scheduled_for<=now() then raise exception 'The deletion grace period has ended; cancellation is no longer available' using errcode='22023'; end if;
 update public.admin_deletion_jobs set status='cancelled',cancelled_at=now() where id=p_job;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(auth.uid(),'deletion_cancelled',j.target_kind,j.target_id,btrim(p_reason));
 -- Cancellation never republishes an event or reactivates a permanently closed organization.
end $$;

create function public.process_admin_deletions(p_limit integer default 2) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.admin_deletion_jobs; completed integer:=0; failed integer:=0; progressing integer:=0; outcome jsonb;
begin
 for j in select * from public.admin_deletion_jobs where status='pending' and scheduled_for<=now() and next_attempt_at<=now() order by scheduled_for,id limit least(greatest(coalesce(p_limit,2),1),5) for update skip locked loop
  update public.admin_deletion_jobs set attempts=attempts+1,last_attempt_at=now() where id=j.id;
  begin
   outcome:=private.execute_admin_purge(j.id);
   if coalesce((outcome->>'pending')::boolean,false) then progressing:=progressing+1; else completed:=completed+1; end if;
  exception when others then
   update public.admin_deletion_jobs set last_error=left(sqlerrm,500),next_attempt_at=now()+interval '1 day' where id=j.id;
   failed:=failed+1;
  end;
 end loop;
 return jsonb_build_object('completed',completed,'failed',failed,'progressing',progressing);
end $$;
revoke all on function private.deletion_blocker(text,uuid),private.deletion_preview(text,uuid),private.purge_event(uuid),private.execute_admin_purge(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_admin_deletion_preview(text,uuid),public.admin_request_deletion(text,uuid,text,text),public.admin_cancel_deletion(uuid,text) from public,anon;
grant execute on function public.get_admin_deletion_preview(text,uuid),public.admin_request_deletion(text,uuid,text,text),public.admin_cancel_deletion(uuid,text) to authenticated;
revoke all on function public.process_admin_deletions(integer) from public,anon,authenticated;
grant execute on function public.process_admin_deletions(integer) to service_role;

-- Expired sessions and deduplication details have no ongoing accounting purpose.
-- Keep daily analytics totals; expire individual visitor hashes after 30 days.
create function public.cleanup_expired_operational_data() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.ussd_sessions where session_id in(select session_id from public.ussd_sessions where expires_at<now()-interval '1 day' limit 5000);
 delete from public.payment_rate_limits where bucket in(select bucket from public.payment_rate_limits where expires_at<now()-interval '1 day' limit 5000);
 delete from private.event_analytics_visitors where ctid in(select ctid from private.event_analytics_visitors where day<current_date-30 limit 5000);
end $$;
revoke all on function public.cleanup_expired_operational_data() from public,anon,authenticated;
grant execute on function public.cleanup_expired_operational_data() to service_role;

create function public.get_admin_deletion_snapshot(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare preview jsonb; snapshot jsonb;
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active and role='admin') then raise exception 'Only platform administrators can export deletion snapshots' using errcode='42501'; end if;
 preview:=private.deletion_preview(p_kind,p_id);
 with scoped_events as (select * from public.events where (p_kind='event' and id=p_id) or (p_kind='organization' and organization_id=p_id)),
 standings as (
  select e.id event_id,e.name event_name,c.id category_id,c.name category_name,n.id nominee_id,n.name nominee_name,
   coalesce(sum(case when b.payment_attempt_id is null then b.quantity
    else greatest(0,p.quantity-ceil(coalesce(l.refunded_amount_minor,0)::numeric/p.unit_price_minor)) end),0)::bigint counted_votes
  from scoped_events e join public.categories c on c.event_id=e.id join public.nominees n on n.category_id=c.id
  left join public.vote_batches b on b.nominee_id=n.id and b.reversed_at is null
  left join public.payment_attempts p on p.id=b.payment_attempt_id
  left join public.paid_vote_ledger l on l.reference=p.provider_reference
  group by e.id,e.name,c.id,c.name,n.id,n.name
 )
 select jsonb_build_object('exported_at',now(),'target_kind',p_kind,'target_id',p_id,'preview',preview,
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from scoped_events e),'[]'::jsonb),
  'standings',coalesce((select jsonb_agg(to_jsonb(s) order by s.event_id,s.category_id,s.counted_votes desc,s.nominee_id) from standings s),'[]'::jsonb),
  'note','Results snapshot only. Financial history is retained in the platform. Uploaded image files and individual voter identities are not included.') into snapshot;
 return snapshot;
end $$;
revoke all on function public.get_admin_deletion_snapshot(text,uuid) from public,anon;
grant execute on function public.get_admin_deletion_snapshot(text,uuid) to authenticated;
