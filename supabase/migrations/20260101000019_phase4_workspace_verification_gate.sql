-- =============================================================================
-- KontaFlow · 0019 — workspace creation requires a verified identity
-- =============================================================================
-- `complete_onboarding` already checks verification, but the lower-level
-- `create_workspace` RPC is directly callable. This trigger closes that gap so
-- an authenticated but unverified account cannot create a tenant by skipping
-- the onboarding wrapper.
--
-- Accounts that predate Phase 4 have `verification_required = false` and keep
-- working. Service-role provisioning (auth.uid() is null) is not affected.
-- =============================================================================

create or replace function app.enforce_verified_workspace_creation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null or new.owner_id is distinct from auth.uid() then
    return new;
  end if;

  select * into v_profile from public.profiles where id = new.owner_id;
  if not found then
    raise exception 'Profile required before creating a workspace'
      using errcode = 'check_violation';
  end if;

  if v_profile.verification_required
     and (v_profile.email_verified_at is null or v_profile.phone_verified_at is null) then
    raise exception 'Verify your email and phone before creating a workspace'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists workspaces_require_verified_owner on public.workspaces;
create trigger workspaces_require_verified_owner
before insert on public.workspaces
for each row execute function app.enforce_verified_workspace_creation();

revoke all on function app.enforce_verified_workspace_creation() from public, anon, authenticated;
