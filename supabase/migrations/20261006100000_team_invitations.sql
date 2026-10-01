create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  role text not null check (role in ('admin', 'editor', 'viewer')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (id, organization_id),
  check ((status = 'accepted') = (accepted_at is not null))
);
create unique index organization_invitations_pending_email_idx
  on public.organization_invitations(organization_id, email) where status = 'pending';
create index organization_invitations_org_created_idx
  on public.organization_invitations(organization_id, created_at desc);
alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from anon, authenticated;

create function public.create_organization_invitation(p_organization_id uuid, p_email text, p_role text, p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_actor_role text;
  v_invitation_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select member.role into v_actor_role from public.organization_members as member
    where member.organization_id = p_organization_id and member.user_id = v_user_id;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' or char_length(v_email) > 254 then
    raise exception 'Invitation email is invalid' using errcode = '22023';
  end if;
  if coalesce(p_role, '') not in ('admin', 'editor', 'viewer') or (p_role = 'admin' and v_actor_role <> 'owner') then
    raise exception 'Invitation role is not allowed' using errcode = '42501';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invitation token is invalid' using errcode = '22023'; end if;
  if exists (select 1 from public.organization_members as member join auth.users as user_row on user_row.id = member.user_id
    where member.organization_id = p_organization_id and lower(user_row.email) = v_email) then
    raise exception 'This user is already a member' using errcode = '23505';
  end if;
  update public.organization_invitations set status = 'expired'
    where organization_id = p_organization_id and email = v_email and status = 'pending' and expires_at <= now();
  insert into public.organization_invitations (organization_id, email, role, token_hash, expires_at, created_by)
  values (p_organization_id, v_email, p_role, p_token_hash, now() + interval '7 days', v_user_id)
  returning id into v_invitation_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_organization_id, v_user_id, 'organization_invitation_created', 'invitation', v_invitation_id::text,
    jsonb_build_object('email', v_email, 'role', p_role, 'expires_at', now() + interval '7 days'));
  return v_invitation_id;
end;
$$;

create function public.get_organization_invitations(p_organization_id uuid)
returns table (id uuid, email text, role text, status text, created_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organization_members as member where member.organization_id = p_organization_id
    and member.user_id = (select auth.uid()) and member.role in ('owner', 'admin')) then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;
  return query select invitation.id, invitation.email, invitation.role, case when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired' else invitation.status end, invitation.created_at, invitation.expires_at
    from public.organization_invitations as invitation
    where invitation.organization_id = p_organization_id order by invitation.created_at desc limit 100;
end;
$$;

create function public.get_organization_team(p_organization_id uuid)
returns table (user_id uuid, email text, display_name text, role text, joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organization_members as member where member.organization_id = p_organization_id
    and member.user_id = (select auth.uid()) and member.role in ('owner', 'admin')) then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;
  return query select member.user_id, lower(user_row.email), profile.display_name, member.role, member.created_at
    from public.organization_members as member
    join auth.users as user_row on user_row.id = member.user_id
    left join public.profiles as profile on profile.id = member.user_id
    where member.organization_id = p_organization_id order by member.created_at;
end;
$$;

create function public.revoke_organization_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_organization_id uuid;
begin
  select invitation.organization_id into v_organization_id from public.organization_invitations as invitation
    where invitation.id = p_invitation_id and invitation.status = 'pending' for update;
  if not found then raise exception 'Invitation not found or no longer pending' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.organization_members as member where member.organization_id = v_organization_id
    and member.user_id = (select auth.uid()) and member.role in ('owner', 'admin')) then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;
  update public.organization_invitations set status = 'revoked' where id = p_invitation_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id)
  values (v_organization_id, (select auth.uid()), 'organization_invitation_revoked', 'invitation', p_invitation_id::text);
end;
$$;

create function public.accept_organization_invitation(p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_confirmed_at timestamptz;
  v_invitation public.organization_invitations%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invitation is invalid or expired' using errcode = '22023'; end if;
  select lower(user_row.email), user_row.email_confirmed_at into v_email, v_confirmed_at
    from auth.users as user_row where user_row.id = v_user_id;
  if v_email is null or v_confirmed_at is null then raise exception 'Verify your email before accepting an invitation' using errcode = '42501'; end if;
  select * into v_invitation from public.organization_invitations as invitation
    where invitation.token_hash = p_token_hash for update;
  if not found or v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception 'Invitation is invalid, expired, or already used' using errcode = '22023';
  end if;
  if v_invitation.email <> v_email then raise exception 'Sign in with the invited email address' using errcode = '42501'; end if;
  if exists (select 1 from public.organization_members as member where member.organization_id = v_invitation.organization_id and member.user_id = v_user_id) then
    raise exception 'You are already a member of this organization' using errcode = '23505';
  end if;
  insert into public.organization_members (organization_id, user_id, role)
    values (v_invitation.organization_id, v_user_id, v_invitation.role);
  update public.organization_invitations set status = 'accepted', accepted_by = v_user_id, accepted_at = now()
    where id = v_invitation.id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_invitation.organization_id, v_user_id, 'organization_invitation_accepted', 'invitation', v_invitation.id::text,
    jsonb_build_object('role', v_invitation.role));
  return v_invitation.organization_id;
end;
$$;

revoke execute on function public.create_organization_invitation(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_organization_invitations(uuid) from public, anon, authenticated;
revoke execute on function public.get_organization_team(uuid) from public, anon, authenticated;
revoke execute on function public.revoke_organization_invitation(uuid) from public, anon, authenticated;
revoke execute on function public.accept_organization_invitation(text) from public, anon, authenticated;
grant execute on function public.create_organization_invitation(uuid, text, text, text) to authenticated;
grant execute on function public.get_organization_invitations(uuid) to authenticated;
grant execute on function public.get_organization_team(uuid) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
