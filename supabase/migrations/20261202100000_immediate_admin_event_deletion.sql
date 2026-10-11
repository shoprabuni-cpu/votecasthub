-- Event removal is immediate; pending money stays reconcilable. Organization rules are unchanged.
create or replace function private.deletion_blocker(p_kind text,p_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
begin
 if p_kind='organization' then return private.organization_closure_blocker(p_id); end if;
 return null;
end $$;

create or replace function private.deletion_preview(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 immediate:=case when p_kind='event' then true
  else not financial and not exists(select 1 from public.events where organization_id=p_id) end;
 select to_jsonb(j) into job from public.admin_deletion_jobs j where target_kind=p_kind and target_id=p_id and status='pending';
 result:=jsonb_build_object('name',target_name,'status',target_status,'purged_at',purged,'financial_history',financial,'immediate',immediate,
  'blocker',private.deletion_blocker(p_kind,p_id),'job',job,'cancellable',case when p_kind='organization' and job is not null then (job->>'scheduled_for')::timestamptz>now() else false end,
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

create or replace function private.purge_event(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare keep_reference boolean;
begin
 if not private.purge_is_authorized() then raise exception 'Purge authorization required' using errcode='42501'; end if;
 keep_reference:=exists(select 1 from public.payment_attempts where event_id=p_id) or exists(select 1 from public.paid_vote_ledger where event_id=p_id);
 insert into public.event_image_cleanup(path) select name from storage.objects where bucket_id='nominee-images' and split_part(name,'/',1)=p_id::text on conflict do nothing;
 delete from public.event_review_messages where id in(select id from public.event_review_messages where event_id=p_id limit 5000);
 delete from public.notification_email_jobs where id in(select id from public.notification_email_jobs where event_id=p_id limit 5000);
 delete from public.notifications where id in(select id from public.notifications where event_id=p_id limit 5000);
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
 if exists(select 1 from public.event_review_messages where event_id=p_id)
 or exists(select 1 from public.notification_email_jobs where event_id=p_id)
 or exists(select 1 from public.notifications where event_id=p_id) then return null; end if;
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

create or replace function public.admin_request_deletion(p_kind text,p_id uuid,p_confirmation_name text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if p_kind='event' then update public.events set status='archived',archived_at=coalesce(archived_at,now()),purged_at=now(),description=null,voting_rules=null,image_path=null,voter_help_email=null,results_visibility='hidden' where id=p_id;
 elsif (preview->>'immediate')::boolean then
  update public.organizations set moderation_status='closed',archived_at=coalesce(archived_at,now()),closed_by=auth.uid(),closure_reason=btrim(p_reason) where id=p_id;
 elsif preview->>'status'<>'closed' then perform public.admin_close_organization(p_id,p_confirmation_name,p_reason,null); end if;
 delete from private.admin_purge_context where transaction_id=txid_current();
 insert into public.admin_deletion_jobs(target_kind,target_id,target_name,requested_by,reason,scheduled_for)
 values(p_kind,p_id,preview->>'name',auth.uid(),btrim(p_reason),due_at) returning id into job_id;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(auth.uid(),'deletion_requested',p_kind,p_id,btrim(p_reason));
 if p_kind='event' then result:=jsonb_build_object('cleanup_pending',true);
 elsif (preview->>'immediate')::boolean then result:=private.execute_admin_purge(job_id); else result:=null; end if;
 return jsonb_build_object('id',job_id,'scheduled_for',due_at,'immediate',(preview->>'immediate')::boolean,'result',result);
end $$;

create or replace function public.get_admin_events(p_search text default null)
returns table(id uuid,name text,status text,voting_mode text,organization_name text,starts_at timestamptz,ends_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$ select e.id,e.name,e.status,e.voting_mode,o.name,e.starts_at,e.ends_at,e.created_at from public.events e join public.organizations o on o.id=e.organization_id where e.purged_at is null and exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.is_active) and (p_search is null or e.name ilike '%'||p_search||'%' or o.name ilike '%'||p_search||'%') order by e.created_at desc limit 100; $$;
-- Previously scheduled event deletions also become effective immediately.
do $$ begin
 insert into private.admin_purge_context values(txid_current()) on conflict do nothing;
 update public.events e set status='archived',archived_at=coalesce(e.archived_at,now()),purged_at=coalesce(e.purged_at,now()),description=null,voting_rules=null,image_path=null,voter_help_email=null,results_visibility='hidden'
 where exists(select 1 from public.admin_deletion_jobs j where j.target_kind='event' and j.target_id=e.id and j.status='pending');
 update public.admin_deletion_jobs set scheduled_for=now(),next_attempt_at=now(),last_error=null where target_kind='event' and status='pending';
 delete from private.admin_purge_context where transaction_id=txid_current();
end $$;

-- Exclude deleted event references from workspace lists and counts.
create or replace function public.get_admin_overview()
returns table(organizers bigint,events bigint,published_events bigint,pending_corrections bigint,successful_payments bigint,gross_minor bigint,refunded_minor bigint)
language sql stable security definer set search_path='' as $$ select (select count(*) from public.organizations),(select count(*) from public.events where purged_at is null),(select count(*) from public.events where status in ('published','paused')),(select count(*) from public.event_correction_requests where status='pending'),(select count(*) from public.payment_attempts where status='succeeded'),(select coalesce(sum(gross_amount_minor),0) from public.paid_vote_ledger where status in ('confirmed','refunded','reversed')),(select coalesce(sum(refunded_amount_minor),0) from public.paid_vote_ledger); $$;
create or replace function public.get_admin_organizations() returns table(id uuid,name text,moderation_status text,event_count bigint,paystack_status text,paystack_verified boolean) language sql stable security definer set search_path='' as $$ select o.id,o.name,o.moderation_status,count(e.id),coalesce(a.status,'not_connected'),coalesce(a.paystack_verified,false) from public.organizations o left join public.events e on e.organization_id=o.id and e.purged_at is null left join public.organization_paystack_accounts a on a.organization_id=o.id where exists(select 1 from public.platform_admins p where p.user_id=auth.uid() and p.is_active) group by o.id,o.name,o.moderation_status,a.status,a.paystack_verified order by o.created_at desc limit 500; $$;
create or replace function public.get_admin_organization_profile(p_org uuid) returns table(id uuid,name text,moderation_status text,event_id uuid,event_name text,event_status text,paystack_status text,paystack_verified boolean) language sql stable security definer set search_path='' as $$ select o.id,o.name,o.moderation_status,e.id,e.name,e.status,coalesce(a.status,'not_connected'),coalesce(a.paystack_verified,false) from public.organizations o left join public.events e on e.organization_id=o.id and e.purged_at is null left join public.organization_paystack_accounts a on a.organization_id=o.id where o.id=p_org and exists(select 1 from public.platform_admins p where p.user_id=auth.uid() and p.is_active) order by e.created_at desc; $$;

create or replace function private.execute_admin_purge(p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 -- A queued job must finish even when its requesting administrator was removed.
 if j.requested_by is not null then
  insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(j.requested_by,'data_purged',j.target_kind,j.target_id,j.reason);
 end if;
 return summary;
end $$;
