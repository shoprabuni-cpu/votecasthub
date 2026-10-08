-- Secure organizer access without exposing events.organization_id or granting browser writes.
create or replace function private.can_manage_event(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events e where e.id=p_event_id and private.can_manage_org(e.organization_id));
$$;
revoke all on function private.can_manage_event(uuid) from public,anon;
grant execute on function private.can_manage_event(uuid) to authenticated;
drop policy voter_list_manage on public.event_voter_list_entries;
drop policy access_code_manage on public.event_access_codes;
drop policy access_code_redemption_read on public.event_access_code_redemptions;
create policy voter_list_organizer_read on public.event_voter_list_entries for select to authenticated using(private.can_manage_event(event_id));
create policy access_code_organizer_read on public.event_access_codes for select to authenticated using(private.can_manage_event(event_id));
create policy access_code_redemption_read on public.event_access_code_redemptions for select to authenticated using(voter_user_id=auth.uid());
revoke all on public.event_voter_list_entries,public.event_access_codes from authenticated;
grant select(id,event_id,identifier_type,label,max_votes,used_votes,redeemed_at,created_at) on public.event_voter_list_entries to authenticated;
grant select(id,event_id,max_redemptions,redemption_count,expires_at,created_at) on public.event_access_codes to authenticated;
alter table public.event_voter_list_entries add column claim_code_hash text check(claim_code_hash is null or claim_code_hash ~ '^[a-f0-9]{64}$');
alter table public.event_voter_list_entries drop constraint event_voter_list_entries_identifier_type_check;
alter table public.event_voter_list_entries add constraint event_voter_list_entries_identifier_type_check check(identifier_type in ('email','phone','identifier'));

create function private.normalize_voter_identifier(p_value text,p_type text) returns text language plpgsql immutable set search_path='' as $$
declare v text:=lower(btrim(p_value));
begin
 if p_type='phone' then
  v:=regexp_replace(v,'[^0-9]','','g');
  if v ~ '^0[0-9]{9}$' then v:='233'||substr(v,2); end if;
  if v ~ '^00233[0-9]{9}$' then v:=substr(v,3); end if;
 end if;
 return v;
end $$;
revoke all on function private.normalize_voter_identifier(text,text) from public,anon,authenticated;

create function public.import_event_voters(p_event_id uuid,p_identifiers text[],p_identifier_type text,p_max_votes integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events; v text; n text; total integer; existing_id uuid; claim_code text; claims jsonb:='[]'::jsonb;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if e.status not in ('draft','pending_review','published','paused') then raise exception 'This event cannot change its roster' using errcode='22023'; end if;
 if p_identifier_type is null or p_identifier_type not in ('email','phone','identifier') or p_max_votes is null or p_max_votes not between 1 and 100 or cardinality(p_identifiers) is null or cardinality(p_identifiers) not between 1 and 5000 then raise exception 'Import 1 to 5000 identifiers with a vote limit from 1 to 100' using errcode='22023'; end if;
 for v in select min(value) from unnest(p_identifiers) as item(value) group by private.normalize_voter_identifier(value,p_identifier_type) loop
  n:=private.normalize_voter_identifier(v,p_identifier_type);
  if n is null or char_length(n) not between 1 and 320 or (p_identifier_type='email' and n !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or (p_identifier_type='phone' and n !~ '^233[0-9]{9}$') then raise exception 'Check the roster identifiers and selected identifier type' using errcode='22023'; end if;
  select id into existing_id from public.event_voter_list_entries where event_id=p_event_id and (identifier_hash=encode(sha256(convert_to(n,'UTF8')),'hex') or (p_identifier_type='phone' and identifier_type='phone' and private.normalize_voter_identifier(label,'phone')=n)) order by redeemed_at nulls last,id limit 1 for update;
  if existing_id is not null and exists(select 1 from public.event_voter_list_entries where id=existing_id and identifier_type<>p_identifier_type) then raise exception 'This identifier is already imported with another type' using errcode='22023'; end if;
  if exists(select 1 from public.event_voter_list_entries where id=existing_id and used_votes>p_max_votes) then raise exception 'A voter limit cannot be lower than votes already used' using errcode='22023'; end if;
  claim_code:=null;
  if p_identifier_type='identifier' and not exists(select 1 from public.event_voter_list_entries where id=existing_id and redeemed_at is not null) then
   claim_code:=upper(replace(gen_random_uuid()::text,'-',''));
   claims:=claims||jsonb_build_array(jsonb_build_object('identifier',btrim(v),'code',claim_code));
  end if;
  if existing_id is not null then
   update public.event_voter_list_entries set max_votes=p_max_votes,label=btrim(v),claim_code_hash=case when claim_code is not null then encode(sha256(convert_to(claim_code,'UTF8')),'hex') else claim_code_hash end where id=existing_id;
  else
  insert into public.event_voter_list_entries(event_id,identifier_hash,identifier_type,label,max_votes,created_by,claim_code_hash)
   values(p_event_id,encode(sha256(convert_to(n,'UTF8')),'hex'),p_identifier_type,btrim(v),p_max_votes,auth.uid(),case when claim_code is not null then encode(sha256(convert_to(claim_code,'UTF8')),'hex') end)
   on conflict(event_id,identifier_hash) do update set max_votes=excluded.max_votes,label=excluded.label;
  end if;
 end loop;
 select count(distinct private.normalize_voter_identifier(value,p_identifier_type))::integer into total from unnest(p_identifiers) value;
 return jsonb_build_object('count',total,'claims',claims);
end $$;
create function public.update_event_voter_limit(p_entry_id uuid,p_max_votes integer) returns void language plpgsql security definer set search_path='' as $$
declare r public.event_voter_list_entries;
begin
 select * into r from public.event_voter_list_entries where id=p_entry_id;
 perform 1 from public.events where id=r.event_id for update;
 select * into r from public.event_voter_list_entries where id=p_entry_id for update;
 if r.id is null or not private.can_manage_event(r.event_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if p_max_votes is null or p_max_votes not between 1 and 100 or p_max_votes<r.used_votes then raise exception 'Vote limit must be 1 to 100 and cover votes already used' using errcode='22023'; end if;
 update public.event_voter_list_entries set max_votes=p_max_votes where id=p_entry_id;
end $$;
create function public.remove_event_voter(p_entry_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.event_voter_list_entries;
begin
 select * into r from public.event_voter_list_entries where id=p_entry_id;
 perform 1 from public.events where id=r.event_id for update;
 select * into r from public.event_voter_list_entries where id=p_entry_id for update;
 if r.id is null or not private.can_manage_event(r.event_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if r.redeemed_at is not null or r.used_votes>0 then raise exception 'Redeemed voters must remain in the roster to preserve their vote history' using errcode='22023'; end if;
 if (select status from public.events where id=r.event_id) in ('pending_review','published','paused') and (select count(*) from public.event_voter_list_entries where event_id=r.event_id)<=1 then raise exception 'Keep at least one approved voter while this event is submitted or live' using errcode='22023'; end if;
 delete from public.event_voter_list_entries where id=p_entry_id;
end $$;
create function public.create_event_access_code(p_event_id uuid,p_code_hash text,p_max_redemptions integer) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events; code_id uuid;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if e.status not in ('draft','pending_review','published','paused') then raise exception 'This event cannot create access codes' using errcode='22023'; end if;
 if p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' or p_max_redemptions is null or p_max_redemptions not between 1 and 100000 then raise exception 'Invalid access code or redemption limit' using errcode='22023'; end if;
 insert into public.event_access_codes(event_id,code_hash,max_redemptions,created_by) values(p_event_id,p_code_hash,p_max_redemptions,auth.uid()) returning id into code_id;
 return code_id;
end $$;

-- Failed attempts return data so the rate-limit counter survives the request.
create function public.verify_event_voter_identifier(p_event_id uuid,p_identifier text,p_identifier_type text,p_claim_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.event_voter_list_entries; n text; u auth.users; e public.events;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.payment_rate_limit('roster:'||uid::text||':'||p_event_id::text,10,300) then return jsonb_build_object('error','Too many attempts. Try again in five minutes.'); end if;
 select * into e from public.events where id=p_event_id for share;
 if e.id is null or e.voting_mode<>'free' or e.verification_method<>'voter_list' or e.status<>'published' or e.ends_at<=now() then return jsonb_build_object('error','Voter-list verification is unavailable for this event.'); end if;
 if p_identifier_type is null or p_identifier_type not in ('email','phone','identifier') or p_identifier is null or char_length(p_identifier) not between 1 and 320 then return jsonb_build_object('error','Enter a valid voter identifier.'); end if;
 n:=private.normalize_voter_identifier(p_identifier,p_identifier_type);
 select * into u from auth.users where id=uid;
 if p_identifier_type='identifier' and not ((u.email is not null and u.email_confirmed_at is not null) or (u.phone is not null and u.phone_confirmed_at is not null)) then return jsonb_build_object('error','Confirm your sign-in email or phone before redeeming a voter identifier.'); end if;
 if (p_identifier_type='email' and (u.email_confirmed_at is null or lower(u.email) is distinct from n)) or (p_identifier_type='phone' and (u.phone_confirmed_at is null or private.normalize_voter_identifier(u.phone,'phone') is distinct from n)) then return jsonb_build_object('error','Sign in with the verified email or phone listed on the roster.'); end if;
 perform pg_advisory_xact_lock(hashtextextended('roster:'||uid::text||':'||p_event_id::text,0));
 select * into r from public.event_voter_list_entries l where l.event_id=p_event_id and l.identifier_type=p_identifier_type and (l.identifier_hash=encode(sha256(convert_to(n,'UTF8')),'hex') or (p_identifier_type='phone' and private.normalize_voter_identifier(l.label,'phone')=n)) order by l.redeemed_at nulls last,l.id limit 1 for update;
 if not found or (r.redeemed_by is not null and r.redeemed_by<>uid) or (p_identifier_type='identifier' and (r.claim_code_hash is null or r.claim_code_hash is distinct from encode(sha256(convert_to(upper(btrim(p_claim_code)),'UTF8')),'hex'))) then return jsonb_build_object('error','This identifier is unavailable or is not on the approved voter list.'); end if;
 if exists(select 1 from public.event_voter_list_entries where event_id=p_event_id and redeemed_by=uid and id<>r.id) then return jsonb_build_object('error','Your account already has an approved voter identifier for this event.'); end if;
 update public.event_voter_list_entries set redeemed_at=coalesce(redeemed_at,now()),redeemed_by=uid where id=r.id;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.redeem_event_voter_list_entry(uuid,text,text) from public,anon,authenticated;
create function public.verify_event_access_code(p_event_id uuid,p_code_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); c public.event_access_codes; r uuid;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=uid and ((email is not null and email_confirmed_at is not null) or (phone is not null and phone_confirmed_at is not null))) then return jsonb_build_object('error','Confirm your sign-in email or phone before redeeming an access code.'); end if;
 if not public.payment_rate_limit('access:'||uid::text||':'||p_event_id::text,10,300) then return jsonb_build_object('error','Too many attempts. Try again in five minutes.'); end if;
 perform 1 from public.events where id=p_event_id and status='published' and voting_mode='free' and verification_method='invite_code' and ends_at>now() for share;
 if not found then return jsonb_build_object('error','Access-code verification is unavailable for this event.'); end if;
 select * into c from public.event_access_codes where event_id=p_event_id and code_hash=p_code_hash for update;
 if not found or (c.expires_at is not null and c.expires_at<=now()) then return jsonb_build_object('error','Access code is invalid or expired.'); end if;
 select id into r from public.event_access_code_redemptions where access_code_id=c.id and voter_user_id=uid;
 if found then return jsonb_build_object('success',true); end if;
 if c.redemption_count>=c.max_redemptions then return jsonb_build_object('error','Access code has reached its limit.'); end if;
 insert into public.event_access_code_redemptions(access_code_id,voter_user_id) values(c.id,uid);
 update public.event_access_codes set redemption_count=redemption_count+1 where id=c.id;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.redeem_event_access_code(uuid,text) from public,anon,authenticated;
create or replace function private.enforce_private_vote_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare method text; entry_id uuid;
begin
 if new.payment_attempt_id is not null then return new; end if;
 select verification_method into method from public.events where id=new.event_id;
 if method in ('invite_code','voter_list') and not exists(select 1 from auth.users where id=new.voter_user_id and ((email is not null and email_confirmed_at is not null) or (phone is not null and phone_confirmed_at is not null))) then raise exception 'Confirm your sign-in email or phone before voting' using errcode='42501'; end if;
 if method='invite_code' then
  if not exists(select 1 from public.event_access_code_redemptions r join public.event_access_codes c on c.id=r.access_code_id where c.event_id=new.event_id and r.voter_user_id=new.voter_user_id and (c.expires_at is null or c.expires_at>now())) then raise exception 'Redeem an event access code before voting' using errcode='42501'; end if;
 elsif method='voter_list' then
  select id into entry_id from public.event_voter_list_entries where event_id=new.event_id and redeemed_by=new.voter_user_id and redeemed_at is not null order by redeemed_at,id limit 1 for update;
  update public.event_voter_list_entries set used_votes=used_votes+new.quantity where id=entry_id and used_votes+new.quantity<=max_votes returning id into entry_id;
  if not found then raise exception 'Your approved voter-list vote limit is exhausted or your identity is unverified' using errcode='42501'; end if;
 elsif method not in ('phone','email') then raise exception 'This verification method is unavailable' using errcode='42501'; end if;
 return new;
end $$;
create function public.get_event_verification_readiness(p_event_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.events; ready boolean:=false; message text;
begin
 select * into e from public.events where id=p_event_id;
 if not found or not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if e.voting_mode='paid' then ready:=true; message:='Paid voting does not require free-voter verification';
 elsif e.verification_method='voter_list' then select exists(select 1 from public.event_voter_list_entries where event_id=e.id and max_votes>used_votes) into ready; message:='Import at least one approved voter with votes available';
  if ready and exists(select 1 from public.event_voter_list_entries where event_id=e.id and identifier_type='phone') and not exists(select 1 from public.organization_sms_credits where organization_id=e.organization_id and balance>0) then ready:=false; message:='Add SMS credits so phone roster voters can verify their accounts'; end if;
 elsif e.verification_method='invite_code' then select exists(select 1 from public.event_access_codes where event_id=e.id and (expires_at is null or expires_at>now()) and (redemption_count<max_redemptions or redemption_count>0)) into ready; message:='Create at least one active private access code';
 elsif e.verification_method='phone' then select exists(select 1 from public.organization_sms_credits where organization_id=e.organization_id and balance>0) into ready; message:='Add SMS credits for phone verification';
 elsif e.verification_method='email' then ready:=true; message:='Voters must confirm their email';
 else message:='Select a supported voter verification method'; end if;
 return jsonb_build_object('ready',ready,'message',message,'method',e.verification_method);
end $$;
create function private.enforce_event_verification_readiness() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('pending_review','published') and new.status is distinct from old.status then
  if new.starts_at>=new.ends_at or new.ends_at<=now() then raise exception 'Choose valid voting dates that end in the future' using errcode='22023'; end if;
  if not exists(select 1 from public.categories where event_id=new.id and is_active) then raise exception 'Add an active category before submitting or publishing' using errcode='22023'; end if;
  if exists(select 1 from public.categories c where c.event_id=new.id and c.is_active and not exists(select 1 from public.nominees n where n.category_id=c.id and n.is_active)) then raise exception 'Every active category needs an active nominee' using errcode='22023'; end if;
  if new.voting_mode='paid' and not public.can_publish_paid_event(new.id) then raise exception 'Verify the organizer Paystack subaccount before publishing paid voting' using errcode='22023'; end if;
 end if;
 if new.status in ('pending_review','published') and new.status is distinct from old.status and new.voting_mode='free' then
  if new.verification_method='voter_list' and exists(select 1 from public.event_voter_list_entries where event_id=new.id and identifier_type='phone') and not exists(select 1 from public.organization_sms_credits where organization_id=new.organization_id and balance>0) then raise exception 'Add SMS credits so phone roster voters can verify their accounts' using errcode='22023'; end if;
  if new.verification_method='voter_list' and not exists(select 1 from public.event_voter_list_entries where event_id=new.id and max_votes>used_votes) then raise exception 'Import an approved voter list before submitting or publishing this event' using errcode='22023';
  elsif new.verification_method='invite_code' and not exists(select 1 from public.event_access_codes where event_id=new.id and (expires_at is null or expires_at>now()) and (redemption_count<max_redemptions or redemption_count>0)) then raise exception 'Create an active access code before submitting or publishing this event' using errcode='22023';
  elsif new.verification_method='phone' and not exists(select 1 from public.organization_sms_credits where organization_id=new.organization_id and balance>0) then raise exception 'Add SMS credits before publishing phone-verified voting' using errcode='22023';
  elsif new.verification_method not in ('phone','email','invite_code','voter_list') then raise exception 'Select a supported voter verification method' using errcode='22023'; end if;
 end if;
 return new;
end $$;
create trigger enforce_event_verification_readiness before update of status on public.events for each row execute function private.enforce_event_verification_readiness();
revoke all on function public.import_event_voters(uuid,text[],text,integer),public.update_event_voter_limit(uuid,integer),public.remove_event_voter(uuid),public.create_event_access_code(uuid,text,integer),public.verify_event_voter_identifier(uuid,text,text,text),public.verify_event_access_code(uuid,text),public.get_event_verification_readiness(uuid) from public,anon;
grant execute on function public.import_event_voters(uuid,text[],text,integer),public.update_event_voter_limit(uuid,integer),public.remove_event_voter(uuid),public.create_event_access_code(uuid,text,integer),public.verify_event_voter_identifier(uuid,text,text,text),public.verify_event_access_code(uuid,text),public.get_event_verification_readiness(uuid) to authenticated;
revoke all on function private.enforce_event_verification_readiness(),private.enforce_private_vote_identity() from public,anon,authenticated;
create or replace function public.set_event_status_before_lifecycle(p_event_id uuid, p_action text)
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
    if v_event.voting_mode = 'free' and v_event.verification_method = 'phone' and not exists(select 1 from public.organization_sms_credits where organization_id=v_event.organization_id and balance>0) then raise exception 'Add SMS credits before publishing free voting' using errcode='22023'; end if;
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

-- Migration: Comprehensive voter eligibility check RPC & multi-method free voting fixes
-- Supports: phone, email, invite_code, voter_list

create or replace function public.check_voter_event_eligibility(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_method text;
  v_voting_mode text;
  v_is_eligible boolean := false;
  v_phone_confirmed boolean := false;
  v_email_confirmed boolean := false;
  v_has_access_code boolean := false;
  v_has_voter_list boolean := false;
  v_voter_list_max integer := 0;
  v_voter_list_used integer := 0;
begin
  select e.verification_method, e.voting_mode into v_method, v_voting_mode
  from public.events e where e.id = p_event_id and e.status in ('published','paused','closed');

  if not found then
    return jsonb_build_object(
      'is_authenticated', false,
      'is_verified', false,
      'error', 'Event not found'
    );
  end if;

  if v_uid is null then
    return jsonb_build_object(
      'is_authenticated', false,
      'is_verified', false,
      'method', v_method
    );
  end if;

  select 
    (u.phone_confirmed_at is not null),
    (u.email_confirmed_at is not null)
  into v_phone_confirmed, v_email_confirmed
  from auth.users u where u.id = v_uid;

  if v_method = 'phone' then
    v_is_eligible := coalesce(v_phone_confirmed, false);
  elsif v_method = 'email' then
    v_is_eligible := coalesce(v_email_confirmed, false);
  elsif v_method = 'invite_code' then
    select exists (
      select 1 
      from public.event_access_code_redemptions r
      join public.event_access_codes c on c.id = r.access_code_id
      where c.event_id = p_event_id 
        and r.voter_user_id = v_uid
        and (c.expires_at is null or c.expires_at > now())
    ) into v_has_access_code;
    v_is_eligible := v_has_access_code and (coalesce(v_phone_confirmed,false) or coalesce(v_email_confirmed,false));
  elsif v_method = 'voter_list' then
    select 
      coalesce(max_votes, 0),
      coalesce(used_votes, 0)
    into v_voter_list_max, v_voter_list_used
    from public.event_voter_list_entries l
    where l.event_id = p_event_id 
      and l.redeemed_by = v_uid
      and l.redeemed_at is not null
    order by l.redeemed_at,l.id limit 1;

    if found and (v_voter_list_used < v_voter_list_max) then
      v_has_voter_list := true;
      v_is_eligible := coalesce(v_phone_confirmed,false) or coalesce(v_email_confirmed,false);
    elsif found then
      v_has_voter_list := true;
      v_is_eligible := false; -- Redeemed but votes exhausted
    else
      v_has_voter_list := false;
      v_is_eligible := false;
    end if;
  else
    v_is_eligible := false;
  end if;

  return jsonb_build_object(
    'is_authenticated', true,
    'is_verified', v_is_eligible,
    'method', v_method,
    'phone_confirmed', coalesce(v_phone_confirmed, false),
    'email_confirmed', coalesce(v_email_confirmed, false),
    'has_access_code', v_has_access_code,
    'has_voter_list', v_has_voter_list,
    'voter_list_max', v_voter_list_max,
    'voter_list_used', v_voter_list_used
  );
end $$;

revoke all on function public.check_voter_event_eligibility(uuid) from public, anon;
grant execute on function public.check_voter_event_eligibility(uuid) to anon, authenticated;

-- Update cast_free_votes to cleanly check identity matching the event's verification method
create or replace function public.cast_free_votes(
  p_event_id uuid,
  p_category_id uuid,
  p_nominee_id uuid,
  p_quantity integer,
  p_request_key uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_phone_confirmed_at timestamptz;
  v_email_confirmed_at timestamptz;
  v_event public.events%rowtype;
  v_used integer;
  v_batch_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select user_row.phone_confirmed_at, user_row.email_confirmed_at into v_phone_confirmed_at, v_email_confirmed_at
    from auth.users as user_row where user_row.id = v_user_id;

  if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Vote quantity must be from 1 to 100' using errcode = '22023'; end if;
  if p_request_key is null then raise exception 'Vote request key is required' using errcode = '22023'; end if;

  select * into v_event from public.events as event where event.id = p_event_id for share;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if v_event.status <> 'published' or now() < v_event.starts_at or now() >= v_event.ends_at then
    raise exception 'Voting is not open for this event' using errcode = '22023';
  end if;
  if v_event.voting_mode <> 'free' or v_event.free_vote_limit_per_phone is null then
    raise exception 'This event does not accept free votes' using errcode = '22023';
  end if;

  -- Method-specific identity check
  if v_event.verification_method = 'phone' then
    if v_phone_confirmed_at is null then
      raise exception 'Verify your phone number before voting' using errcode = '42501';
    end if;
  elsif v_event.verification_method = 'email' then
    if v_email_confirmed_at is null then
      raise exception 'Verify your email before voting' using errcode = '42501';
    end if;
  elsif v_event.verification_method in ('invite_code', 'voter_list') then
    -- Private identity verification is handled by trigger enforce_private_vote_identity
    null;
  else
    raise exception 'This verification method is unavailable' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.categories as category
    join public.nominees as nominee on nominee.category_id = category.id
    where category.id = p_category_id and category.event_id = p_event_id and category.is_active
      and nominee.id = p_nominee_id and nominee.is_active
  ) then raise exception 'Choose an active nominee in this event' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':' || p_event_id::text || ':' || p_category_id::text, 0));
  select batch.id into v_batch_id from public.vote_batches as batch
    where batch.voter_request_key = p_request_key;
  if found then
    if exists (select 1 from public.vote_batches as batch where batch.id = v_batch_id
      and batch.voter_user_id = v_user_id and batch.event_id = p_event_id
      and batch.category_id = p_category_id and batch.nominee_id = p_nominee_id
      and batch.quantity = p_quantity) then return v_batch_id; end if;
    raise exception 'Vote request key was already used' using errcode = '23505';
  end if;

  if v_event.voting_rule = 'per_nominee_limit' then
    select coalesce(sum(batch.quantity), 0)::integer into v_used
      from public.vote_batches as batch
      where batch.payment_attempt_id is null and batch.voter_user_id = v_user_id
        and batch.event_id = p_event_id and batch.category_id = p_category_id
        and batch.nominee_id = p_nominee_id;
  else
    select coalesce(sum(batch.quantity), 0)::integer into v_used
      from public.vote_batches as batch
      where batch.payment_attempt_id is null and batch.voter_user_id = v_user_id
        and batch.event_id = p_event_id and batch.category_id = p_category_id;
  end if;

  if v_used + p_quantity > v_event.free_vote_limit_per_phone then
    if v_event.voting_rule = 'per_nominee_limit' then
      raise exception 'You have reached the vote limit for this nominee' using errcode = '22023';
    else
      raise exception 'You have reached the vote limit for this category' using errcode = '22023';
    end if;
  end if;

  insert into public.vote_batches (
    event_id, category_id, nominee_id, quantity, voter_user_id, voter_request_key,
    payment_attempt_id
  ) values (
    p_event_id, p_category_id, p_nominee_id, p_quantity, v_user_id, p_request_key,
    null
  ) returning id into v_batch_id;

  insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata) values(v_event.organization_id,v_user_id,'free_votes_cast','vote_batch',v_batch_id::text,jsonb_build_object('event_id',p_event_id,'category_id',p_category_id,'nominee_id',p_nominee_id,'quantity',p_quantity));
  return v_batch_id;
end $$;

revoke all on function public.cast_free_votes(uuid, uuid, uuid, integer, uuid) from public, anon;
grant execute on function public.cast_free_votes(uuid, uuid, uuid, integer, uuid) to authenticated;
