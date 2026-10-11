-- Restore the admin organizer listing without depending on organizer membership.
create or replace function public.get_admin_organizations()
returns table(id uuid,name text,moderation_status text,event_count bigint,paystack_status text,paystack_verified boolean)
language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
 if not private.is_platform_admin() then
  raise exception 'Platform admin access required' using errcode='42501';
 end if;
 return query
 select o.id,o.name,o.moderation_status,
  (select count(*) from public.events e where e.organization_id=o.id and e.purged_at is null),
  coalesce(a.status,'not_connected'),coalesce(a.paystack_verified,false)
 from public.organizations o
 left join public.organization_paystack_accounts a on a.organization_id=o.id
 where o.purged_at is null
 order by o.created_at desc,o.id
 limit 500;
end $$;
revoke all on function public.get_admin_organizations() from public,anon;
grant execute on function public.get_admin_organizations() to authenticated;
