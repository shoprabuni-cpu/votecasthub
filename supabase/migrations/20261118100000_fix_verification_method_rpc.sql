-- Fix variable name ambiguity in set_event_verification_method
create or replace function public.set_event_verification_method(p_event_id uuid, p_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org_id uuid;
  v_status text;
begin
  if p_method not in ('phone', 'email', 'invite_code', 'voter_list') then
    raise exception 'Invalid verification method' using errcode = '22023';
  end if;

  select e.organization_id, e.status into v_org_id, v_status
  from public.events e
  where e.id = p_event_id
  for update;

  if not found or not private.can_manage_org(v_org_id) then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;

  if v_status <> 'draft' then
    raise exception 'Verification method can only be changed while the event is a draft' using errcode = '22023';
  end if;

  update public.events set verification_method = p_method, updated_at = now() where id = p_event_id;
end $$;

revoke all on function public.set_event_verification_method(uuid, text) from public, anon;
grant execute on function public.set_event_verification_method(uuid, text) to authenticated;
