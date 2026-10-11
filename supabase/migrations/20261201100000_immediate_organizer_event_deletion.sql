-- Organizer deletion has no grace period. Cleanup is durable and bounded.
create table public.organizer_event_deletions (
 event_id uuid primary key, organization_id uuid not null,
 requested_by uuid not null, created_at timestamptz not null default now(),
 completed_at timestamptz, last_error text, next_attempt_at timestamptz not null default now()
);
alter table public.organizer_event_deletions enable row level security;
revoke all on public.organizer_event_deletions from public,anon,authenticated;
grant all on public.organizer_event_deletions to service_role;

create function public.delete_organizer_event(p_event_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.organization_members where organization_id=e.organization_id and user_id=auth.uid() and role in ('owner','admin')) then
  raise exception 'Only owners and admins can delete events' using errcode='42501'; end if;
 perform private.require_active_organization(e.organization_id);
 if e.purged_at is not null then return e.organization_id; end if;
 if e.status not in ('draft','pending_review','closed','archived') then
  raise exception 'Close this event before deleting it. Use Pause for a temporary break.' using errcode='22023'; end if;
 if exists(select 1 from public.admin_deletion_jobs where status='pending' and ((target_kind='event' and target_id=e.id) or (target_kind='organization' and target_id=e.organization_id))) then
  raise exception 'Platform deletion is already in progress for this event' using errcode='42501'; end if;
 insert into private.admin_purge_context values(txid_current()) on conflict do nothing;
 insert into public.event_image_cleanup(path)
  select name from storage.objects where bucket_id='nominee-images' and split_part(name,'/',1)=e.id::text on conflict do nothing;
 update public.events set status='archived',archived_at=coalesce(archived_at,now()),purged_at=now(),
  description=null,voting_rules=null,image_path=null,voter_help_email=null,results_visibility='hidden' where id=e.id;
 insert into public.organizer_event_deletions(event_id,organization_id,requested_by) values(e.id,e.organization_id,auth.uid()) on conflict do nothing;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(e.organization_id,auth.uid(),'event_deleted','event',e.id::text,jsonb_build_object('name',e.name,'cleanup_queued',true));
 delete from private.admin_purge_context where transaction_id=txid_current();
 return e.organization_id;
end $$;
revoke all on function public.delete_organizer_event(uuid) from public,anon;
grant execute on function public.delete_organizer_event(uuid) to authenticated;

create function public.process_organizer_event_deletions(p_limit integer default 2) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.organizer_event_deletions; finished boolean; completed integer:=0; progressing integer:=0; failed integer:=0;
begin
 for j in select * from public.organizer_event_deletions where completed_at is null and next_attempt_at<=now()
  order by created_at limit least(greatest(coalesce(p_limit,2),1),5) for update skip locked loop
  begin
   perform 1 from public.events where id=j.event_id for update;
   insert into private.admin_purge_context values(txid_current()) on conflict do nothing;
   delete from public.event_review_messages where id in(select id from public.event_review_messages where event_id=j.event_id limit 5000);
   delete from public.notification_email_jobs where id in(select id from public.notification_email_jobs where event_id=j.event_id limit 5000);
   delete from public.notifications where id in(select id from public.notifications where event_id=j.event_id limit 5000);
   -- These tables cascade for physically removed events; clear them for retained payment references too.
   if exists(select 1 from public.event_review_messages where event_id=j.event_id)
    or exists(select 1 from public.notification_email_jobs where event_id=j.event_id)
    or exists(select 1 from public.notifications where event_id=j.event_id) then
    progressing:=progressing+1;
   else
    finished:=private.purge_event(j.event_id);
    if finished is null then progressing:=progressing+1;
    else update public.organizer_event_deletions set completed_at=now(),last_error=null where event_id=j.event_id; completed:=completed+1; end if;
   end if;
   delete from private.admin_purge_context where transaction_id=txid_current();
  exception when others then
   update public.organizer_event_deletions set last_error=left(sqlerrm,500),next_attempt_at=now()+interval '5 minutes' where event_id=j.event_id;
   failed:=failed+1;
  end;
 end loop;
 return jsonb_build_object('completed',completed,'progressing',progressing,'failed',failed);
end $$;
revoke all on function public.process_organizer_event_deletions(integer) from public,anon,authenticated;
grant execute on function public.process_organizer_event_deletions(integer) to service_role;

create or replace function public.get_organization_events(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  slug text,
  description text,
  currency text,
  unit_price_minor bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  results_visibility text,
  created_at timestamptz,
  updated_at timestamptz,
  voting_mode text,
  free_vote_limit_per_phone smallint,
  voting_rules text,
  image_path text,
  voting_rule text
)
language sql stable security definer set search_path = '' as $$
  select event.id, event.organization_id, event.name, event.slug, event.description,
         event.currency, event.unit_price_minor, event.starts_at, event.ends_at,
         event.status, event.results_visibility, event.created_at, event.updated_at,
         event.voting_mode, event.free_vote_limit_per_phone, event.voting_rules,
         event.image_path, event.voting_rule
  from public.events as event
  where event.organization_id = p_organization_id and event.purged_at is null
    and private.is_org_member(p_organization_id)
  order by event.created_at desc;
$$;

-- Late successful charges still reconcile money, without recreating deleted votes.
create or replace function public.confirm_paid_vote(p_reference text, p_transaction_id bigint, p_paid_amount_minor bigint, p_provider_fee_minor bigint default 0)
returns void language plpgsql security definer set search_path = public as $$
declare p payment_attempts%rowtype; platform bigint; net bigint; deleted boolean;
begin
 -- Lock the event before the attempt, matching deletion lock order.
 select * into p from payment_attempts where provider='paystack' and provider_reference=p_reference;
 if not found then raise exception 'Payment attempt not found'; end if;
 select purged_at is not null into deleted from events where id=p.event_id for share;
 select * into p from payment_attempts where id=p.id for update;
 if not found then raise exception 'Payment attempt not found'; end if;
 if p.status in ('succeeded','refunded','reversed') then return; end if;
 if p_provider_fee_minor is null or p_provider_fee_minor < 0 then raise exception 'Invalid provider fee'; end if;
 if p_paid_amount_minor is distinct from p.total_amount_minor then raise exception 'Payment amount mismatch'; end if;
 platform := floor(p.total_amount_minor * 0.10); net := p.total_amount_minor - platform;
 update payment_attempts set status='succeeded', confirmed_at=coalesce(confirmed_at,now()), updated_at=now() where id=p.id;
 if not deleted then
 insert into vote_batches(payment_attempt_id,event_id,category_id,nominee_id,quantity) values(p.id,p.event_id,p.category_id,p.nominee_id,p.quantity) on conflict do nothing;
 end if;
 insert into ledger_entries(organization_id,payment_attempt_id,entry_type,amount_minor,currency,idempotency_key,note) select * from (values
 (p.organization_id,p.id,'gross_collection',p.total_amount_minor,p.currency,p.idempotency_key||':gross','Paystack paid vote'),
 (p.organization_id,p.id,'provider_fee',-greatest(p_provider_fee_minor,0),p.currency,p.idempotency_key||':provider','Paystack fee included in platform share; not an organizer deduction'),
 (p.organization_id,p.id,'platform_fee',-platform,p.currency,p.idempotency_key||':platform','VotecastHub 10% platform fee'),
 (p.organization_id,p.id,'organizer_earning',net,p.currency,p.idempotency_key||':net','Organizer net earnings')) as entries(org,attempt,kind,amount,currency,key,note) where amount <> 0;
 insert into paid_vote_ledger(organization_id,event_id,reference,gross_amount_minor,platform_fee_minor,provider_fee_minor,organizer_net_minor,status,provider_transaction_id,confirmed_at)
 values(p.organization_id,p.event_id,p.provider_reference,p.total_amount_minor,platform,greatest(p_provider_fee_minor,0),net,'confirmed',p_transaction_id,now())
 on conflict (reference) do nothing;
end $$;

-- Deleted competitions do not remain in analytics selectors or standings. Payment reports retain financial history.
-- One authoritative scope and refund policy for dashboard and exports.
create or replace function private.analytics_scope(p_org uuid,p_event uuid,p_days integer)
returns timestamptz language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_org_member(p_org) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if p_days not in (0,7,30,365) or p_days is null then raise exception 'Invalid analytics range' using errcode='22023'; end if;
 if p_event is not null and not exists(select 1 from public.events where purged_at is null and id=p_event and organization_id=p_org) then
  raise exception 'Event access denied' using errcode='42501';
 end if;
 if p_days=0 then
  return (date_trunc('day',(select min(t) from (
   select e.created_at t from public.events e where e.purged_at is null and e.organization_id=p_org and (p_event is null or e.id=p_event)
   union all select b.created_at from public.vote_batches b join public.events e on e.id=b.event_id where e.purged_at is null and e.organization_id=p_org and (p_event is null or e.id=p_event)
   union all select coalesce(l.confirmed_at,l.created_at) from public.paid_vote_ledger l where l.organization_id=p_org and (p_event is null or l.event_id=p_event)
   union all select now()
  ) activity) at time zone 'UTC')) at time zone 'UTC';
 end if;
 return ((now() at time zone 'UTC')::date-(p_days-1))::timestamp at time zone 'UTC';
end $$;
revoke all on function private.analytics_scope(uuid,uuid,integer) from public,anon,authenticated;

create or replace function private.analytics_votes(p_org uuid,p_event uuid,p_since timestamptz)
returns table(batch_id uuid,event_id uuid,category_id uuid,nominee_id uuid,created_at timestamptz,recorded_votes bigint,valid_votes bigint,paid boolean)
language sql stable security definer set search_path='' as $$
 select b.id,b.event_id,b.category_id,b.nominee_id,b.created_at,b.quantity::bigint,
 case when b.reversed_at is not null then 0
 when b.payment_attempt_id is null then b.quantity
 when l.status in ('confirmed','refunded','reversed') then greatest(0,b.quantity-ceil(coalesce(l.refunded_amount_minor,0)::numeric/nullif(p.unit_price_minor,0)))
 else 0 end::bigint,b.payment_attempt_id is not null
 from public.vote_batches b join public.events e on e.id=b.event_id
 left join public.payment_attempts p on p.id=b.payment_attempt_id
 left join public.paid_vote_ledger l on l.reference=p.provider_reference
 where e.purged_at is null and e.organization_id=p_org and (p_event is null or e.id=p_event) and b.created_at>=p_since and b.created_at<=now();
$$;
revoke all on function private.analytics_votes(uuid,uuid,timestamptz) from public,anon,authenticated;

create or replace function public.get_scoped_organizer_analytics(p_org uuid,p_event uuid default null,p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 since:=private.analytics_scope(p_org,p_event,p_days);
 with selected_events as (select * from public.events where purged_at is null and organization_id=p_org and (p_event is null or id=p_event)),
 votes as materialized (select * from private.analytics_votes(p_org,p_event,since)),
 payments as materialized (select l.* from public.paid_vote_ledger l join selected_events e on e.id=l.event_id
  where l.status in ('confirmed','refunded','reversed') and coalesce(l.confirmed_at,l.created_at)>=since and coalesce(l.confirmed_at,l.created_at)<=now()),
 event_votes as (select event_id,sum(valid_votes) total_votes,sum(case when paid then valid_votes else 0 end) paid_votes from votes group by event_id),
 event_money as (select event_id,sum(gross_amount_minor) gross_minor,sum(refunded_amount_minor) refunded_minor,sum(organizer_net_minor) net_minor from payments group by event_id),
 event_rows as (select e.id event_id,e.name event_name,e.status,coalesce(v.total_votes,0) total_votes,coalesce(v.paid_votes,0) paid_votes,
  coalesce(m.gross_minor,0) gross_minor,coalesce(m.refunded_minor,0) refunded_minor,coalesce(m.net_minor,0) net_minor
  from selected_events e left join event_votes v on v.event_id=e.id left join event_money m on m.event_id=e.id),
 nominee_rows as (select n.id nominee_id,n.name nominee_name,e.id event_id,e.name event_name,c.id category_id,c.name category_name,
  coalesce(sum(v.valid_votes),0) total_votes,coalesce(sum(case when v.paid then v.valid_votes else 0 end),0) paid_votes
  from selected_events e join public.categories c on c.event_id=e.id join public.nominees n on n.category_id=c.id
  left join votes v on v.nominee_id=n.id group by n.id,n.name,e.id,e.name,c.id,c.name),
 category_rows as (select c.id category_id,c.name category_name,e.id event_id,e.name event_name,coalesce(sum(v.valid_votes),0) total_votes,
  coalesce(sum(case when v.paid then v.valid_votes else 0 end),0) paid_votes
  from selected_events e join public.categories c on c.event_id=e.id left join votes v on v.category_id=c.id group by c.id,c.name,e.id,e.name),
 days as (select generate_series(since at time zone 'UTC',(now() at time zone 'UTC')::date::timestamp,interval '1 day')::date as day),
 daily_votes as (select (created_at at time zone 'UTC')::date as day,sum(valid_votes) total_votes,sum(case when paid then valid_votes else 0 end) paid_votes from votes group by 1),
 daily_money as (select (coalesce(confirmed_at,created_at) at time zone 'UTC')::date as day,sum(gross_amount_minor) gross_minor,sum(refunded_amount_minor) refunded_minor,sum(organizer_net_minor) net_minor from payments group by 1),
 daily_traffic as (select a.day,sum(a.views) views from public.event_analytics_daily a join selected_events e on e.id=a.event_id where a.day>=(since at time zone 'UTC')::date and a.day<=(now() at time zone 'UTC')::date group by a.day),
 trends as (select d.day,coalesce(v.total_votes,0) total_votes,coalesce(v.paid_votes,0) paid_votes,coalesce(v.total_votes-v.paid_votes,0) free_votes from days d left join daily_votes v using(day)),
 revenue as (select d.day,coalesce(m.gross_minor,0) gross_minor,coalesce(m.refunded_minor,0) refunded_minor,coalesce(m.net_minor,0) net_minor from days d left join daily_money m using(day))
 select jsonb_build_object(
 'as_of',now(),
 'votes_today',coalesce((select sum(valid_votes) from votes where created_at>=((now() at time zone 'UTC')::date::timestamp at time zone 'UTC')),0),
 'last_vote_at',(select max(greatest(v.created_at,l.confirmed_at)) from votes v join public.vote_batches b on b.id=v.batch_id left join public.payment_attempts p on p.id=b.payment_attempt_id left join public.paid_vote_ledger l on l.reference=p.provider_reference where v.valid_votes>0),
 'pending_payments',(select count(*) from public.payment_attempts p join selected_events e on e.id=p.event_id where p.status in ('created','pending')),
 'events',coalesce((select jsonb_agg(jsonb_build_object('event_id',id,'event_name',name) order by created_at desc,id) from public.events where purged_at is null and organization_id=p_org),'[]'::jsonb),
 'rows',coalesce((select jsonb_agg(to_jsonb(r) order by event_name,event_id) from event_rows r),'[]'::jsonb),
 'nominees',coalesce((select jsonb_agg(to_jsonb(n) order by event_id,category_id,total_votes desc,nominee_id) from nominee_rows n),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(to_jsonb(c) order by event_id,category_name,category_id) from category_rows c),'[]'::jsonb),
 'trends',(select jsonb_agg(to_jsonb(t) order by day) from trends t),
 'revenue',(select jsonb_agg(to_jsonb(r) order by day) from revenue r),
 'views',coalesce((select sum(views) from daily_traffic),0),
 'event_visitors',(select count(distinct (v.event_id,v.visitor_hash)) from private.event_analytics_visitors v join selected_events e on e.id=v.event_id where v.day>=(since at time zone 'UTC')::date and v.day<=(now() at time zone 'UTC')::date)
 ) into result;
 return result;
end $$;
revoke all on function public.get_scoped_organizer_analytics(uuid,uuid,integer) from public,anon;
grant execute on function public.get_scoped_organizer_analytics(uuid,uuid,integer) to authenticated;

create or replace function public.get_scoped_vote_export(p_org uuid,p_event uuid default null,p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 since:=private.analytics_scope(p_org,p_event,p_days);
 select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc,batch_id),'[]'::jsonb) into result from (
 select v.batch_id,v.event_id,e.name event_name,c.name category_name,n.name nominee_name,v.created_at,v.recorded_votes,v.valid_votes,v.paid
 from private.analytics_votes(p_org,p_event,since) v join public.events e on e.id=v.event_id
 join public.categories c on c.id=v.category_id join public.nominees n on n.id=v.nominee_id) r;
 return result;
end $$;
revoke all on function public.get_scoped_vote_export(uuid,uuid,integer) from public,anon;
grant execute on function public.get_scoped_vote_export(uuid,uuid,integer) to authenticated;

create or replace function public.get_scoped_payment_export(p_org uuid,p_event uuid default null,p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 since:=private.analytics_scope(p_org,p_event,p_days);
 select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc,reference),'[]'::jsonb) into result from (
 select l.reference,l.event_id,e.name event_name,coalesce(l.confirmed_at,l.created_at) created_at,
 case when l.refunded_amount_minor>0 and l.refunded_amount_minor<l.gross_amount_minor then 'partially refunded' else l.status end status,
 l.gross_amount_minor gross_minor,l.refunded_amount_minor refunded_minor,l.organizer_net_minor net_minor
 from public.paid_vote_ledger l join public.events e on e.id=l.event_id
 where e.purged_at is null and e.organization_id=p_org and (p_event is null or e.id=p_event) and l.status in ('confirmed','refunded','reversed')
 and coalesce(l.confirmed_at,l.created_at)>=since and coalesce(l.confirmed_at,l.created_at)<=now()) r;
 return result;
end $$;
revoke all on function public.get_scoped_payment_export(uuid,uuid,integer) from public,anon;
grant execute on function public.get_scoped_payment_export(uuid,uuid,integer) to authenticated;

create or replace function public.get_scoped_sms_export(p_org uuid,p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 since:=private.analytics_scope(p_org,null,p_days);
 select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc,entry_type,reference),'[]'::jsonb) into result from (
  select 'purchase'::text entry_type,p.reference,p.credits,p.amount_minor,p.refunded_amount_minor refunded_minor,p.status,p.created_at
  from public.sms_credit_purchases p where p.organization_id=p_org and p.created_at>=since and p.created_at<=now()
  union all
  select 'send_attempt',null::text,-1,0,0,case when u.accepted then 'accepted' when u.accepted is false then 'rejected' else 'uncertain' end,u.created_at
  from public.sms_credit_usage u where u.organization_id=p_org and u.created_at>=since and u.created_at<=now()
 ) r;
 return result;
end $$;
revoke all on function public.get_scoped_sms_export(uuid,integer) from public,anon;
grant execute on function public.get_scoped_sms_export(uuid,integer) to authenticated;


