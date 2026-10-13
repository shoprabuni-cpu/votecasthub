alter table public.event_ussd_requests drop constraint event_ussd_requests_status_check;
alter table public.event_ussd_requests add constraint event_ussd_requests_status_check check(status in ('requested','cancelled','quoted','accepted'));
alter table public.event_ussd_requests
 add column quote_id uuid,
 add column amount_minor integer check(amount_minor > 0),
 add column terms text,
 add column valid_until timestamptz,
 add column quoted_by uuid references auth.users(id),
 add column accepted_by uuid references auth.users(id),
 add column accepted_at timestamptz;

create function public.quote_event_ussd(p_event_id uuid,p_amount_minor integer,p_terms text,p_valid_until timestamptz)
returns void language plpgsql security definer set search_path='' as $body$
declare e public.events%rowtype; r public.event_ussd_requests%rowtype;
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active) then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into e from public.events where id=p_event_id for update;
 if not found or e.purged_at is not null or e.status in ('closed','archived') or e.ends_at<=now() or not private.organization_is_active(e.organization_id) then raise exception 'Event unavailable' using errcode='22023'; end if;
 select * into r from public.event_ussd_requests where event_id=p_event_id for update;
 if not found or r.status not in ('requested','quoted') then raise exception 'Request cannot be quoted' using errcode='22023'; end if;
 if p_amount_minor is null or p_amount_minor<1 or p_amount_minor>100000000 or p_terms is null or char_length(trim(p_terms)) not between 20 and 3000 or p_valid_until is null or p_valid_until<=now() or p_valid_until>e.ends_at then raise exception 'Check price, terms and expiry' using errcode='22023'; end if;
 update public.event_ussd_requests set status='quoted',quote_id=gen_random_uuid(),amount_minor=p_amount_minor,terms=trim(p_terms),valid_until=p_valid_until,quoted_by=auth.uid(),accepted_by=null,accepted_at=null,updated_at=now() where event_id=p_event_id;
end $body$;

create function public.accept_event_ussd_quote(p_event_id uuid,p_quote_id uuid)
returns void language plpgsql security definer set search_path='' as $body$
declare e public.events%rowtype; r public.event_ussd_requests%rowtype;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or not private.can_manage_org(e.organization_id) or not exists(select 1 from public.organization_members where organization_id=e.organization_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Owner or admin access required' using errcode='42501'; end if;
 if e.purged_at is not null or e.status in ('closed','archived') or e.ends_at<=now() then raise exception 'Event unavailable' using errcode='22023'; end if;
 select * into r from public.event_ussd_requests where event_id=p_event_id for update;
 if not found or r.quote_id is distinct from p_quote_id or p_quote_id is null then raise exception 'Quote changed. Refresh before accepting' using errcode='22023'; end if;
 if r.status='accepted' then return; end if;
 if r.status<>'quoted' or r.valid_until<=now() then raise exception 'Quote expired or unavailable' using errcode='22023'; end if;
 update public.event_ussd_requests set status='accepted',accepted_at=now(),accepted_by=auth.uid(),updated_at=now() where event_id=p_event_id;
end $body$;

create or replace function public.request_event_ussd(p_event_id uuid,p_requested boolean)
returns void language plpgsql security definer set search_path='' as $body$
declare e public.events%rowtype; r public.event_ussd_requests%rowtype;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or not private.can_manage_org(e.organization_id) then raise exception 'Event access denied' using errcode='42501'; end if;
 if e.purged_at is not null or e.status in ('closed','archived') or e.ends_at<=now() or p_requested is null then raise exception 'Request unavailable' using errcode='22023'; end if;
 select * into r from public.event_ussd_requests where event_id=p_event_id for update;
 if r.status='accepted' then raise exception 'Contact platform support to change an accepted quote' using errcode='22023'; end if;
 if p_requested and r.status in ('requested','quoted') then return; end if;
 insert into public.event_ussd_requests(event_id,organization_id,status,requested_by) values(e.id,e.organization_id,case when p_requested then 'requested' else 'cancelled' end,auth.uid())
 on conflict(event_id) do update set status=excluded.status,requested_by=excluded.requested_by,quote_id=null,amount_minor=null,terms=null,valid_until=null,quoted_by=null,updated_at=now();
end $body$;
revoke all on function public.quote_event_ussd(uuid,integer,text,timestamptz),public.accept_event_ussd_quote(uuid,uuid) from public,anon;
grant execute on function public.quote_event_ussd(uuid,integer,text,timestamptz),public.accept_event_ussd_quote(uuid,uuid) to authenticated;
