create table if not exists public.organization_closure_requests(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 requested_by uuid not null references auth.users(id), reason text not null check(char_length(btrim(reason)) between 20 and 1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')), review_note text, created_at timestamptz not null default now(), reviewed_at timestamptz
);
alter table public.organization_closure_requests enable row level security;
revoke all on public.organization_closure_requests from public,anon,authenticated;
grant select,insert on public.organization_closure_requests to authenticated;
create policy organization_closure_read on public.organization_closure_requests for select to authenticated using(exists(select 1 from public.organization_members m where m.organization_id=organization_id and m.user_id=auth.uid()));
create function public.request_organization_closure(p_organization_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$ declare r uuid; begin if not private.can_manage_org(p_organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if; if length(btrim(p_reason))<20 then raise exception 'Provide a reason of at least 20 characters' using errcode='22023'; end if; if exists(select 1 from public.organization_closure_requests where organization_id=p_organization_id and status='pending') then raise exception 'A closure request is already pending' using errcode='23505'; end if; insert into public.organization_closure_requests(organization_id,requested_by,reason) values(p_organization_id,auth.uid(),p_reason) returning id into r; return r; end $$;
revoke all on function public.request_organization_closure(uuid,text) from public,anon; grant execute on function public.request_organization_closure(uuid,text) to authenticated;
