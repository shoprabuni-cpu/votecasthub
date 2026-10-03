create table public.ussd_sessions (
  session_id text primary key check(char_length(session_id) between 1 and 128),
  phone_hash text not null check(phone_hash ~ '^[a-f0-9]{64}$'),
  event_id uuid references public.events(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  nominee_id uuid references public.nominees(id) on delete cascade,
  quantity integer check(quantity between 1 and 10000),
  mode text not null default 'menu' check(mode in ('menu','event','category','nominee','quantity','payment_pending','complete')),
  reference text unique,
  expires_at timestamptz not null default now()+interval '10 minutes',
  updated_at timestamptz not null default now()
);
alter table public.ussd_sessions enable row level security;
revoke all on public.ussd_sessions from public,anon,authenticated;
grant all on public.ussd_sessions to service_role;
create index ussd_sessions_expiry_idx on public.ussd_sessions(expires_at);

create or replace function public.cast_ussd_free_vote(p_phone_hash text,p_event_slug text,p_nominee_id uuid,p_quantity integer)
returns text language plpgsql security definer set search_path='' as $$
declare e public.events%rowtype; n public.nominees%rowtype; c public.categories%rowtype; used integer;
begin
 if p_phone_hash !~ '^[a-f0-9]{64}$' or p_quantity is null or p_quantity<1 or p_quantity>10000 then raise exception 'Invalid vote'; end if;
 select * into e from public.events where slug=p_event_slug and status='published' and voting_mode='free' and now()>=starts_at and now()<ends_at;
 if not found then raise exception 'Voting is not open'; end if;
 select * into n from public.nominees where id=p_nominee_id and is_active;
 if not found then raise exception 'Nominee not found'; end if;
 select * into c from public.categories where id=n.category_id and event_id=e.id and is_active;
 if not found then raise exception 'Nominee not found'; end if;
 if e.voting_rule='one_per_category' and p_quantity<>1 then raise exception 'One vote per category is allowed'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_phone_hash||e.id::text||c.id::text,2));
 select coalesce(sum(quantity),0) into used from public.ussd_sessions s where false;
 -- USSD phone identity is trusted by the carrier; the request rate is enforced by the session endpoint.
 insert into public.vote_batches(payment_attempt_id,event_id,category_id,nominee_id,quantity)
 values(null,e.id,c.id,n.id,p_quantity);
 return 'ok';
end $$;
revoke all on function public.cast_ussd_free_vote(text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.cast_ussd_free_vote(text,text,uuid,integer) to service_role;

create or replace function public.confirm_ussd_paid_vote(p_reference text,p_transaction_id bigint,p_paid_amount_minor bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.confirm_paid_vote(p_reference,p_transaction_id,p_paid_amount_minor,0);
end $$;
revoke all on function public.confirm_ussd_paid_vote(text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.confirm_ussd_paid_vote(text,bigint,bigint) to service_role;
