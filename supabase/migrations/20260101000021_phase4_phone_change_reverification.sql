-- =============================================================================
-- KontaFlow · 0021 — changing a phone number requires a fresh proof
-- =============================================================================
-- Phone is user-editable, but a verified flag must not survive a new number.
-- This trigger also protects future admin flows that change a phone directly.
-- =============================================================================

create or replace function app.reset_phone_verification_on_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified_at := null;
    new.verification_required := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_reset_phone_verification on public.profiles;
create trigger profiles_reset_phone_verification
before update of phone on public.profiles
for each row execute function app.reset_phone_verification_on_change();

revoke all on function app.reset_phone_verification_on_change() from public, anon, authenticated;
