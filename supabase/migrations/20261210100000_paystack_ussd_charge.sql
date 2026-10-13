alter table public.payment_attempts add column charge_started_at timestamptz;
alter table public.ussd_sessions add column charge_status text,add column charge_checked_at timestamptz;
create function public.reserve_paystack_ussd_payment(p_session text,p_phone_hash text,p_event uuid,p_category uuid,p_nominee uuid,p_quantity integer)
returns public.payment_attempts language plpgsql security definer set search_path='' as $body$
declare e public.events%rowtype; s public.ussd_sessions%rowtype; p public.payment_attempts%rowtype; ref text; account text;
begin
 select * into e from public.events where id=p_event for share;
 if not found or e.voting_mode<>'paid' or not exists(select 1 from public.get_public_ussd(e.id)) then raise exception 'Paid event unavailable'; end if;
 select * into s from public.ussd_sessions where session_id=p_session for update;
 if not found or s.phone_hash is distinct from p_phone_hash or s.expires_at<=now() or p_quantity is null or p_quantity not between 1 and 10000 then raise exception 'Session unavailable'; end if;
 if not exists(select 1 from public.categories c join public.nominees n on n.category_id=c.id where c.id=p_category and c.event_id=e.id and c.is_active and n.id=p_nominee and n.is_active) then raise exception 'Nominee unavailable'; end if;
 select subaccount_code into account from public.organization_paystack_accounts where organization_id=e.organization_id and status='active' and paystack_verified and percentage_charge=10;
 if not found then raise exception 'Verified settlement account required'; end if;
 ref:='VCH-USSD-'||replace(s.vote_request::text,'-','');
 insert into public.payment_attempts(idempotency_key,event_id,organization_id,category_id,nominee_id,quantity,unit_price_minor,total_amount_minor,currency,provider,provider_reference,status,subaccount_code)
 values('ussd-paystack-'||s.vote_request::text,e.id,e.organization_id,p_category,p_nominee,p_quantity,e.unit_price_minor,e.unit_price_minor::bigint*p_quantity,'GHS','paystack',ref,'pending',account) on conflict(idempotency_key) do nothing;
 select * into p from public.payment_attempts where idempotency_key='ussd-paystack-'||s.vote_request::text;
 if not found or p.event_id<>p_event or p.category_id<>p_category or p.nominee_id<>p_nominee or p.quantity<>p_quantity then raise exception 'Session vote already reserved'; end if;
 update public.ussd_sessions set event_id=e.id,category_id=p_category,nominee_id=p_nominee,quantity=p_quantity,mode='payment_pending',reference=ref where session_id=p_session;
 return p;
end $body$;
revoke all on function public.reserve_paystack_ussd_payment(text,text,uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_paystack_ussd_payment(text,text,uuid,uuid,uuid,integer) to service_role;
create function public.claim_ussd_charge(p_reference text) returns boolean language plpgsql security definer set search_path='' as $body$
begin
 update public.payment_attempts set charge_started_at=now() where provider='paystack' and provider_reference=p_reference and status='pending' and charge_started_at is null;
 return found;
end $body$;
revoke all on function public.claim_ussd_charge(text) from public,anon,authenticated;
grant execute on function public.claim_ussd_charge(text) to service_role;

alter table public.ussd_sessions add column payment_email text,add column awaiting_email boolean not null default false;
create function public.find_ussd_receipt_email(p_phone text) returns text language sql stable security definer set search_path='' as $body$
 select email from auth.users where regexp_replace(phone,'[^0-9]','','g')=p_phone and phone_confirmed_at is not null and email_confirmed_at is not null order by created_at nulls last,id limit 1;
$body$;
revoke all on function public.find_ussd_receipt_email(text) from public,anon,authenticated;
grant execute on function public.find_ussd_receipt_email(text) to service_role;
drop function public.finish_native_ussd(text,text,uuid,jsonb,boolean);
create function public.finish_native_ussd(p_session text,p_hash text,p_lease uuid,p_reply jsonb,p_failed boolean,p_restore_path boolean default false)
returns void language plpgsql security definer set search_path='' as $body$
begin
 update public.ussd_sessions set native_reply=case when p_failed then native_reply else p_reply end,
 native_path=case when p_failed or p_restore_path then coalesce(native_previous_path,'') else native_path end,
 native_lease=null,native_lease_until=null,native_previous_path=null where session_id=p_session and phone_hash=p_hash and native_lease=p_lease;
 if not found then raise exception 'Session lease changed'; end if;
end $body$;
revoke all on function public.finish_native_ussd(text,text,uuid,jsonb,boolean,boolean) from public,anon,authenticated;
grant execute on function public.finish_native_ussd(text,text,uuid,jsonb,boolean,boolean) to service_role;
