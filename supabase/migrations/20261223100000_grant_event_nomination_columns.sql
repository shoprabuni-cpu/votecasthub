-- ============================================================================
-- Migration: Grant Column Permissions for Public Nominations on Events
-- Fixes PostgreSQL error 42501 (permission denied for table events)
-- when anon or authenticated clients query or update nomination columns.
-- ============================================================================

grant select (
  nominations_enabled,
  nomination_fee_minor,
  nominations_starts_at,
  nominations_ends_at,
  allow_self_nomination,
  allow_third_party_nomination
) on public.events to anon, authenticated;

grant update (
  nominations_enabled,
  nomination_fee_minor,
  nominations_starts_at,
  nominations_ends_at,
  allow_self_nomination,
  allow_third_party_nomination
) on public.events to authenticated;
