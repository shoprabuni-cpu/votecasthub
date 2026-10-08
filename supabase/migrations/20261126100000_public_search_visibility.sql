-- Public search data never inherits organizer/admin privileges.
create function private.searchable_events()
returns setof public.events language sql stable security definer set search_path='' as $$
 select e.* from public.events e join public.organizations o on o.id=e.organization_id
 where e.status in ('published','paused','closed') and e.admin_approved and e.purged_at is null
  and o.moderation_status='active' and o.archived_at is null
  and not exists(select 1 from public.admin_deletion_jobs j where j.status='pending'
   and ((j.target_kind='event' and j.target_id=e.id) or (j.target_kind='organization' and j.target_id=o.id)));
$$;
revoke all on function private.searchable_events() from public,anon,authenticated;

create function public.get_public_search_pages(p_offset integer default 0,p_limit integer default 1000)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>1000 then
  raise exception 'Invalid sitemap page' using errcode='22023';
 end if;
 with eligible as materialized (select * from private.searchable_events()), pages as (
  select '/events/'||e.slug path,e.updated_at from eligible e
  union all
  select '/events/'||e.slug||'/nominees/'||n.id,greatest(e.updated_at,c.updated_at,n.updated_at)
   from eligible e join public.categories c on c.event_id=e.id and c.is_active
   join public.nominees n on n.category_id=c.id and n.is_active
 ) select jsonb_build_object('total',(select count(*) from pages),'pages',coalesce((select jsonb_agg(to_jsonb(p) order by p.path)
  from (select * from pages order by path limit p_limit offset p_offset) p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.get_public_search_pages(integer,integer) from public;
grant execute on function public.get_public_search_pages(integer,integer) to anon,authenticated;

create function public.get_public_search_metadata(p_slug text,p_nominee_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when p_nominee_id is null then jsonb_build_object('name',e.name,'description',e.description,'event_name',e.name,'path','/events/'||e.slug)
  else (select jsonb_build_object('name',n.name,'description',n.biography,'event_name',e.name,'path','/events/'||e.slug||'/nominees/'||n.id)
   from public.nominees n join public.categories c on c.id=n.category_id
   where n.id=p_nominee_id and n.is_active and c.is_active and c.event_id=e.id) end
 from private.searchable_events() e where e.slug=p_slug;
$$;
revoke all on function public.get_public_search_metadata(text,uuid) from public;
grant execute on function public.get_public_search_metadata(text,uuid) to anon,authenticated;
