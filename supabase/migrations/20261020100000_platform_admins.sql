create table if not exists public.platform_admins(
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'moderator' check(role in ('admin','moderator','support')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public,anon,authenticated;
grant select on public.platform_admins to authenticated;
create policy platform_admin_self_read on public.platform_admins for select to authenticated using(user_id=auth.uid() and is_active);

create table if not exists public.admin_audit_log(
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check(char_length(action) between 2 and 80),
  target_type text not null check(char_length(target_type) between 2 and 40),
  target_id uuid,
  note text check(note is null or char_length(note)<=1000),
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public,anon,authenticated;
grant select on public.admin_audit_log to authenticated;
create policy admin_audit_read on public.admin_audit_log for select to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.is_active));

create or replace function public.get_pending_correction_requests()
returns table(id uuid,event_id uuid,event_name text,kind text,nominee_id uuid,proposed_value text,original_value text,reason text,requested_by uuid,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select r.id,r.event_id,e.name,r.kind,r.nominee_id,r.proposed_value,r.original_value,r.reason,r.requested_by,r.created_at
 from public.event_correction_requests r join public.events e on e.id=r.event_id
 where r.status='pending' and exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.is_active)
 order by r.created_at asc;
$$;
revoke all on function public.get_pending_correction_requests() from public,anon;
grant execute on function public.get_pending_correction_requests() to authenticated;

create or replace function public.admin_review_event_correction(p_request_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); begin
 if not exists(select 1 from public.platform_admins where user_id=uid and is_active) then raise exception 'Platform admin access required'; end if;
 perform public.review_event_correction(p_request_id,p_approve,p_note);
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(uid,case when p_approve then 'approve_correction' else 'reject_correction' end,'event_correction',p_request_id,p_note);
end $$;
revoke all on function public.admin_review_event_correction(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_review_event_correction(uuid,boolean,text) to authenticated;

create or replace function public.get_admin_overview()
returns table(organizers bigint,events bigint,published_events bigint,pending_corrections bigint,successful_payments bigint,gross_minor bigint,refunded_minor bigint)
language sql stable security definer set search_path='' as $$ select (select count(*) from public.organizations),(select count(*) from public.events),(select count(*) from public.events where status in ('published','paused')),(select count(*) from public.event_correction_requests where status='pending'),(select count(*) from public.payment_attempts where status='succeeded'),(select coalesce(sum(gross_amount_minor),0) from public.paid_vote_ledger where status in ('confirmed','refunded','reversed')),(select coalesce(sum(refunded_amount_minor),0) from public.paid_vote_ledger); $$;
revoke all on function public.get_admin_overview() from public,anon; grant execute on function public.get_admin_overview() to authenticated;

create or replace function public.get_admin_events(p_search text default null)
returns table(id uuid,name text,status text,voting_mode text,organization_name text,starts_at timestamptz,ends_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$ select e.id,e.name,e.status,e.voting_mode,o.name,e.starts_at,e.ends_at,e.created_at from public.events e join public.organizations o on o.id=e.organization_id where exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.is_active) and (p_search is null or e.name ilike '%'||p_search||'%' or o.name ilike '%'||p_search||'%') order by e.created_at desc limit 100; $$;
revoke all on function public.get_admin_events(text) from public,anon; grant execute on function public.get_admin_events(text) to authenticated;

create or replace function public.admin_set_event_status(p_event_id uuid,p_status text,p_note text default null) returns void language plpgsql security definer set search_path='' as $$ declare uid uuid:=auth.uid(); begin if not exists(select 1 from public.platform_admins where user_id=uid and is_active) then raise exception 'Platform admin access required'; end if; if p_status not in ('draft','published','paused','closed','archived') then raise exception 'Invalid event status'; end if; update public.events set status=p_status,updated_at=now() where id=p_event_id; if not found then raise exception 'Event not found'; end if; insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(uid,'set_event_status','event',p_event_id,coalesce(p_note,p_status)); end $$;
revoke all on function public.admin_set_event_status(uuid,text,text) from public,anon,authenticated; grant execute on function public.admin_set_event_status(uuid,text,text) to authenticated;

create table if not exists public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,organization_id uuid references public.organizations(id) on delete cascade,kind text not null,title text not null,body text not null,read_at timestamptz,created_at timestamptz not null default now());
alter table public.notifications enable row level security;
create policy notification_owner_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notification_owner_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke insert,delete on public.notifications from anon,authenticated; grant select,update on public.notifications to authenticated; grant all on public.notifications to service_role;
create or replace function public.get_admin_payments() returns table(reference text,event_name text,organization_name text,status text,gross_minor bigint,refunded_minor bigint,provider_fee_minor bigint,created_at timestamptz) language sql stable security definer set search_path='' as $$ select p.provider_reference,e.name,o.name,coalesce(l.status,p.status),p.total_amount_minor,coalesce(l.refunded_amount_minor,0),coalesce(l.provider_fee_minor,0),p.created_at from public.payment_attempts p join public.organizations o on o.id=p.organization_id left join public.events e on e.id=p.event_id left join public.paid_vote_ledger l on l.reference=p.provider_reference where exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.is_active) order by p.created_at desc limit 200; $$;
revoke all on function public.get_admin_payments() from public,anon; grant execute on function public.get_admin_payments() to authenticated;

create or replace function private.notify_correction_review() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.status in ('approved','rejected') and old.status='pending' then insert into public.notifications(user_id,organization_id,kind,title,body)
 select m.user_id,e.organization_id,'correction_review',case when new.status='approved' then 'Correction approved' else 'Correction rejected' end,case when new.status='approved' then 'Your requested event correction has been approved.' else 'Your requested event correction was rejected.' end from public.events e join public.organization_members m on m.organization_id=e.organization_id where e.id=new.event_id; end if; return new; end $$;
drop trigger if exists correction_review_notifications on public.event_correction_requests;
create trigger correction_review_notifications after update of status on public.event_correction_requests for each row execute function private.notify_correction_review();
