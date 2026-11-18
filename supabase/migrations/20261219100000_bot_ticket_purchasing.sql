-- Migration: Support Ticket Buying in WhatsApp and Telegram Bot Sessions
-- Allow sessions to store tier_id, customer_name, and handle ticketing states:
-- 'awaiting_ticket_tier', 'awaiting_ticket_quantity', 'awaiting_ticket_name'

-- 1. WhatsApp sessions table updates
alter table public.whatsapp_sessions drop constraint if exists whatsapp_sessions_state_check;
alter table public.whatsapp_sessions add constraint whatsapp_sessions_state_check check (
  state in (
    'idle',
    'awaiting_candidate',
    'awaiting_quantity',
    'awaiting_payment',
    'awaiting_invite_code',
    'awaiting_voter_id',
    'awaiting_claim_code',
    'awaiting_email',
    'awaiting_email_otp',
    'awaiting_ticket_tier',
    'awaiting_ticket_quantity',
    'awaiting_ticket_name',
    'completed'
  )
);

alter table public.whatsapp_sessions add column if not exists tier_id uuid references public.event_ticket_tiers(id) on delete set null;
alter table public.whatsapp_sessions add column if not exists customer_name text;

-- 2. Telegram sessions table updates
alter table public.telegram_sessions drop constraint if exists telegram_sessions_state_check;
alter table public.telegram_sessions add constraint telegram_sessions_state_check check (
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
    'awaiting_ticket_tier',
    'awaiting_ticket_quantity',
    'awaiting_ticket_name',
    'completed'
  )
);

alter table public.telegram_sessions add column if not exists tier_id uuid references public.event_ticket_tiers(id) on delete set null;
alter table public.telegram_sessions add column if not exists customer_name text;
