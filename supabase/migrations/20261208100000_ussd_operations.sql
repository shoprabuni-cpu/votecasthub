-- USSD financial records remain separate from disposable event content.
alter table public.event_ussd_requests add column event_code bigint generated always as identity (start with 1000) unique,
 add column access_paid boolean not null default false,
 add column payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refunded')),
 add column enabled boolean not null default false,
 add column dial_code text,
 add column active_from timestamptz,
 add column active_until timestamptz,
 add column network_notice text;
create table public.ussd_access_payments (
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),
 organization_id uuid not null references public.organizations(id),quote_id uuid not null,
 reference text not null unique,amount_minor integer not null check(amount_minor>0),
 status text not null default 'pending' check(status in ('pending','paid','refunded')),
 provider_transaction_id bigint unique,refunded_amount_minor bigint not null default 0,
 created_at timestamptz not null default now(),paid_at timestamptz,
 unique(event_id,quote_id)
);
alter table public.ussd_access_payments enable row level security;
revoke all on public.ussd_access_payments from public,anon,authenticated;
grant select on public.ussd_access_payments to authenticated;
grant all on public.ussd_access_payments to service_role;
create policy ussd_access_read on public.ussd_access_payments for select to authenticated using(private.is_org_member(organization_id) or exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active));

create function public.begin_ussd_access_checkout(p_event_id uuid,p_quote_id uuid,p_reference text)
returns public.ussd_access_payments language plpgsql security definer set search_path='' as $body$
declare r public.event_ussd_requests%rowtype; e public.events%rowtype; p public.ussd_access_payments%rowtype;
begin
 select * into e from public.events where id=p_event_id for update;
 select * into r from public.event_ussd_requests where event_id=p_event_id for update;
 if not found or r.status<>'accepted' or r.quote_id is distinct from p_quote_id or e.purged_at is not null or e.status in ('closed','archived') or e.ends_at<=now() or not private.organization_is_active(e.organization_id) then raise exception 'Accepted quote unavailable'; end if;
 insert into public.ussd_access_payments(event_id,organization_id,quote_id,reference,amount_minor) values(e.id,e.organization_id,r.quote_id,p_reference,r.amount_minor) on conflict(event_id,quote_id) do nothing;
 select * into p from public.ussd_access_payments where event_id=p_event_id and quote_id=p_quote_id;
 return p;
end $body$;
create function public.fulfill_ussd_access(p_reference text,p_transaction_id bigint,p_amount_minor bigint)
returns void language plpgsql security definer set search_path='' as $body$
declare p public.ussd_access_payments%rowtype;
begin
 select * into p from public.ussd_access_payments where reference=p_reference for update;
 if not found or p.amount_minor is distinct from p_amount_minor or p_transaction_id is null or p_transaction_id<=0 then raise exception 'Payment mismatch'; end if;
 if p.status<>'pending' then
  if p.provider_transaction_id is distinct from p_transaction_id then raise exception 'Transaction mismatch'; end if;
  return;
 end if;
 update public.ussd_access_payments set status='paid',provider_transaction_id=p_transaction_id,paid_at=now() where id=p.id;
 update public.event_ussd_requests set access_paid=true,payment_status='paid' where event_id=p.event_id and quote_id=p.quote_id and status='accepted';
end $body$;
create function public.refund_ussd_access(p_reference text,p_key text,p_amount bigint)
returns void language plpgsql security definer set search_path='' as $body$
declare p public.ussd_access_payments%rowtype; total bigint;
begin
 select * into p from public.ussd_access_payments where reference=p_reference for update;
 if not found or p.status='pending' or p_amount is null or p_amount<=0 or p_amount>p.amount_minor then raise exception 'Invalid access refund'; end if;
 if exists(select 1 from public.payment_adjustments where provider_key=p_key) then
  if not exists(select 1 from public.payment_adjustments where provider_key=p_key and reference=p_reference and amount_minor=p_amount) then raise exception 'Refund mismatch'; end if;return;
 end if;
 insert into public.payment_adjustments(provider_key,reference,kind,amount_minor) values(p_key,p_reference,'refund',p_amount);
 select least(p.amount_minor,sum(amount_minor)) into total from public.payment_adjustments where reference=p_reference;
 update public.ussd_access_payments set status='refunded',refunded_amount_minor=total where id=p.id;
 update public.event_ussd_requests set access_paid=false,payment_status='refunded',enabled=false where event_id=p.event_id;
end $body$;
create function public.configure_event_ussd(p_event_id uuid,p_enabled boolean,p_dial_code text,p_from timestamptz,p_until timestamptz,p_network_notice text)
returns void language plpgsql security definer set search_path='' as $body$
declare e public.events%rowtype; r public.event_ussd_requests%rowtype;
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active) then raise exception 'Admin required' using errcode='42501'; end if;
 select * into e from public.events where id=p_event_id for update;
 select * into r from public.event_ussd_requests where event_id=p_event_id for update;
 if not found or p_enabled is null then raise exception 'Request unavailable'; end if;
 if p_enabled then
  if r.status<>'accepted' or not r.access_paid or e.purged_at is not null or e.status<>'published' or not private.organization_is_active(e.organization_id) or p_dial_code is null or p_dial_code !~ '^\*[0-9*]{2,30}#$' or p_from is null or p_until is null or p_until<=now() or p_until<=p_from or p_from<e.starts_at or p_until>e.ends_at or p_network_notice is null or char_length(trim(p_network_notice)) not between 5 and 300 then raise exception 'Check confirmed payment, published event, dates, code and network charges'; end if;
  if e.voting_mode='free' and e.verification_method<>'phone' then raise exception 'USSD free voting requires phone verification. Private or email voting remains on the website'; end if;
 end if;
 update public.event_ussd_requests set enabled=p_enabled,dial_code=case when p_enabled then p_dial_code else dial_code end,active_from=case when p_enabled then p_from else active_from end,active_until=case when p_enabled then p_until else active_until end,network_notice=case when p_enabled then trim(p_network_notice) else network_notice end,updated_at=now() where event_id=p_event_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata) values(e.organization_id,auth.uid(),'ussd_configuration','event',e.id::text,jsonb_build_object('enabled',p_enabled,'dial_code',p_dial_code,'from',p_from,'until',p_until));
end $body$;
create function public.get_public_ussd(p_event_id uuid)
returns table(event_code bigint,dial_code text,network_notice text) language sql stable security definer set search_path='' as $body$
 select r.event_code,r.dial_code,r.network_notice from public.event_ussd_requests r join public.events e on e.id=r.event_id
 where e.id=p_event_id and r.enabled and r.access_paid and r.status='accepted' and e.purged_at is null and e.status='published' and private.organization_is_active(e.organization_id) and now()>=greatest(e.starts_at,r.active_from) and now()<least(e.ends_at,r.active_until);
$body$;
revoke all on function public.get_public_ussd(uuid) from public;
grant execute on function public.get_public_ussd(uuid) to anon,authenticated,service_role;
revoke all on function public.configure_event_ussd(uuid,boolean,text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.configure_event_ussd(uuid,boolean,text,timestamptz,timestamptz,text) to authenticated;
revoke all on function public.begin_ussd_access_checkout(uuid,uuid,text),public.fulfill_ussd_access(text,bigint,bigint),public.refund_ussd_access(text,text,bigint) from public,anon,authenticated;
grant execute on function public.begin_ussd_access_checkout(uuid,uuid,text),public.fulfill_ussd_access(text,bigint,bigint),public.refund_ussd_access(text,text,bigint) to service_role;

-- Audit every request/quote/acceptance revision without exposing it publicly.
create function private.audit_ussd_request() returns trigger language plpgsql security definer set search_path='' as $body$
begin
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata) values(new.organization_id,auth.uid(),'ussd_request_updated','event',new.event_id::text,jsonb_build_object('status',new.status,'quote_id',new.quote_id,'amount_minor',new.amount_minor,'terms',new.terms,'accepted_by',new.accepted_by,'access_paid',new.access_paid,'enabled',new.enabled));return new;
end $body$;
create trigger audit_ussd_request after insert or update on public.event_ussd_requests for each row execute function private.audit_ussd_request();

-- Reconcile pending access purchases even if the webhook was missed.
create function public.enqueue_ussd_access_reconciliation() returns void language sql security definer set search_path='' as $body$
 insert into public.payment_jobs(id,kind,resource) select 'charge.success:'||reference,'charge.success',reference from public.ussd_access_payments where status='pending' and created_at>now()-interval '30 days' on conflict(id) do nothing;
$body$;
revoke all on function public.enqueue_ussd_access_reconciliation() from public,anon,authenticated;
grant execute on function public.enqueue_ussd_access_reconciliation() to service_role;

-- Transaction identifiers belong to a provider, not a global number space.
alter table public.paid_vote_ledger add column provider text not null default 'paystack';
alter table public.paid_vote_ledger drop constraint paid_vote_ledger_provider_transaction_id_key;
alter table public.paid_vote_ledger add constraint paid_vote_provider_transaction_unique unique(provider,provider_transaction_id);
-- Carrier-authenticated callers reuse their existing verified web phone identity.
create function public.find_ussd_voter(p_phone text) returns uuid language sql stable security definer set search_path='' as $body$
 select id from auth.users where regexp_replace(phone,'[^0-9]','','g')=p_phone and phone_confirmed_at is not null order by created_at nulls last,id limit 1;
$body$;
create function public.cast_verified_ussd_vote(p_user uuid,p_event uuid,p_category uuid,p_nominee uuid,p_quantity integer,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $body$
declare old_sub text; old_claims text; result uuid;
begin
 if not exists(select 1 from auth.users where id=p_user and phone_confirmed_at is not null) then raise exception 'Verified phone required'; end if;
 if not exists(select 1 from public.get_public_ussd(p_event)) then raise exception 'USSD unavailable'; end if;
 old_sub:=current_setting('request.jwt.claim.sub',true);old_claims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claim.sub',p_user::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated')::text,true);
 result:=public.cast_free_votes(p_event,p_category,p_nominee,p_quantity,p_request);
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);perform set_config('request.jwt.claims',coalesce(old_claims,'{}'),true);
 return result;
end $body$;
revoke all on function public.find_ussd_voter(text),public.cast_verified_ussd_vote(uuid,uuid,uuid,uuid,integer,uuid),public.cast_ussd_free_vote(text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.find_ussd_voter(text),public.cast_verified_ussd_vote(uuid,uuid,uuid,uuid,integer,uuid) to service_role;

create or replace function public.confirm_ussd_paid_vote(p_reference text, p_transaction_id bigint, p_paid_amount_minor bigint, p_provider_fee_minor bigint default 0)
returns void language plpgsql security definer set search_path = public as $$
declare p payment_attempts%rowtype; platform bigint; net bigint; deleted boolean;
begin
 -- Lock the event before the attempt, matching deletion lock order.
 select * into p from payment_attempts where provider='arkesel_ussd' and provider_reference=p_reference;
 if not found then raise exception 'Payment attempt not found'; end if;
 select purged_at is not null into deleted from events where id=p.event_id for share;
 select * into p from payment_attempts where id=p.id for update;
 if not found then raise exception 'Payment attempt not found'; end if;
 if p.status in ('succeeded','refunded','reversed') then
 if not exists(select 1 from paid_vote_ledger where reference=p_reference and provider='arkesel_ussd' and provider_transaction_id=p_transaction_id) then raise exception 'USSD transaction identity mismatch'; end if;
 return; end if;
 if p_provider_fee_minor is null or p_provider_fee_minor < 0 then raise exception 'Invalid provider fee'; end if;
 if p_paid_amount_minor is distinct from p.total_amount_minor then raise exception 'Payment amount mismatch'; end if;
 platform := floor(p.total_amount_minor * 0.10); net := p.total_amount_minor - platform;
 update payment_attempts set status='succeeded', confirmed_at=coalesce(confirmed_at,now()), updated_at=now() where id=p.id;
 if not deleted then
 insert into vote_batches(payment_attempt_id,event_id,category_id,nominee_id,quantity) values(p.id,p.event_id,p.category_id,p.nominee_id,p.quantity) on conflict do nothing;
 end if;
 insert into ledger_entries(organization_id,payment_attempt_id,entry_type,amount_minor,currency,idempotency_key,note) select * from (values
 (p.organization_id,p.id,'gross_collection',p.total_amount_minor,p.currency,p.idempotency_key||':gross','USSD provider paid vote'),
 (p.organization_id,p.id,'provider_fee',-greatest(p_provider_fee_minor,0),p.currency,p.idempotency_key||':provider','USSD provider fee included in platform share; not an organizer deduction'),
 (p.organization_id,p.id,'platform_fee',-platform,p.currency,p.idempotency_key||':platform','VotecastHub 10% platform fee'),
 (p.organization_id,p.id,'organizer_earning',net,p.currency,p.idempotency_key||':net','Organizer net earnings')) as entries(org,attempt,kind,amount,currency,key,note) where amount <> 0;
 insert into paid_vote_ledger(provider,organization_id,event_id,reference,gross_amount_minor,platform_fee_minor,provider_fee_minor,organizer_net_minor,status,provider_transaction_id,confirmed_at)
 values('arkesel_ussd',p.organization_id,p.event_id,p.provider_reference,p.total_amount_minor,platform,greatest(p_provider_fee_minor,0),net,'confirmed',p_transaction_id,now())
 on conflict (reference) do nothing;
end $$;


revoke all on function public.confirm_ussd_paid_vote(text,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.confirm_ussd_paid_vote(text,bigint,bigint,bigint) to service_role;

revoke all on function public.confirm_ussd_paid_vote(text,bigint,bigint) from public,anon,authenticated,service_role;
alter table public.ussd_sessions add column vote_request uuid not null default gen_random_uuid(),add column final_response text;
create function public.reserve_ussd_payment(p_session text,p_phone_hash text,p_event uuid,p_category uuid,p_nominee uuid,p_quantity integer)
returns public.payment_attempts language plpgsql security definer set search_path='' as $body$
declare e public.events%rowtype; s public.ussd_sessions%rowtype; p public.payment_attempts%rowtype; ref text;
begin
 select * into e from public.events where id=p_event for share;
 if not found or e.voting_mode<>'paid' or not exists(select 1 from public.get_public_ussd(e.id)) then raise exception 'Paid event unavailable'; end if;
 select * into s from public.ussd_sessions where session_id=p_session for update;
 if not found or s.phone_hash is distinct from p_phone_hash or s.expires_at<=now() or p_quantity is null or p_quantity not between 1 and 10000 then raise exception 'Session unavailable'; end if;
 if not exists(select 1 from public.categories c join public.nominees n on n.category_id=c.id where c.id=p_category and c.event_id=e.id and c.is_active and n.id=p_nominee and n.is_active) then raise exception 'Nominee unavailable'; end if;
 ref:='VCH-USSD-'||replace(s.vote_request::text,'-','');
 insert into public.payment_attempts(idempotency_key,event_id,organization_id,category_id,nominee_id,quantity,unit_price_minor,total_amount_minor,currency,provider,provider_reference,status)
 values('ussd-'||s.vote_request::text,e.id,e.organization_id,p_category,p_nominee,p_quantity,e.unit_price_minor,e.unit_price_minor::bigint*p_quantity,'GHS','arkesel_ussd',ref,'pending') on conflict(idempotency_key) do nothing;
 select * into p from public.payment_attempts where idempotency_key='ussd-'||s.vote_request::text;
 if p.event_id<>p_event or p.category_id<>p_category or p.nominee_id<>p_nominee or p.quantity<>p_quantity then raise exception 'Session vote already reserved'; end if;
 update public.ussd_sessions set event_id=e.id,category_id=p_category,nominee_id=p_nominee,quantity=p_quantity,mode='payment_pending',reference=ref where session_id=p_session;
 return p;
end $body$;
revoke all on function public.reserve_ussd_payment(text,text,uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_ussd_payment(text,text,uuid,uuid,uuid,integer) to service_role;

-- USSD purchases retain financial references during immediate event deletion.
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
 financial:=financial or exists(select 1 from public.ussd_access_payments where (p_kind='event' and event_id=p_id) or (p_kind='organization' and organization_id=p_id));
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
 keep_reference:=exists(select 1 from public.ussd_access_payments where event_id=p_id) or exists(select 1 from public.payment_attempts where event_id=p_id) or exists(select 1 from public.paid_vote_ledger where event_id=p_id);
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
  keep_reference:=exists(select 1 from public.ussd_access_payments where organization_id=org_id) or retained_events>0 or exists(select 1 from public.audit_logs where organization_id=org_id)
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


create or replace function private.organization_closure_blocker(p_org uuid) returns text language sql stable security definer set search_path='' as $body$
 select case
 when exists(select 1 from public.payment_account_operations where organization_id=p_org) then 'Finish the payment account operation before closing this organization'
 when exists(select 1 from public.payment_attempts where organization_id=p_org and status in ('created','pending')) then 'Reconcile pending vote payments before closing this organization'
 when exists(select 1 from public.sms_credit_purchases where organization_id=p_org and status='pending') then 'Reconcile pending SMS purchases before closing this organization'
 when exists(select 1 from public.ussd_access_payments where organization_id=p_org and status='pending') then 'Reconcile pending USSD access purchases before closing this organization'
 when exists(select 1 from public.payout_requests where organization_id=p_org and status in ('requested','approved','processing')) then 'Resolve outstanding payouts before closing this organization' end;
$body$;
create trigger organization_activity_guard before insert on public.ussd_access_payments for each row execute function private.guard_organization_new_activity();
