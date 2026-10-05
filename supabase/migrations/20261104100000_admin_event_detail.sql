create or replace function public.get_admin_event_detail(p_event_id uuid)
returns table(event_id uuid,event_name text,event_status text,voting_mode text,starts_at timestamptz,ends_at timestamptz,description text,organization_id uuid,organization_name text,category_id uuid,category_name text,category_active boolean,nominee_id uuid,nominee_name text,nominee_active boolean,image_path text)
language sql stable security definer set search_path='' as $$
 select e.id,e.name,e.status,e.voting_mode,e.starts_at,e.ends_at,e.description,o.id,o.name,c.id,c.name,c.is_active,n.id,n.name,n.is_active,n.image_path
 from public.events e join public.organizations o on o.id=e.organization_id
 left join public.categories c on c.event_id=e.id
 left join public.nominees n on n.category_id=c.id
 where e.id=p_event_id and exists(select 1 from public.platform_admins p where p.user_id=auth.uid() and p.is_active)
 order by c.display_order nulls last,n.display_order nulls last;
$$;
revoke all on function public.get_admin_event_detail(uuid) from public,anon;
grant execute on function public.get_admin_event_detail(uuid) to authenticated;
