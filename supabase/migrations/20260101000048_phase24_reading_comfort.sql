-- =============================================================================
-- KontaFlow · 0048 — reading-comfort preference
-- =============================================================================
-- New accounts start on the picture-first Simple screen. Existing accounts keep
-- their current full dashboard until they choose otherwise, so a deployment does
-- not abruptly move an accountant's workspace.
-- =============================================================================

alter table public.profiles
  add column if not exists easy_mode boolean not null default true;

update public.profiles set easy_mode = false;

grant update (easy_mode) on public.profiles to authenticated;

comment on column public.profiles.easy_mode is
  'When true, the account starts on the picture-first Easy Mode screen.';
