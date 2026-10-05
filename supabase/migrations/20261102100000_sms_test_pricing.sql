alter table public.sms_credit_purchases drop constraint if exists sms_credit_purchases_amount_minor_check;
alter table public.sms_credit_purchases add constraint sms_credit_purchases_amount_minor_check check (amount_minor in (500,2000,8000,15000));
alter table public.sms_credit_purchases drop constraint if exists sms_package_price;
alter table public.sms_credit_purchases add constraint sms_package_price check((credits=100 and amount_minor in (500,2000))or(credits=500 and amount_minor=8000)or(credits=1000 and amount_minor=15000));
