-- =============================================================================
-- KontaFlow · 0020 — column privileges for identity and billing fields
-- =============================================================================
-- Row Level Security decides *which rows* a user may touch; it does not stop
-- them from writing any column on those rows. These grants make the sensitive
-- columns read-only for browser clients:
--
--   profiles.verification_required / *_verified_at / onboarding_completed_at
--   workspaces.owner_id / plan / slug
--
-- SECURITY DEFINER functions keep working because they execute as the table
-- owner, not as `authenticated`.
-- =============================================================================

revoke insert, update on public.profiles from authenticated;
grant update (full_name, phone, locale, avatar_url, default_workspace_id)
  on public.profiles to authenticated;

revoke update on public.workspaces from authenticated;
grant update (
  name, legal_name, currency, timezone, locale, country_code,
  fiscal_year_start_month, logo_url, logo_path, business_type,
  industry, business_size, city, phone, settings
) on public.workspaces to authenticated;
