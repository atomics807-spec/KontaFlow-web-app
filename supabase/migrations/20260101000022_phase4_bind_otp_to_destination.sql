-- =============================================================================
-- KontaFlow · 0022 — a code only proves the number it was sent to
-- =============================================================================
-- A user can edit their phone between requesting and entering a code. The
-- challenge is bound to the destination it was delivered to, so an old code
-- cannot verify a replacement number.
-- =============================================================================

create or replace function public.verify_phone_verification(p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_challenge public.otp_verifications%rowtype;
  v_attempts integer;
  v_phone text;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select * into v_challenge
  from public.otp_verifications
  where user_id = v_uid and purpose = 'phone_verification' and consumed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_challenge.expires_at <= now() then
    update public.otp_verifications set consumed_at = now() where id = v_challenge.id;
    return jsonb_build_object('status', 'expired');
  end if;
  if v_challenge.attempts >= v_challenge.max_attempts then
    return jsonb_build_object('status', 'locked');
  end if;

  select phone into v_phone from public.profiles where id = v_uid;
  if v_challenge.destination is distinct from v_phone then
    update public.otp_verifications set consumed_at = now() where id = v_challenge.id;
    return jsonb_build_object('status', 'phone_changed');
  end if;

  v_attempts := v_challenge.attempts + 1;

  if v_challenge.code_hash <> p_code_hash then
    update public.otp_verifications set attempts = v_attempts where id = v_challenge.id;
    return jsonb_build_object(
      'status', 'invalid',
      'attempts_remaining', greatest(0, v_challenge.max_attempts - v_attempts)
    );
  end if;

  update public.otp_verifications
  set attempts = v_attempts, consumed_at = now()
  where id = v_challenge.id;

  update public.otp_verifications
  set consumed_at = now()
  where user_id = v_uid and purpose = 'phone_verification' and consumed_at is null;

  update public.profiles
  set phone_verified_at = now()
  where id = v_uid;

  return jsonb_build_object('status', 'verified');
end;
$$;


revoke all on function public.verify_phone_verification(text) from public, anon;
grant execute on function public.verify_phone_verification(text) to authenticated;
