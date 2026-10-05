create table if not exists public.event_voter_list_entries(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 identifier_hash text not null, identifier_type text not null check(identifier_type in ('email','phone')), label text,
 max_votes integer not null default 1 check(max_votes between 1 and 100), used_votes integer not null default 0 check(used_votes>=0), invited_at timestamptz, redeemed_at timestamptz, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(event_id,identifier_hash)
);
alter table public.event_voter_list_entries enable row level security;
revoke all on public.event_voter_list_entries from public,anon,authenticated;
grant select,insert,update,delete on public.event_voter_list_entries to authenticated;
create policy voter_list_manage on public.event_voter_list_entries for all to authenticated using(private.can_manage_org((select organization_id from public.events where id=event_id))) with check(private.can_manage_org((select organization_id from public.events where id=event_id)));
create function public.redeem_event_voter_list_entry(p_event_id uuid,p_identifier_hash text,p_identifier_type text) returns uuid language plpgsql security definer set search_path='' as $$ declare entry_id uuid; uid uuid:=auth.uid(); begin if uid is null then raise exception 'Authentication required' using errcode='42501'; end if; select id into entry_id from public.event_voter_list_entries where event_id=p_event_id and identifier_hash=p_identifier_hash and identifier_type=p_identifier_type for update; if not found then raise exception 'You are not on the approved voter list' using errcode='42501'; end if; update public.event_voter_list_entries set redeemed_at=coalesce(redeemed_at,now()) where id=entry_id; return entry_id; end $$;
revoke all on function public.redeem_event_voter_list_entry(uuid,text,text) from public,anon; grant execute on function public.redeem_event_voter_list_entry(uuid,text,text) to authenticated;
