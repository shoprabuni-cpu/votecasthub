-- Telegram voting sessions and verified voting
create table if not exists public.telegram_sessions (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  telegram_user_id bigint not null,
  username text,
  phone text,
  phone_hash text,
  event_id uuid references public.events(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  nominee_id uuid references public.nominees(id) on delete set null,
  quantity integer check (quantity is null or (quantity between 1 and 10000)),
  state text not null default 'idle' check (
    state in (
      'idle',
      'awaiting_candidate',
      'awaiting_quantity',
      'awaiting_payment',
      'awaiting_contact',
      'awaiting_invite_code',
      'awaiting_voter_id',
      'awaiting_claim_code',
      'awaiting_email',
      'awaiting_email_otp',
      'completed'
    )
  ),
  vote_request uuid not null default gen_random_uuid(),
  reference text,
  payment_url text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_sessions_chat_idx on public.telegram_sessions(chat_id);
create index if not exists telegram_sessions_user_idx on public.telegram_sessions(telegram_user_id);
create index if not exists telegram_sessions_phone_idx on public.telegram_sessions(phone);
create index if not exists telegram_sessions_expires_idx on public.telegram_sessions(expires_at);

alter table public.telegram_sessions enable row level security;
revoke all on public.telegram_sessions from public, anon, authenticated;
grant all on public.telegram_sessions to service_role;
