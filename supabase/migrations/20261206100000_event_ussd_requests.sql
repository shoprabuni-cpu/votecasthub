create table public.event_ussd_requests (
  event_id uuid primary key references public.events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  status text not null check (status in ('requested', 'cancelled')),
  requested_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.event_ussd_requests enable row level security;
revoke all on public.event_ussd_requests from public, anon, authenticated;
grant select on public.event_ussd_requests to authenticated;
grant all on public.event_ussd_requests to service_role;
create policy ussd_request_read on public.event_ussd_requests for select to authenticated
using (private.is_org_member(organization_id) or exists (
  select 1 from public.platform_admins where user_id = (select auth.uid()) and is_active
));

create function public.request_event_ussd(p_event_id uuid, p_requested boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.events%rowtype;
begin
  select * into e from public.events where id=p_event_id for update;
  if not found or not private.can_manage_org(e.organization_id) then raise exception 'Event access denied' using errcode='42501'; end if;
  if e.purged_at is not null or e.status in ('closed','archived') or e.ends_at <= now() then
    raise exception 'USSD requests are unavailable for ended events' using errcode='22023';
  end if;
  if p_requested is null then raise exception 'Choose a request option' using errcode='22023'; end if;
  insert into public.event_ussd_requests(event_id,organization_id,status,requested_by)
  values(e.id,e.organization_id,case when p_requested then 'requested' else 'cancelled' end,auth.uid())
  on conflict(event_id) do update set status=excluded.status,requested_by=excluded.requested_by,updated_at=now();
end $$;
revoke all on function public.request_event_ussd(uuid,boolean) from public,anon;
grant execute on function public.request_event_ussd(uuid,boolean) to authenticated;
