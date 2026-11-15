-- Add awaiting_candidate to whatsapp_sessions state check constraint
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
    'completed'
  )
);
