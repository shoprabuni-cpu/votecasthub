-- Import one spreadsheet in a single transaction. A rejected row rolls back all rows.
create or replace function public.import_event_categories_nominees(p_event_id uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_row jsonb;
  v_category uuid;
  v_count integer := 0;
begin
  select organization_id into v_org from public.events where id = p_event_id and status = 'draft' for update;
  if not found then raise exception 'Draft event not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_org) then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Invalid import' using errcode = '22023'; end if;
  if jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Import must contain 1 to 1000 rows' using errcode = '22023'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if char_length(btrim(coalesce(v_row->>'category',''))) not between 1 and 120
      or char_length(btrim(coalesce(v_row->>'nominee',''))) not between 1 and 160
      or char_length(coalesce(v_row->>'categoryDescription','')) > 2000
      or char_length(coalesce(v_row->>'biography','')) > 3000
      or char_length(coalesce(v_row->>'publicCode','')) > 32
      or coalesce(v_row->>'publicCode','') !~ '^[A-Za-z0-9-]*$'
    then raise exception 'Invalid import row' using errcode = '22023'; end if;
    select id into v_category from public.categories
      where event_id = p_event_id and lower(btrim(name)) = lower(btrim(v_row->>'category'));
    if not found then
      v_category := public.add_event_category(p_event_id, v_row->>'category', v_row->>'categoryDescription', null);
    end if;
    perform public.add_category_nominee(v_category, v_row->>'nominee', v_row->>'publicCode', v_row->>'biography', null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.import_event_categories_nominees(uuid,jsonb) from public, anon;
grant execute on function public.import_event_categories_nominees(uuid,jsonb) to authenticated;
