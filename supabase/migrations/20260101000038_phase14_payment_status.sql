-- =============================================================================
-- KontaFlow · 0038 — richer payment lifecycle states
-- =============================================================================
-- PostgreSQL requires each enum value addition to be committed before the
-- value can be used by later statements. The payment tables and RPCs live in
-- 0039 so this migration stays a single-purpose forward-only step.
-- =============================================================================

alter type public.payment_status add value if not exists 'processing';
alter type public.payment_status add value if not exists 'expired';
alter type public.payment_status add value if not exists 'reversed';
