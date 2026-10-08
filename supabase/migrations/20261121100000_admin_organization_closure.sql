-- Organization closure preserves financial and voting history while withdrawing access.
alter table public.organizations drop constraint organizations_moderation_status_check;
alter table public.organizations add constraint organizations_moderation_status_check check(moderation_status in ('active','restricted','suspended','closed'));
alter table public.organizations add column closed_by uuid references auth.users(id) on delete set null;
alter table public.organizations add column closure_reason text check(closure_reason is null or char_length(closure_reason) between 20 and 1000);
alter table public.organization_closure_requests add column reviewed_by uuid references auth.users(id) on delete set null;
-- Keep concurrent/legacy duplicate requests as cancelled history, then enforce one pending request.
with ranked as (select id,row_number() over(partition by organization_id order by created_at,id) n from public.organization_closure_requests where status='pending')
update public.organization_closure_requests set status='cancelled',reviewed_at=now(),review_note='Superseded duplicate closure request' where id in(select id from ranked where n>1);
create unique index organization_closure_one_pending on public.organization_closure_requests(organization_id) where status='pending';

create function private.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active);
$$;
revoke all on function private.is_platform_admin() from public,anon;
grant execute on function private.is_platform_admin() to authenticated;
create function private.organization_is_active(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations where id=p_org and moderation_status='active' and archived_at is null);
$$;
revoke all on function private.organization_is_active(uuid) from public,anon,authenticated;
create or replace function private.is_org_member(p_organization_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id where m.organization_id=p_organization_id and m.user_id=auth.uid() and o.moderation_status in ('active','restricted') and o.archived_at is null);
$$;
create or replace function private.can_manage_org(p_organization_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.organization_is_active(p_organization_id) and exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=auth.uid() and role in ('owner','admin','editor'));
$$;
create or replace function private.can_view_event(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events e where e.id=p_event_id and ((private.organization_is_active(e.organization_id) and e.status in ('published','paused','closed')) or private.is_org_member(e.organization_id)));
$$;
create or replace function private.can_view_category(p_category_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.categories c join public.events e on e.id=c.event_id where c.id=p_category_id and ((private.organization_is_active(e.organization_id) and c.is_active and e.status in ('published','paused','closed')) or private.is_org_member(e.organization_id)));
$$;
create or replace function private.can_view_nominee(p_nominee_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nominees n join public.categories c on c.id=n.category_id join public.events e on e.id=c.event_id where n.id=p_nominee_id and ((private.organization_is_active(e.organization_id) and n.is_active and c.is_active and e.status in ('published','paused','closed')) or private.is_org_member(e.organization_id)));
$$;
create or replace function public.is_free_voting_open(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events where id=p_event_id and private.organization_is_active(organization_id) and status='published' and voting_mode='free' and now()>=starts_at and now()<ends_at);
$$;
create or replace function public.can_publish_paid_event(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events e join public.organization_paystack_accounts a on a.organization_id=e.organization_id where e.id=p_event_id and private.organization_is_active(e.organization_id) and a.status='active' and a.paystack_verified and a.percentage_charge=10 and not exists(select 1 from public.payment_account_operations op where op.organization_id=e.organization_id));
$$;

-- Lock organization state so closure/suspension and new writes cannot race.
create function private.require_active_organization(p_org uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.organizations where id=p_org and moderation_status='active' and archived_at is null for share;
 if not found then raise exception 'This organization is restricted, suspended, or closed' using errcode='42501'; end if;
end $$;
revoke all on function private.require_active_organization(uuid) from public,anon,authenticated;
create function private.guard_organization_content() returns trigger language plpgsql security definer set search_path='' as $$
declare org_id uuid; row_data jsonb;
begin
 if auth.uid() is null or (private.is_platform_admin() and tg_table_name='organization_invitations' and tg_op='UPDATE' and to_jsonb(new)->>'status'='revoked') then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_op='DELETE' then row_data:=to_jsonb(old); else row_data:=to_jsonb(new); end if;
 if tg_table_name='nominees' then select e.organization_id into org_id from public.categories c join public.events e on e.id=c.event_id where c.id=(row_data->>'category_id')::uuid;
 elsif row_data ? 'organization_id' then org_id:=(row_data->>'organization_id')::uuid;
 else select organization_id into org_id from public.events where id=(row_data->>'event_id')::uuid; end if;
 perform private.require_active_organization(org_id);
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger organization_content_guard before insert or update or delete on public.events for each row execute function private.guard_organization_content();
create trigger organization_content_guard before insert or update or delete on public.categories for each row execute function private.guard_organization_content();
create trigger organization_content_guard before insert or update or delete on public.nominees for each row execute function private.guard_organization_content();
create trigger organization_content_guard before insert or update or delete on public.organization_invitations for each row execute function private.guard_organization_content();
create trigger organization_content_guard before insert or update or delete on public.organization_members for each row execute function private.guard_organization_content();
create trigger organization_content_guard before insert or update or delete on public.event_voter_list_entries for each row execute function private.guard_organization_content();
create trigger organization_content_guard before insert or update or delete on public.event_access_codes for each row execute function private.guard_organization_content();
create function private.guard_organization_new_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare org_id uuid;
begin
 if tg_table_name='vote_batches' then
  -- Already-paid transactions must still settle during suspension.
  if new.payment_attempt_id is not null then return new; end if;
  select organization_id into org_id from public.events where id=new.event_id;
 elsif tg_table_name='event_access_code_redemptions' then select e.organization_id into org_id from public.event_access_codes c join public.events e on e.id=c.event_id where c.id=new.access_code_id;
 else org_id:=new.organization_id; end if;
 perform private.require_active_organization(org_id);
 return new;
end $$;
create trigger organization_activity_guard before insert on public.vote_batches for each row execute function private.guard_organization_new_activity();
create trigger organization_activity_guard before insert on public.payment_attempts for each row execute function private.guard_organization_new_activity();
create trigger organization_activity_guard before insert on public.sms_credit_purchases for each row execute function private.guard_organization_new_activity();
create trigger organization_activity_guard before insert on public.event_access_code_redemptions for each row execute function private.guard_organization_new_activity();

-- Closure requests are visible to platform admins and their own organization's owners/admins only.
drop policy organization_closure_read on public.organization_closure_requests;
revoke insert on public.organization_closure_requests from authenticated;
create policy organization_closure_read on public.organization_closure_requests for select to authenticated using(private.is_platform_admin() or exists(select 1 from public.organization_members m where m.organization_id=organization_closure_requests.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin')));
create or replace function public.request_organization_closure(p_organization_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
 perform 1 from public.organizations where id=p_organization_id for update;
 perform private.require_active_organization(p_organization_id);
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Only organization owners and admins can request closure' using errcode='42501'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 20 and 1000 then raise exception 'Provide a reason of 20 to 1000 characters' using errcode='22023'; end if;
 if exists(select 1 from public.organization_closure_requests where organization_id=p_organization_id and status='pending') then raise exception 'A closure request is already pending' using errcode='23505'; end if;
 insert into public.organization_closure_requests(organization_id,requested_by,reason) values(p_organization_id,auth.uid(),btrim(p_reason)) returning id into request_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata) values(p_organization_id,auth.uid(),'organization_closure_requested','organization',p_organization_id::text,jsonb_build_object('request_id',request_id));
 return request_id;
end $$;

create function private.organization_closure_blocker(p_org uuid) returns text language sql stable security definer set search_path='' as $$
 select case
 when exists(select 1 from public.payment_account_operations where organization_id=p_org) then 'Finish the payment account operation before closing this organization'
 when exists(select 1 from public.payment_attempts where organization_id=p_org and status in ('created','pending')) then 'Reconcile pending vote payments before closing this organization'
 when exists(select 1 from public.sms_credit_purchases where organization_id=p_org and status='pending') then 'Reconcile pending SMS purchases before closing this organization'
 when exists(select 1 from public.payout_requests where organization_id=p_org and status in ('requested','approved','processing')) then 'Resolve outstanding payouts before closing this organization'
 end;
$$;
create function public.get_admin_organization_closure_requests(p_org uuid default null) returns table(id uuid,organization_id uuid,organization_name text,reason text,status text,review_note text,created_at timestamptz,reviewed_at timestamptz,blocker text) language sql stable security definer set search_path='' as $$
 select r.id,r.organization_id,o.name,r.reason,r.status,r.review_note,r.created_at,r.reviewed_at,private.organization_closure_blocker(o.id) from public.organization_closure_requests r join public.organizations o on o.id=r.organization_id where private.is_platform_admin() and (p_org is null or r.organization_id=p_org) order by (r.status='pending') desc,r.created_at desc limit 200;
$$;
create function public.get_admin_organization_closure_readiness(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.organizations; blocker text;
begin
 if not private.is_platform_admin() then raise exception 'Platform admin access required' using errcode='42501'; end if;
 select * into o from public.organizations where id=p_org;
 if not found then raise exception 'Organization not found' using errcode='P0002'; end if;
 blocker:=private.organization_closure_blocker(p_org);
 return jsonb_build_object('ready',o.moderation_status<>'closed' and blocker is null,'blocker',blocker,'closed_at',o.archived_at,'reason',o.closure_reason);
end $$;
create function public.admin_close_organization(p_org uuid,p_confirmation_name text,p_note text,p_request_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare o public.organizations; blocker text;
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active and role='admin') then raise exception 'Platform administrator role required to close organizations' using errcode='42501'; end if;
 select * into o from public.organizations where id=p_org for update;
 if not found then raise exception 'Organization not found' using errcode='P0002'; end if;
 if o.moderation_status='closed' then raise exception 'This organization is already closed' using errcode='22023'; end if;
 if p_confirmation_name is distinct from o.name then raise exception 'Enter the organization name exactly to confirm closure' using errcode='22023'; end if;
 if p_note is null or char_length(btrim(p_note)) not between 20 and 1000 then raise exception 'Provide a closure reason of 20 to 1000 characters' using errcode='22023'; end if;
 if p_request_id is not null and not exists(select 1 from public.organization_closure_requests where id=p_request_id and organization_id=p_org and status='pending') then raise exception 'This closure request is no longer pending' using errcode='22023'; end if;
 blocker:=private.organization_closure_blocker(p_org);
 if blocker is not null then raise exception '%',blocker using errcode='22023'; end if;
 update public.organizations set moderation_status='closed',archived_at=now(),closed_by=auth.uid(),closure_reason=btrim(p_note),updated_at=now() where id=p_org;
 update public.organization_closure_requests set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),review_note=btrim(p_note) where organization_id=p_org and status='pending';
 update public.organization_invitations set status='revoked' where organization_id=p_org and status='pending';
 update public.sms_sponsorships set expires_at=now() where organization_id=p_org;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(auth.uid(),'organization_closed','organization',p_org,btrim(p_note));
 insert into public.notifications(user_id,organization_id,kind,title,body) select user_id,p_org,'organization_closure','Organization closed','This workspace has been closed. Voting and organizer changes are disabled; historical records are retained.' from public.organization_members where organization_id=p_org;
end $$;
create function public.admin_reject_organization_closure(p_request_id uuid,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare org_id uuid;
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active and role in ('admin','moderator')) then raise exception 'Platform moderation access required' using errcode='42501'; end if;
 if p_note is null or char_length(btrim(p_note)) not between 5 and 1000 then raise exception 'Provide a review note of 5 to 1000 characters' using errcode='22023'; end if;
 select organization_id into org_id from public.organization_closure_requests where id=p_request_id;
 perform 1 from public.organizations where id=org_id for update;
 update public.organization_closure_requests set status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),review_note=btrim(p_note) where id=p_request_id and status='pending';
 if not found then raise exception 'This closure request is no longer pending' using errcode='22023'; end if;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(auth.uid(),'organization_closure_rejected','organization',org_id,btrim(p_note));
 insert into public.notifications(user_id,organization_id,kind,title,body) select user_id,org_id,'organization_closure','Closure request reviewed','Your closure request was rejected: '||btrim(p_note) from public.organization_members where organization_id=org_id and role in ('owner','admin');
end $$;
create or replace function public.admin_set_organization_moderation(p_org uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare o public.organizations;
begin
 if not private.is_platform_admin() then raise exception 'Platform admin access required' using errcode='42501'; end if;
 if p_status is null or p_status not in ('active','restricted','suspended') then raise exception 'Invalid moderation status' using errcode='22023'; end if;
 select * into o from public.organizations where id=p_org for update;
 if not found then raise exception 'Organization not found' using errcode='P0002'; end if;
 if o.moderation_status='closed' or o.archived_at is not null then raise exception 'Closed organizations cannot be reactivated' using errcode='22023'; end if;
 update public.organizations set moderation_status=p_status,updated_at=now() where id=p_org;
 if p_status<>'active' then update public.sms_sponsorships set expires_at=now() where organization_id=p_org; end if;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(auth.uid(),'set_organization_moderation','organization',p_org,p_status||': '||coalesce(p_note,''));
end $$;
revoke all on function private.organization_closure_blocker(uuid),private.guard_organization_content(),private.guard_organization_new_activity() from public,anon,authenticated;
revoke all on function public.admin_close_organization(uuid,text,text,uuid),public.admin_reject_organization_closure(uuid,text),public.get_admin_organization_closure_requests(uuid),public.get_admin_organization_closure_readiness(uuid) from public,anon;
grant execute on function public.admin_close_organization(uuid,text,text,uuid),public.admin_reject_organization_closure(uuid,text),public.get_admin_organization_closure_requests(uuid),public.get_admin_organization_closure_readiness(uuid) to authenticated;
-- Keep existing private verification, SMS delivery and account logic behind an active-organization gate.
alter function public.verify_event_voter_identifier(uuid,text,text,text) rename to verify_event_voter_identifier_before_closure;
revoke all on function public.verify_event_voter_identifier_before_closure(uuid,text,text,text) from public,anon,authenticated,service_role;
create function public.verify_event_voter_identifier(p_event_id uuid,p_identifier text,p_identifier_type text,p_claim_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active_organization((select organization_id from public.events where id=p_event_id));
 return public.verify_event_voter_identifier_before_closure(p_event_id,p_identifier,p_identifier_type,p_claim_code);
end $$;
alter function public.verify_event_access_code(uuid,text) rename to verify_event_access_code_before_closure;
revoke all on function public.verify_event_access_code_before_closure(uuid,text) from public,anon,authenticated,service_role;
create function public.verify_event_access_code(p_event_id uuid,p_code_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active_organization((select organization_id from public.events where id=p_event_id));
 return public.verify_event_access_code_before_closure(p_event_id,p_code_hash);
end $$;
alter function public.check_voter_event_eligibility(uuid) rename to check_voter_event_eligibility_before_closure;
revoke all on function public.check_voter_event_eligibility_before_closure(uuid) from public,anon,authenticated,service_role;
create function public.check_voter_event_eligibility(p_event_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.events where id=p_event_id and private.organization_is_active(organization_id)) then return jsonb_build_object('is_verified',false,'is_authenticated',auth.uid() is not null,'error','Organization unavailable'); end if;
 return public.check_voter_event_eligibility_before_closure(p_event_id);
end $$;
revoke all on function public.verify_event_voter_identifier(uuid,text,text,text),public.verify_event_access_code(uuid,text),public.check_voter_event_eligibility(uuid) from public,anon;
grant execute on function public.verify_event_voter_identifier(uuid,text,text,text),public.verify_event_access_code(uuid,text) to authenticated;
grant execute on function public.check_voter_event_eligibility(uuid) to anon,authenticated;
alter function public.prepare_voter_sms(text,text) rename to prepare_voter_sms_before_closure;
revoke all on function public.prepare_voter_sms_before_closure(text,text) from public,anon,authenticated,service_role;
create function public.prepare_voter_sms(p_recipient_hash text,p_event_slug text) returns boolean language plpgsql security definer set search_path='' as $$
declare org_id uuid;
begin
 select o.id into org_id from public.organizations o join public.events e on e.organization_id=o.id where e.slug=p_event_slug and o.moderation_status='active' and o.archived_at is null for share of o;
 if not found then return false; end if;
 return public.prepare_voter_sms_before_closure(p_recipient_hash,p_event_slug);
end $$;
alter function public.begin_payment_account_change(uuid,uuid,text) rename to begin_payment_account_change_before_closure;
revoke all on function public.begin_payment_account_change_before_closure(uuid,uuid,text) from public,anon,authenticated,service_role;
create function public.begin_payment_account_change(p_organization_id uuid,p_token uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.organizations where id=p_organization_id for update;
 perform private.require_active_organization(p_organization_id);
 perform public.begin_payment_account_change_before_closure(p_organization_id,p_token,p_kind);
end $$;
revoke all on function public.prepare_voter_sms(text,text),public.begin_payment_account_change(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_voter_sms(text,text),public.begin_payment_account_change(uuid,uuid,text) to service_role;
create trigger organization_activity_guard before insert on public.payout_requests for each row execute function private.guard_organization_new_activity();
create trigger organization_activity_guard before insert on public.payment_account_operations for each row execute function private.guard_organization_new_activity();
alter function public.get_organization_team(uuid) rename to get_organization_team_before_closure;
revoke all on function public.get_organization_team_before_closure(uuid) from public,anon,authenticated,service_role;
create function public.get_organization_team(p_organization_id uuid) returns table(user_id uuid,email text,display_name text,role text,joined_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_org_member(p_organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 return query select * from public.get_organization_team_before_closure(p_organization_id);
end $$;
alter function public.get_organization_invitations(uuid) rename to get_organization_invitations_before_closure;
revoke all on function public.get_organization_invitations_before_closure(uuid) from public,anon,authenticated,service_role;
create function public.get_organization_invitations(p_organization_id uuid) returns table(id uuid,email text,role text,status text,created_at timestamptz,expires_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_org_member(p_organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 return query select * from public.get_organization_invitations_before_closure(p_organization_id);
end $$;
revoke all on function public.get_organization_team(uuid),public.get_organization_invitations(uuid) from public,anon;
grant execute on function public.get_organization_team(uuid),public.get_organization_invitations(uuid) to authenticated;
alter function public.get_public_event_results(uuid) rename to get_public_event_results_before_closure;
revoke all on function public.get_public_event_results_before_closure(uuid) from public,anon,authenticated,service_role;
create function public.get_public_event_results(p_event_id uuid) returns table(nominee_id uuid,vote_count bigint) language sql stable security definer set search_path='' as $$
 select result.* from public.get_public_event_results_before_closure(p_event_id) result where exists(select 1 from public.events where id=p_event_id and private.organization_is_active(organization_id));
$$;
revoke all on function public.get_public_event_results(uuid) from public;
grant execute on function public.get_public_event_results(uuid) to anon,authenticated;
create or replace function private.can_view_event_image_path(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select case when p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then private.can_view_event(split_part(p_path,'/',1)::uuid) else false end;
$$;

