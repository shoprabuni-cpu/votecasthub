-- Give organizers enforceable, selectable voting rules and validate publication
-- in the database so a forged form submission cannot bypass the checklist.

alter table public.events
  add column voting_rule text not null default 'category_limit'
    check (voting_rule in ('one_per_category', 'category_limit', 'per_nominee_limit'));

grant select (voting_rule) on public.events to anon, authenticated;

-- Keep the organization event read RPC's returned row aligned with the new field.
drop function public.get_organization_events(uuid);
create function public.get_organization_events(p_organization_id uuid)
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
  where event.organization_id = p_organization_id
    and private.is_org_member(p_organization_id)
  order by event.created_at desc;
$$;
revoke execute on function public.get_organization_events(uuid) from public, anon, authenticated;
grant execute on function public.get_organization_events(uuid) to authenticated;

-- Add overloads instead of removing the existing RPC signatures. Existing
-- callers default to the category-wide cap; the current app passes voting_rule.
create function public.create_event(
  p_organization_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_unit_price_minor bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_results_visibility text,
  p_voting_mode text,
  p_free_vote_limit_per_phone smallint,
  p_voting_rule text,
  p_voting_rules text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_user_id uuid := (select auth.uid());
begin
  if coalesce(p_voting_rule, '') not in ('one_per_category', 'category_limit', 'per_nominee_limit') then
    raise exception 'Choose a valid voting rule' using errcode = '22023';
  end if;
  if p_voting_mode = 'free' and p_voting_rule = 'one_per_category'
     and p_free_vote_limit_per_phone is distinct from 1 then
    raise exception 'One vote per category must use a limit of one' using errcode = '22023';
  end if;

  v_event_id := public.create_event(
    p_organization_id, p_name, p_slug, p_description, p_unit_price_minor,
    p_starts_at, p_ends_at, p_results_visibility, p_voting_mode,
    p_free_vote_limit_per_phone, p_voting_rules
  );
  update public.events set voting_rule = p_voting_rule where id = v_event_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_organization_id, v_user_id, 'event_voting_rule_selected', 'event', v_event_id::text,
          jsonb_build_object('voting_mode', p_voting_mode, 'voting_rule', p_voting_rule,
                             'limit', p_free_vote_limit_per_phone));
  return v_event_id;
end;
$$;
revoke execute on function public.create_event(uuid, text, text, text, bigint, timestamptz, timestamptz, text, text, smallint, text, text) from public, anon, authenticated;
grant execute on function public.create_event(uuid, text, text, text, bigint, timestamptz, timestamptz, text, text, smallint, text, text) to authenticated;

create function public.update_event_draft(
  p_event_id uuid,
  p_name text,
  p_description text,
  p_unit_price_minor bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_results_visibility text,
  p_voting_mode text,
  p_free_vote_limit_per_phone smallint,
  p_voting_rule text,
  p_voting_rules text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_organization_id uuid;
  v_user_id uuid := (select auth.uid());
begin
  if coalesce(p_voting_rule, '') not in ('one_per_category', 'category_limit', 'per_nominee_limit') then
    raise exception 'Choose a valid voting rule' using errcode = '22023';
  end if;
  if p_voting_mode = 'free' and p_voting_rule = 'one_per_category'
     and p_free_vote_limit_per_phone is distinct from 1 then
    raise exception 'One vote per category must use a limit of one' using errcode = '22023';
  end if;

  perform public.update_event_draft(
    p_event_id, p_name, p_description, p_unit_price_minor, p_starts_at,
    p_ends_at, p_results_visibility, p_voting_mode,
    p_free_vote_limit_per_phone, p_voting_rules
  );
  update public.events set voting_rule = p_voting_rule
    where id = p_event_id returning organization_id into v_organization_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_organization_id, v_user_id, 'event_voting_rule_updated', 'event', p_event_id::text,
          jsonb_build_object('voting_mode', p_voting_mode, 'voting_rule', p_voting_rule,
                             'limit', p_free_vote_limit_per_phone));
end;
$$;
revoke execute on function public.update_event_draft(uuid, text, text, bigint, timestamptz, timestamptz, text, text, smallint, text, text) from public, anon, authenticated;
grant execute on function public.update_event_draft(uuid, text, text, bigint, timestamptz, timestamptz, text, text, smallint, text, text) to authenticated;

-- Apply the selected per-category or per-nominee cap inside the vote transaction.
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
  v_event public.events%rowtype;
  v_used integer;
  v_batch_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select user_row.phone_confirmed_at into v_phone_confirmed_at
    from auth.users as user_row where user_row.id = v_user_id;
  if v_phone_confirmed_at is null then raise exception 'Verify your phone number before voting' using errcode = '42501'; end if;
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
      raise exception 'This verified phone has reached the vote limit for this nominee' using errcode = '22023';
    end if;
    raise exception 'This verified phone has reached the vote limit for this category' using errcode = '22023';
  end if;

  insert into public.vote_batches (payment_attempt_id, event_id, category_id, nominee_id, voter_user_id, voter_request_key, quantity)
  values (null, p_event_id, p_category_id, p_nominee_id, v_user_id, p_request_key, p_quantity)
  returning id into v_batch_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_event.organization_id, v_user_id, 'free_votes_cast', 'vote_batch', v_batch_id::text,
    jsonb_build_object('event_id', p_event_id, 'category_id', p_category_id, 'nominee_id', p_nominee_id, 'quantity', p_quantity));
  return v_batch_id;
end;
$$;
revoke execute on function public.cast_free_votes(uuid, uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.cast_free_votes(uuid, uuid, uuid, integer, uuid) to authenticated;

-- Publication is a database-enforced preflight; paid events remain drafts until
-- a real payment checkout/webhook is configured and verified.
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
    if v_event.voting_mode <> 'free' then
      raise exception 'Paid voting cannot be published until payment checkout is enabled' using errcode = '22023';
    end if;
    if v_event.voting_rule = 'one_per_category' and v_event.free_vote_limit_per_phone <> 1 then
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
