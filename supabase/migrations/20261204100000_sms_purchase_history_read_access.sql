-- The member-only RLS policy needs a table SELECT grant as well.
-- Default privileges intentionally deny access to newly created tables.
grant select on table public.sms_credit_purchases to authenticated;
