alter table public.events drop constraint if exists events_verification_method_check;
alter table public.events add constraint events_verification_method_check check (verification_method in ('phone','email','invite_code','voter_list','captcha_limited'));
