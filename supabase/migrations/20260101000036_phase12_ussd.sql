-- =============================================================================
-- KontaFlow · 0036 — USSD sessions
-- =============================================================================
-- USSD is a low-bandwidth channel. The provider sends the whole input path on
-- every request, so the route keeps a short-lived server-side session for
-- timeout enforcement, replay protection and response caching. The table is
-- service-role only: no browser client should read another user's session.
-- =============================================================================

create index if not exists ussd_sessions_expires_idx
  on public.ussd_sessions (expires_at);

create index if not exists ussd_sessions_workspace_created_idx
  on public.ussd_sessions (workspace_id, created_at desc);

revoke insert, update, delete on public.ussd_sessions from authenticated;
grant select, insert, update, delete on public.ussd_sessions to service_role;

comment on table public.ussd_sessions is
  'Short-lived USSD session state. Service-role only; state is bounded and expires.';
comment on column public.ussd_sessions.state is
  'Menu stage, selected kind/category, last cumulative input and cached terminal response.';
comment on column public.ussd_sessions.expires_at is
  'Sliding session deadline. Expired sessions must be restarted by dialling again.';

-- Pending USSD links are verified from the handset. Keep the lookup used by the
-- callback cheap and make the pending/verified distinction explicit.
create index if not exists channel_identities_ussd_address_idx
  on public.channel_identities (address)
  where channel = 'ussd';
