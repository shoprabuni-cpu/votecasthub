alter table public.events add column if not exists verification_method text not null default 'phone';
alter table public.events drop constraint if exists events_verification_method_check;
alter table public.events add constraint events_verification_method_check check (verification_method in ('phone','email','invite_code','captcha_limited'));
grant select (verification_method) on public.events to anon, authenticated;
comment on column public.events.verification_method is 'Identity method required for free voting; phone remains the default until an alternative is configured.';
