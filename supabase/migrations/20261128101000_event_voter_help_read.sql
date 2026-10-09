-- Events use column-level read grants; RLS still controls which events are visible.
grant select (voter_help_email) on public.events to anon, authenticated;
