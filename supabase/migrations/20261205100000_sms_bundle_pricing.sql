-- Retain historical purchases and in-flight checkouts at their original amounts.
-- New checkout prices are enforced by the server's smsPackages catalog.
alter table public.sms_credit_purchases
  drop constraint if exists sms_credit_purchases_amount_minor_check;
alter table public.sms_credit_purchases
  add constraint sms_credit_purchases_amount_minor_check
  check (amount_minor in (500, 1000, 2000, 4000, 7000, 8000, 15000));

alter table public.sms_credit_purchases
  drop constraint if exists sms_package_price;
alter table public.sms_credit_purchases
  add constraint sms_package_price check (
    (credits = 100 and amount_minor in (500, 1000, 2000))
    or (credits = 500 and amount_minor in (4000, 8000))
    or (credits = 1000 and amount_minor in (7000, 15000))
  );
