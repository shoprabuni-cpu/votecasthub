create table public.sms_sponsorships (
 recipient_hash text primary key, organization_id uuid not null references public.organizations(id), expires_at timestamptz not null
);
create table public.sms_credit_usage (
 request_hash text primary key, organization_id uuid not null references public.organizations(id),
 accepted boolean, created_at timestamptz not null default now()
);
alter table public.sms_sponsorships enable row level security;
alter table public.sms_credit_usage enable row level security;
revoke all on public.sms_sponsorships,public.sms_credit_usage from public,anon,authenticated;
grant all on public.sms_sponsorships,public.sms_credit_usage to service_role;
grant select on public.sms_credit_usage to authenticated;
create policy sms_usage_member_read on public.sms_credit_usage for select to authenticated using(private.is_org_member(organization_id));
create function public.prepare_voter_sms(p_recipient_hash text,p_event_slug text)
returns boolean language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if p_recipient_hash!~'^[a-f0-9]{64}$' then raise exception 'Invalid recipient'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_recipient_hash,1));
 select e.organization_id into org from public.events e join public.organization_sms_credits c on c.organization_id=e.organization_id
 where e.slug=p_event_slug and e.voting_mode='free' and e.status='published' and now()>=e.starts_at and now()<e.ends_at and c.balance>0;
 if not found then return false; end if;
 if exists(select 1 from public.sms_sponsorships where recipient_hash=p_recipient_hash and expires_at>now()) then return false; end if;
 insert into public.sms_sponsorships(recipient_hash,organization_id,expires_at) values(p_recipient_hash,org,now()+interval '60 seconds')
 on conflict(recipient_hash) do update set organization_id=excluded.organization_id,expires_at=excluded.expires_at;
 return true;
end $$;
alter function public.claim_sms_delivery(text,text,integer) rename to claim_sms_delivery_guard;
create function public.claim_sms_delivery(p_request_hash text,p_recipient_hash text,p_daily_limit integer)
returns text language plpgsql security definer set search_path='' as $$
declare result text; org uuid;
begin
 -- Global guard locks first; serializes the following short credit reservation.
 result:=public.claim_sms_delivery_guard(p_request_hash,p_recipient_hash,p_daily_limit);
 if result<>'claimed' then return result; end if;
 select organization_id into org from public.sms_sponsorships where recipient_hash=p_recipient_hash and expires_at>now() for update;
 if not found then raise exception 'No sponsored SMS request'; end if;
 update public.organization_sms_credits set balance=balance-1,updated_at=now() where organization_id=org and balance>0;
 if not found then raise exception 'SMS credits exhausted'; end if;
 delete from public.sms_sponsorships where recipient_hash=p_recipient_hash;
 insert into public.sms_credit_usage(request_hash,organization_id) values(p_request_hash,org);
 return result;
end $$;
create or replace function public.finish_sms_delivery(p_request_hash text,p_sent boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.sms_delivery_attempts set status=case when p_sent then 'sent' else 'failed' end where request_hash=p_request_hash and status='pending';
 update public.sms_credit_usage set accepted=p_sent where request_hash=p_request_hash and accepted is null;
 -- An uncertain or rejected provider request still consumes one reserved credit; never resend automatically.
end $$;
revoke all on function public.prepare_voter_sms(text,text),public.claim_sms_delivery(text,text,integer),public.finish_sms_delivery(text,boolean) from public,anon,authenticated;
grant execute on function public.prepare_voter_sms(text,text),public.claim_sms_delivery(text,text,integer),public.finish_sms_delivery(text,boolean) to service_role;
revoke all on function public.claim_sms_delivery_guard(text,text,integer) from service_role;
create or replace function public.set_event_status(p_event_id uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_new_status text;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_event.organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;

  if p_action = 'publish' and v_event.status = 'draft' then
    if v_event.ends_at <= now() then raise exception 'Voting period must end in the future before publication' using errcode = '22023'; end if;
    if v_event.voting_mode = 'paid' and not public.can_publish_paid_event(p_event_id) then
      raise exception 'Verify the organizer Paystack subaccount before publishing paid voting' using errcode = '22023';
    end if;
    if v_event.voting_mode = 'free' and not exists(select 1 from public.organization_sms_credits where organization_id=v_event.organization_id and balance>0) then raise exception 'Add SMS credits before publishing free voting' using errcode='22023'; end if;
    if v_event.voting_mode = 'free' and v_event.voting_rule = 'one_per_category' and v_event.free_vote_limit_per_phone <> 1 then
      raise exception 'One vote per category must use a limit of one' using errcode = '22023';
    end if;
    if not exists (select 1 from public.categories as category where category.event_id = p_event_id and category.is_active) then
      raise exception 'Add an active category before publishing' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.categories as category
      where category.event_id = p_event_id and category.is_active
        and not exists (select 1 from public.nominees as nominee where nominee.category_id = category.id and nominee.is_active)
    ) then raise exception 'Every active category needs an active nominee' using errcode = '22023'; end if;
    v_new_status := 'published';
  elsif p_action = 'pause' and v_event.status = 'published' then
    v_new_status := 'paused';
  elsif p_action = 'resume' and v_event.status = 'paused' and v_event.ends_at > now() then
    if v_event.voting_mode='paid' and not public.can_publish_paid_event(p_event_id) then raise exception 'Verify the organizer Paystack subaccount before publishing paid voting' using errcode='22023'; end if;
    v_new_status := 'published';
  elsif p_action = 'close' and v_event.status in ('published', 'paused') then
    v_new_status := 'closed';
  elsif p_action = 'archive' and v_event.status in ('draft', 'closed') then
    if exists (select 1 from public.payment_attempts as payment where payment.event_id = p_event_id) then
      raise exception 'Events with payment history cannot be archived' using errcode = '22023';
    end if;
    v_new_status := 'archived';
  else
    raise exception 'This event status change is not allowed' using errcode = '22023';
  end if;

  update public.events set status = v_new_status, archived_at = case when v_new_status = 'archived' then now() else null end where id = p_event_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_event.organization_id, (select auth.uid()), 'event_status_changed', 'event', p_event_id::text,
    jsonb_build_object('from', v_event.status, 'to', v_new_status,
      'voting_mode', v_event.voting_mode, 'voting_rule', v_event.voting_rule,
      'voting_limit', v_event.free_vote_limit_per_phone));
  return v_new_status;
end;
$$;
revoke execute on function public.set_event_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_event_status(uuid, text) to authenticated;

