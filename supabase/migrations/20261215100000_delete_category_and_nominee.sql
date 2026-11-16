-- Add delete functions for categories and nominees
-- Allows organizers to remove entries created by mistake before votes are counted

create or replace function public.delete_category_nominee(p_nominee_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_nominee public.nominees%rowtype;
  v_category public.categories%rowtype;
  v_event public.events%rowtype;
  v_votes_exist boolean;
begin
  select * into v_nominee from public.nominees where id = p_nominee_id for update;
  if not found then raise exception 'Nominee not found' using errcode = 'P0002'; end if;

  select * into v_category from public.categories where id = v_nominee.category_id for update;
  if not found then raise exception 'Category not found' using errcode = 'P0002'; end if;

  select * into v_event from public.events where id = v_category.event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;

  if not private.can_manage_org(v_event.organization_id) then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;

  -- Check if votes have already been cast for this nominee
  select exists(select 1 from public.vote_batches where nominee_id = p_nominee_id) into v_votes_exist;
  if v_votes_exist then
    raise exception 'Cannot delete a nominee that has already received votes. Set their visibility to hidden instead.' using errcode = '22023';
  end if;

  -- Clear any active chat sessions targeting this nominee
  update public.whatsapp_sessions set nominee_id = null where nominee_id = p_nominee_id;
  update public.telegram_sessions set nominee_id = null where nominee_id = p_nominee_id;

  delete from public.nominees where id = p_nominee_id;

  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_event.organization_id, (select auth.uid()), 'category_nominee_deleted', 'nominee', p_nominee_id::text,
    jsonb_build_object('nominee_name', v_nominee.name, 'category_id', v_category.id, 'event_id', v_event.id));
end;
$$;

revoke execute on function public.delete_category_nominee(uuid) from public, anon, authenticated;
grant execute on function public.delete_category_nominee(uuid) to authenticated;

create or replace function public.delete_event_category(p_category_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_category public.categories%rowtype;
  v_event public.events%rowtype;
  v_votes_exist boolean;
begin
  select * into v_category from public.categories where id = p_category_id for update;
  if not found then raise exception 'Category not found' using errcode = 'P0002'; end if;

  select * into v_event from public.events where id = v_category.event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;

  if not private.can_manage_org(v_event.organization_id) then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;

  -- Check if votes have already been cast for any nominee in this category
  select exists(select 1 from public.vote_batches where category_id = p_category_id) into v_votes_exist;
  if v_votes_exist then
    raise exception 'Cannot delete a category that has already received votes. Set its visibility to hidden instead.' using errcode = '22023';
  end if;

  -- Clear any active chat sessions targeting this category
  update public.whatsapp_sessions set nominee_id = null, category_id = null where category_id = p_category_id;
  update public.telegram_sessions set nominee_id = null, category_id = null where category_id = p_category_id;

  -- Delete all nominees in this category first (since foreign key is restrict)
  delete from public.nominees where category_id = p_category_id;
  delete from public.categories where id = p_category_id;

  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_event.organization_id, (select auth.uid()), 'event_category_deleted', 'category', p_category_id::text,
    jsonb_build_object('category_name', v_category.name, 'event_id', v_event.id));
end;
$$;

revoke execute on function public.delete_event_category(uuid) from public, anon, authenticated;
grant execute on function public.delete_event_category(uuid) to authenticated;
