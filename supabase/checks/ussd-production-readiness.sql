-- READ ONLY. Run in the LIVE project's SQL Editor. Does not apply migrations,
-- modify accounts, publish events, activate access or create transactions.
select name as required_function,
  case when to_regprocedure(signature) is not null then 'Ready' else 'Missing migration' end as status
from (values
  ('Native sessions','public.begin_native_ussd(text,text,text,text,boolean,text)'),
  ('Native reply completion','public.finish_native_ussd(text,text,uuid,jsonb,boolean,boolean)'),
  ('USSD event lookup','public.get_public_ussd(uuid)'),
  ('Free USSD voting','public.cast_verified_ussd_vote(uuid,uuid,uuid,uuid,integer,uuid)'),
  ('Paystack USSD reservation','public.reserve_paystack_ussd_payment(text,text,uuid,uuid,uuid,integer)'),
  ('Single charge claim','public.claim_ussd_charge(text)'),
  ('Access-fee fulfillment','public.fulfill_ussd_access(text,bigint,bigint)'),
  ('Payment recovery','public.enqueue_pending_payments()'),
  ('Access-fee recovery','public.enqueue_ussd_access_reconciliation()')
) as expected(name,signature);
