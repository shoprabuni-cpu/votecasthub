-- Allow organizers to toggle live results visibility during active events.
create or replace function public.update_event_details_before_opening_guard(
  p_event_id uuid,
  p_name text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_results_visibility text,
  p_voting_rules text
) returns void language plpgsql security definer set search_path='' as $$
declare
  e public.events;
begin
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_org(e.organization_id) then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;
  if lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g')) is distinct from lower(regexp_replace(btrim(e.name), '\s+', ' ', 'g')) then
    raise exception 'Published event names are protected. Submit a spelling correction for review' using errcode = '22023';
  end if;
  if e.starts_at <= now() or private.event_has_activity(e.id) or e.status = 'closed' then
    -- Results visibility is intentionally allowed to be changed live by the organizer (e.g., to build suspense during finals or reveal results)
    if coalesce(nullif(btrim(p_voting_rules), ''), '') <> coalesce(e.voting_rules, '') then
      raise exception 'Voter instructions are locked. Submit a correction or clarification for review' using errcode = '22023';
    end if;
  end if;
  if e.status = 'closed' and coalesce(nullif(btrim(p_description), ''), '') <> coalesce(e.description, '') then
    raise exception 'Closed event descriptions require a correction review' using errcode = '22023';
  end if;
  if e.ends_at <= now() and p_ends_at is distinct from e.ends_at then
    raise exception 'Use Reopen voting with a public reason instead of silently changing an expired deadline' using errcode = '22023';
  end if;

  perform public.update_event_details_before_fairness(
    p_event_id, p_name, p_description, p_starts_at, p_ends_at, p_results_visibility, p_voting_rules
  );

  if p_ends_at is distinct from e.ends_at then
    insert into public.event_notices(event_id, kind, message, previous_deadline, new_deadline)
    values(e.id, 'extension', 'The organizer extended the voting deadline. Existing votes and voting limits are unchanged.', e.ends_at, p_ends_at);
  end if;
  if p_starts_at is distinct from e.starts_at then
    insert into public.event_notices(event_id, kind, message)
    values(e.id, 'schedule', 'The organizer updated the voting opening time.');
  end if;
  if nullif(btrim(p_description), '') is distinct from e.description then
    insert into public.event_notices(event_id, kind, message)
    values(e.id, 'correction', 'The organizer updated the event description. Recorded votes and voting limits remain unchanged.');
  end if;
  if p_results_visibility is distinct from e.results_visibility then
    insert into public.event_notices(event_id, kind, message)
    values(e.id, 'correction', 'The organizer updated live results visibility to ' || replace(p_results_visibility, '_', ' ') || '.');
  end if;
end $$;
