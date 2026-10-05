alter table public.sms_credit_purchases drop constraint if exists sms_credit_purchases_amount_minor_check;
alter table public.sms_credit_purchases add constraint sms_credit_purchases_amount_minor_check check (amount_minor in (500,2000,8000,15000));
