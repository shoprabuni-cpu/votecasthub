-- Organizers explicitly choose a public help address; account emails stay private.
alter table public.events add column voter_help_email text
  check (voter_help_email is null or (char_length(voter_help_email) <= 254 and voter_help_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));

create function public.set_event_voter_help(p_event_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.events;
begin
  select * into e from public.events where id = p_event_id for update;
  if e.id is null or not private.can_manage_org(e.organization_id) then
    raise exception 'You cannot manage this event.' using errcode = '42501';
  end if;
  perform private.require_active_organization(e.organization_id);
  update public.events set voter_help_email = nullif(lower(btrim(p_email)), '') where id = p_event_id;
end;
$$;
revoke all on function public.set_event_voter_help(uuid,text) from public, anon;
grant execute on function public.set_event_voter_help(uuid,text) to authenticated;
