-- Keep direct RPC calls consistent with the organizer editor when activity exists.
alter function public.update_event_details(uuid,text,text,timestamptz,timestamptz,text,text)
  rename to update_event_details_before_opening_guard;
revoke all on function public.update_event_details_before_opening_guard(uuid,text,text,timestamptz,timestamptz,text,text)
  from public,anon,authenticated,service_role;

create function public.update_event_details(
  p_event_id uuid,p_name text,p_description text,p_starts_at timestamptz,
  p_ends_at timestamptz,p_results_visibility text,p_voting_rules text
) returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
  select * into e from public.events where id=p_event_id for update;
  if not found then raise exception 'Event not found' using errcode='P0002'; end if;
  if not private.can_manage_org(e.organization_id) then
    raise exception 'Organization access denied' using errcode='42501';
  end if;
  if p_starts_at is distinct from e.starts_at and private.event_has_activity(e.id) then
    raise exception 'The opening time is locked because this event has votes or payment attempts' using errcode='22023';
  end if;
  perform public.update_event_details_before_opening_guard(
    p_event_id,p_name,p_description,p_starts_at,p_ends_at,p_results_visibility,p_voting_rules
  );
end $$;
revoke all on function public.update_event_details(uuid,text,text,timestamptz,timestamptz,text,text) from public,anon;
grant execute on function public.update_event_details(uuid,text,text,timestamptz,timestamptz,text,text) to authenticated;
