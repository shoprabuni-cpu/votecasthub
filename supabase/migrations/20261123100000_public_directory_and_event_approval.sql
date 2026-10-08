-- Return only public events, independent of the caller's organizer privileges.
create function public.get_public_event_directory(
 p_search text default '', p_status text default 'active', p_mode text default 'all',
 p_sort text default 'soonest', p_offset integer default 0, p_limit integer default 24
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_status not in ('active','all','open','upcoming','ending','paused','closed') or
    p_mode not in ('all','free','paid') or p_sort not in ('soonest','newest','name') or
    p_offset < 0 or p_offset > 100000 or p_limit < 1 or p_limit > 48 or char_length(p_search)>120 or
    p_status is null or p_mode is null or p_sort is null or p_offset is null or p_limit is null or p_search is null then
  raise exception 'Invalid event filters' using errcode='22023';
 end if;
 with eligible as (
  select e.id,e.name,e.slug,e.description,e.image_path,e.unit_price_minor,e.starts_at,e.ends_at,e.status,e.voting_mode,e.created_at,o.name organization_name,
   case when e.status='closed' or e.ends_at<=now() then 'closed' when e.status='paused' then 'paused' when e.starts_at>now() then 'upcoming' else 'open' end phase
  from public.events e join public.organizations o on o.id=e.organization_id
  where e.status in ('published','paused','closed') and e.purged_at is null
   and o.moderation_status='active' and o.archived_at is null
   and not exists(select 1 from public.admin_deletion_jobs j where j.status='pending' and ((j.target_kind='event' and j.target_id=e.id) or (j.target_kind='organization' and j.target_id=o.id)))
   and (p_mode='all' or e.voting_mode=p_mode)
   and (p_search='' or strpos(lower(e.name||' '||coalesce(e.description,'')||' '||o.name),lower(p_search))>0)
 ), filtered as (
  select * from eligible where p_status='all' or (p_status='active' and phase<>'closed') or phase=p_status
   or (p_status='ending' and phase='open' and ends_at<=now()+interval '48 hours')
 ), page as (
  select *,row_number() over(order by
   case when p_sort='name' then lower(name) end,
   case when p_sort='newest' then created_at end desc,
   case when p_sort='soonest' then case phase when 'open' then 0 when 'upcoming' then 1 when 'paused' then 2 else 3 end end,
   case when p_sort='soonest' then case when phase='upcoming' then starts_at else ends_at end end,
   id) position
  from filtered
 ) select jsonb_build_object('total',(select count(*) from filtered),'now',floor(extract(epoch from now())*1000),
   'events',coalesce((select jsonb_agg(to_jsonb(p)-'created_at'-'phase'-'position' order by position) from
    (select * from page order by position limit p_limit offset p_offset) p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.get_public_event_directory(text,text,text,text,integer,integer) from public;
grant execute on function public.get_public_event_directory(text,text,text,text,integer,integer) to anon,authenticated;

-- Lock review state, retain publication guards, and distinguish missing/stale reviews.
create or replace function public.admin_approve_event(p_event_id uuid,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); e public.events;
begin
 if not private.is_platform_admin() then raise exception 'Platform admin access required' using errcode='42501'; end if;
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if e.status<>'pending_review' then raise exception 'This event is no longer awaiting review. Refresh the event list.' using errcode='22023'; end if;
 update public.events set admin_approved=true,status='published',updated_at=now() where id=p_event_id;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note)
 values(uid,'approve_event','event',p_event_id,p_note);
end $$;
