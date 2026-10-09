-- Voting credentials authorize ballots without an unrelated account login.
create or replace function public.verify_event_voter_identifier(p_event_id uuid,p_identifier text,p_identifier_type text,p_claim_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.event_voter_list_entries; n text; u auth.users; e public.events;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.payment_rate_limit('roster:'||uid::text||':'||p_event_id::text,10,300) then return jsonb_build_object('error','Too many attempts. Try again in five minutes.'); end if;
 select * into e from public.events where id=p_event_id for share;
 if e.id is null or e.voting_mode<>'free' or e.verification_method<>'voter_list' or e.status<>'published' or e.ends_at<=now() then return jsonb_build_object('error','Voter-list verification is unavailable for this event.'); end if;
 if p_identifier_type is null or p_identifier_type not in ('email','phone','identifier') or p_identifier is null or char_length(p_identifier) not between 1 and 320 then return jsonb_build_object('error','Enter a valid voter identifier.'); end if;
 n:=private.normalize_voter_identifier(p_identifier,p_identifier_type);
 select * into u from auth.users where id=uid;
 if (p_identifier_type='email' and (u.email_confirmed_at is null or lower(u.email) is distinct from n)) or (p_identifier_type='phone' and (u.phone_confirmed_at is null or private.normalize_voter_identifier(u.phone,'phone') is distinct from n)) then return jsonb_build_object('error','Verify the email or phone listed on the voter list.'); end if;
 perform pg_advisory_xact_lock(hashtextextended('roster:'||uid::text||':'||p_event_id::text,0));
 select * into r from public.event_voter_list_entries l where l.event_id=p_event_id and l.identifier_type=p_identifier_type and (l.identifier_hash=encode(sha256(convert_to(n,'UTF8')),'hex') or (p_identifier_type='phone' and private.normalize_voter_identifier(l.label,'phone')=n)) order by l.redeemed_at nulls last,l.id limit 1 for update;
 if not found or (r.redeemed_by is not null and r.redeemed_by<>uid) or (p_identifier_type='identifier' and (r.claim_code_hash is null or r.claim_code_hash is distinct from encode(sha256(convert_to(upper(btrim(p_claim_code)),'UTF8')),'hex'))) then return jsonb_build_object('error','This identifier is unavailable or is not on the approved voter list.'); end if;
 if exists(select 1 from public.event_voter_list_entries where event_id=p_event_id and redeemed_by=uid and id<>r.id) then return jsonb_build_object('error','Your account already has an approved voter identifier for this event.'); end if;
 update public.event_voter_list_entries set redeemed_at=coalesce(redeemed_at,now()),redeemed_by=uid where id=r.id;
 return jsonb_build_object('success',true);
end $$;

create or replace function public.verify_event_access_code(p_event_id uuid,p_code_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); c public.event_access_codes; r uuid;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
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

create or replace function private.enforce_private_vote_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare method text; entry_id uuid;
begin
 if new.payment_attempt_id is not null then return new; end if;
 select verification_method into method from public.events where id=new.event_id;
 if method='invite_code' then
  if not exists(select 1 from public.event_access_code_redemptions r join public.event_access_codes c on c.id=r.access_code_id where c.event_id=new.event_id and r.voter_user_id=new.voter_user_id and (c.expires_at is null or c.expires_at>now())) then raise exception 'Redeem an event access code before voting' using errcode='42501'; end if;
 elsif method='voter_list' then
  select id into entry_id from public.event_voter_list_entries where event_id=new.event_id and redeemed_by=new.voter_user_id and redeemed_at is not null order by redeemed_at,id limit 1 for update;
  update public.event_voter_list_entries set used_votes=used_votes+new.quantity where id=entry_id and used_votes+new.quantity<=max_votes returning id into entry_id;
  if not found then raise exception 'Your approved voter-list vote limit is exhausted or your identity is unverified' using errcode='42501'; end if;
 elsif method not in ('phone','email') then raise exception 'This verification method is unavailable' using errcode='42501'; end if;
 return new;
end $$;

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
    v_is_eligible := v_has_access_code;
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
      v_is_eligible := true;
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

create or replace function public.create_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists(select 1 from auth.users where id=v_user_id and (email_confirmed_at is not null or phone_confirmed_at is not null)) then
    raise exception 'Verify an organizer account before creating an organization' using errcode='42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Organization name must be between 2 and 120 characters' using errcode = '22023';
  end if;
  if char_length(v_slug) > 80 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Organization slug is invalid' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (v_name, v_slug, v_user_id)
  on conflict (slug) do nothing
  returning id into v_organization_id;
  if v_organization_id is null then
    raise exception 'Organization slug is already in use' using errcode = '23505';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_organization_id, v_user_id, 'owner');
  return v_organization_id;
end;
$$;

-- Only the server can probe eligibility before an OTP or background session.
create function public.prepare_event_voter_verification(p_event_id uuid,p_identifier_type text,p_identifier text,p_claim_code text default null,p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events; r public.event_voter_list_entries; c public.event_access_codes; n text;
begin
 select * into e from private.searchable_events() where id=p_event_id;
 if e.id is null or e.status<>'published' or e.voting_mode<>'free' or now()<e.starts_at or now()>=e.ends_at then return jsonb_build_object('error','Voting is not open for this event.'); end if;
 if p_identifier is null or char_length(p_identifier) not between 1 and 320 or p_identifier_type is null or p_identifier_type not in ('email','phone','identifier','invite_code') then return jsonb_build_object('error','Enter valid voting details.'); end if;
 if e.verification_method in ('email','phone') then
  if p_identifier_type<>e.verification_method then return jsonb_build_object('error','Use the verification method selected for this event.'); end if;
 elsif e.verification_method='voter_list' then
  n:=private.normalize_voter_identifier(p_identifier,p_identifier_type);
  select * into r from public.event_voter_list_entries l where l.event_id=e.id and l.identifier_type=p_identifier_type and (l.identifier_hash=encode(sha256(convert_to(n,'UTF8')),'hex') or (p_identifier_type='phone' and private.normalize_voter_identifier(l.label,'phone')=n)) order by l.redeemed_at nulls last,l.id limit 1;
  if r.id is null then return jsonb_build_object('error','These details are not on the approved voter list. Contact the organizer if this is unexpected.'); end if;
  if p_identifier_type='identifier' and (r.claim_code_hash is null or r.claim_code_hash is distinct from encode(sha256(convert_to(upper(btrim(p_claim_code)),'UTF8')),'hex')) then return jsonb_build_object('error','The index number or private code is incorrect. Check the details provided by your organizer.'); end if;
  if p_identifier_type='identifier' and r.redeemed_by is not null and r.redeemed_by is distinct from p_user_id then return jsonb_build_object('error','This voter entry has already been activated in another session. Use your original browser or contact the organizer.'); end if;
  if r.used_votes>=r.max_votes then return jsonb_build_object('error','Your available votes have been used.'); end if;
 elsif e.verification_method='invite_code' then
  if p_identifier_type<>'invite_code' then return jsonb_build_object('error','Enter your private voting code.'); end if;
  select * into c from public.event_access_codes where event_id=e.id and code_hash=encode(sha256(convert_to(upper(btrim(p_identifier)),'UTF8')),'hex');
  if c.id is null or (c.expires_at is not null and c.expires_at<=now()) then return jsonb_build_object('error','This voting code is invalid or expired.'); end if;
  if c.redemption_count>=c.max_redemptions and not exists(select 1 from public.event_access_code_redemptions where access_code_id=c.id and voter_user_id=p_user_id) then return jsonb_build_object('error','This voting code has already reached its allowance.'); end if;
 else return jsonb_build_object('error','Verification is unavailable.'); end if;
 return jsonb_build_object('success',true,'slug',e.slug,'method',e.verification_method);
end $$;
revoke all on function public.prepare_event_voter_verification(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.prepare_event_voter_verification(uuid,text,text,text,uuid) to service_role;

-- Expose input types only, never roster values or credential hashes.
create function public.get_event_voter_input_types(p_event_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(distinct l.identifier_type),'[]'::jsonb) from public.event_voter_list_entries l join private.searchable_events() e on e.id=l.event_id where e.id=p_event_id and e.verification_method='voter_list';
$$;
revoke all on function public.get_event_voter_input_types(uuid) from public;
grant execute on function public.get_event_voter_input_types(uuid) to anon,authenticated;
