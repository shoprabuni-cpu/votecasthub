-- Email is queued in the event transaction; provider failures cannot undo approval.
create table public.notification_email_jobs (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 recipient text not null, subject text not null, body text not null, path text not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz, first_attempt_at timestamptz,
 payload jsonb, provider_id text, delivery_uncertain boolean not null default false,
 last_error text, created_at timestamptz not null default now(), sent_at timestamptz
);
create index notification_email_jobs_due on public.notification_email_jobs(next_attempt_at) where status in ('pending','sending');
alter table public.notification_email_jobs enable row level security;
revoke all on public.notification_email_jobs from public,anon,authenticated;
grant all on public.notification_email_jobs to service_role;

create function private.queue_event_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending_review' and old.status='draft' then
  insert into public.notification_email_jobs(event_id,user_id,recipient,subject,body,path)
  select new.id,u.id,u.email,'Event awaiting review: '||new.name,
   new.name||' has been submitted for review. Open the admin dashboard to review its details and schedule.',
   '/admin/events/'||new.id
  from public.platform_admins a join auth.users u on u.id=a.user_id
  where a.is_active and u.email_confirmed_at is not null and nullif(btrim(u.email),'') is not null;
 elsif new.status='published' and old.status='pending_review' then
  insert into public.notification_email_jobs(event_id,user_id,recipient,subject,body,path)
  select new.id,u.id,u.email,'Your event is published: '||new.name,
   new.name||' has been approved and published. Voting follows your event schedule. Open your dashboard to view the event.',
   '/organizer/'||new.organization_id||'/events/'||new.id
  from public.organization_members m join auth.users u on u.id=m.user_id
  where m.organization_id=new.organization_id and m.role in ('owner','admin')
   and u.email_confirmed_at is not null and nullif(btrim(u.email),'') is not null;
 end if;
 return new;
end $$;
revoke all on function private.queue_event_email() from public,anon,authenticated;
create trigger queue_event_email after update of status on public.events for each row execute function private.queue_event_email();

create function public.claim_notification_emails(p_limit integer default 5)
returns setof public.notification_email_jobs language plpgsql security definer set search_path='' as $$
begin
 -- Never resend an ambiguous request after the provider's 24-hour deduplication window.
 update public.notification_email_jobs set status='failed',last_error='Delivery uncertain: manual provider review required',lease_id=null,lease_until=null
 where status in ('pending','sending') and (delivery_uncertain or status='sending') and first_attempt_at < now()-interval '23 hours';
 update public.notification_email_jobs j set status='cancelled',last_error='Recipient or event no longer eligible'
 where j.status in ('pending','sending') and (j.lease_until is null or j.lease_until<now()) and not exists(
  select 1 from public.events e join auth.users u on u.id=j.user_id where e.id=j.event_id and e.purged_at is null
   and u.email=j.recipient and u.email_confirmed_at is not null and (
    (j.path like '/admin/%' and exists(select 1 from public.platform_admins a where a.user_id=u.id and a.is_active)) or
    (j.path like '/organizer/%' and exists(select 1 from public.organization_members m where m.organization_id=e.organization_id and m.user_id=u.id and m.role in ('owner','admin')))
   )
 );
 return query with due as (
  select id from public.notification_email_jobs where status in ('pending','sending') and next_attempt_at<=now()
   and (lease_until is null or lease_until<now()) order by created_at,id for update skip locked limit greatest(1,least(p_limit,5))
 ) update public.notification_email_jobs j set status='sending',lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',
 attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()) from due where j.id=due.id returning j.*;
end $$;
revoke all on function public.claim_notification_emails(integer) from public,anon,authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;
