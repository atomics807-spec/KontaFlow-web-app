-- =============================================================================
-- KontaFlow · 0018 — identity, verification and onboarding
-- =============================================================================
-- Adds the fields required to register a named person, prove control of their
-- email and phone, record privacy consent and finish business onboarding.
--
-- OTPs are never stored in plaintext. The application generates them with
-- cryptographically secure randomness, hashes them with an HMAC and only the
-- hash reaches the database. Delivery happens through the SMS adapter.
-- =============================================================================

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists country_code char(2) not null default 'CM',
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists verification_required boolean not null default true;

update public.profiles
set first_name = coalesce(nullif(trim(split_part(full_name, ' ', 1)), ''), ''),
    last_name = coalesce(nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''), ''),
    country_code = upper(country_code)
where first_name = '' and last_name = '' and full_name <> '';

-- Accounts that existed before Phase 4 keep working. They already proved their
-- identity through the original product and are not forced through the new
-- verification wall.
update public.profiles p
set email_verified_at = coalesce(u.email_confirmed_at, p.created_at),
    phone_verified_at = case when p.phone is not null then coalesce(u.email_confirmed_at, p.created_at) end,
    onboarding_completed_at = case
      when exists (select 1 from public.workspaces w where w.owner_id = p.id) then p.created_at
    end,
    verification_required = false
from auth.users u
where u.id = p.id;

alter table public.workspaces
  add column if not exists business_type text
    check (business_type is null or business_type in ('sole_proprietorship','partnership','limited_company','cooperative','nonprofit','other')),
  add column if not exists industry text,
  add column if not exists business_size text
    check (business_size is null or business_size in ('solo','micro','small','medium','large')),
  add column if not exists city text,
  add column if not exists phone text
    check (phone is null or phone ~ '^\+[1-9][0-9]{6,15}$'),
  add column if not exists logo_path text;

alter table public.privacy_consents
  add column if not exists locale text
    check (locale is null or locale in ('en','fr','wes')),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists source text not null default 'signup'
    check (char_length(source) between 1 and 40);

alter table public.otp_verifications
  drop constraint if exists otp_verifications_purpose_check;
alter table public.otp_verifications
  add constraint otp_verifications_purpose_check
  check (purpose in ('login','phone_verification','email_verification','transaction_confirmation','password_reset'));

create or replace function app.try_inet(p_value text)
returns inet
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return btrim(p_value)::inet;
exception when others then
  return null;
end;
$$;

create or replace function app.try_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return btrim(p_value)::timestamptz;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registration trigger: profile + explicit consent records.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locale text;
  v_first text;
  v_last text;
  v_full text;
  v_country text;
  v_phone text;
  v_privacy boolean;
  v_marketing boolean;
  v_version text;
begin
  v_locale := coalesce(new.raw_user_meta_data ->> 'locale', 'en');
  if v_locale not in ('en', 'fr', 'wes') then
    v_locale := 'en';
  end if;

  v_full := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), '');
  v_first := coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), split_part(v_full, ' ', 1));
  v_last := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(substr(v_full, length(split_part(v_full, ' ', 1)) + 1)), '')
  );
  if v_full = '' then
    v_full := trim(both ' ' from v_first || ' ' || v_last);
  end if;

  v_country := upper(coalesce(nullif(trim(new.raw_user_meta_data ->> 'country'), ''), 'CM'));
  if v_country !~ '^[A-Z]{2}$' then
    v_country := 'CM';
  end if;

  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', new.phone)), '');

  insert into public.profiles (
    id, first_name, last_name, full_name, phone, locale, country_code,
    email_verified_at, verification_required
  )
  values (
    new.id,
    v_first,
    v_last,
    v_full,
    v_phone,
    v_locale,
    v_country,
    new.email_confirmed_at,
    true
  )
  on conflict (id) do nothing;

  v_privacy := lower(coalesce(new.raw_user_meta_data ->> 'privacy_accepted', 'false')) = 'true';
  v_marketing := lower(coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', 'false')) = 'true';
  v_version := nullif(trim(new.raw_user_meta_data ->> 'privacy_policy_version'), '');
  if v_version is null or char_length(v_version) > 32 then
    v_version := '2026-01-01';
  end if;

  if v_privacy then
    insert into public.privacy_consents (
      user_id, consent_type, version, granted, granted_at, locale, ip, user_agent, metadata, source
    )
    values (
      new.id,
      'privacy',
      v_version,
      true,
      coalesce(app.try_timestamptz(new.raw_user_meta_data ->> 'privacy_accepted_at'), now()),
      v_locale,
      app.try_inet(new.raw_user_meta_data ->> 'consent_ip'),
      left(coalesce(new.raw_user_meta_data ->> 'consent_user_agent', ''), 500),
      jsonb_build_object(
        'country', v_country,
        'marketing_opt_in', v_marketing,
        'channel', 'web_signup'
      ),
      'signup'
    )
    on conflict do nothing;
  end if;

  if v_marketing then
    insert into public.privacy_consents (
      user_id, consent_type, version, granted, granted_at, locale, ip, user_agent, metadata, source
    )
    values (
      new.id,
      'marketing',
      v_version,
      true,
      coalesce(app.try_timestamptz(new.raw_user_meta_data ->> 'privacy_accepted_at'), now()),
      v_locale,
      app.try_inet(new.raw_user_meta_data ->> 'consent_ip'),
      left(coalesce(new.raw_user_meta_data ->> 'consent_user_agent', ''), 500),
      jsonb_build_object('channel', 'web_signup'),
      'signup'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep the application mirror in sync when Supabase confirms an email.
create or replace function public.handle_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email_confirmed_at is not null then
    update public.profiles
    set email_verified_at = new.email_confirmed_at
    where id = new.id
      and (email_verified_at is null or email_verified_at < new.email_confirmed_at);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
after insert or update of email_confirmed_at on auth.users
for each row execute function public.handle_email_confirmation();

-- ---------------------------------------------------------------------------
-- Phone verification challenge API (SECURITY DEFINER, auth.uid() only).
-- The caller supplies the HMAC hash, never the code.
-- ---------------------------------------------------------------------------
create or replace function public.request_phone_verification(
  p_code_hash text,
  p_expires_at timestamptz default now() + interval '10 minutes',
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_verified timestamptz;
  v_count integer;
  v_oldest timestamptz;
  v_last timestamptz;
  v_expires timestamptz;
  v_retry integer;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select phone, phone_verified_at into v_phone, v_verified
  from public.profiles
  where id = v_uid;

  if v_verified is not null then
    return jsonb_build_object('status', 'verified');
  end if;
  if v_phone is null or v_phone = '' then
    return jsonb_build_object('status', 'no_phone');
  end if;

  select count(*), min(created_at) into v_count, v_oldest
  from public.otp_verifications
  where user_id = v_uid
    and purpose = 'phone_verification'
    and created_at > now() - interval '1 hour';

  if v_count >= 5 then
    v_retry := greatest(60, ceil(extract(epoch from (v_oldest + interval '1 hour' - now())))::integer);
    return jsonb_build_object('status', 'rate_limited', 'retry_after_seconds', v_retry);
  end if;

  select max(created_at) into v_last
  from public.otp_verifications
  where user_id = v_uid and purpose = 'phone_verification';

  if v_last is not null and v_last > now() - interval '60 seconds' then
    v_retry := greatest(1, ceil(extract(epoch from (v_last + interval '60 seconds' - now())))::integer);
    return jsonb_build_object('status', 'cooldown', 'retry_after_seconds', v_retry);
  end if;

  update public.otp_verifications
  set consumed_at = now()
  where user_id = v_uid and purpose = 'phone_verification' and consumed_at is null;

  v_expires := least(
    greatest(coalesce(p_expires_at, now() + interval '10 minutes'), now() + interval '30 seconds'),
    now() + interval '15 minutes'
  );

  insert into public.otp_verifications (
    user_id, destination, channel, purpose, code_hash, expires_at, max_attempts, ip
  )
  values (
    v_uid, v_phone, 'sms', 'phone_verification', p_code_hash, v_expires, 5, app.try_inet(p_ip)
  );

  return jsonb_build_object(
    'status', 'sent',
    'destination', v_phone,
    'expires_at', v_expires,
    'retry_after_seconds', 60
  );
end;
$$;

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

revoke all on function public.request_phone_verification(text, timestamptz, text) from public, anon;
revoke all on function public.verify_phone_verification(text) from public, anon;
grant execute on function public.request_phone_verification(text, timestamptz, text) to authenticated;
grant execute on function public.verify_phone_verification(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Onboarding wrapper: requires verified identity, creates the first tenant
-- atomically and stores the business profile on it.
-- ---------------------------------------------------------------------------
create or replace function public.complete_onboarding(
  p_name text,
  p_business_type text,
  p_city text,
  p_industry text,
  p_business_size text,
  p_currency text default 'XAF',
  p_fiscal_year_start_month integer default 1,
  p_country text default 'CM',
  p_phone text default null,
  p_timezone text default 'Africa/Douala',
  p_locale text default 'en',
  p_legal_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_workspace jsonb;
  v_workspace_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'Profile required' using errcode = 'check_violation';
  end if;

  if v_profile.verification_required
     and (v_profile.email_verified_at is null or v_profile.phone_verified_at is null) then
    raise exception 'Email and phone verification are required before onboarding'
      using errcode = 'check_violation';
  end if;

  if p_business_type is not null
     and p_business_type not in ('sole_proprietorship','partnership','limited_company','cooperative','nonprofit','other') then
    raise exception 'Unsupported business type' using errcode = 'check_violation';
  end if;
  if p_business_size is not null
     and p_business_size not in ('solo','micro','small','medium','large') then
    raise exception 'Unsupported business size' using errcode = 'check_violation';
  end if;
  if p_fiscal_year_start_month not between 1 and 12 then
    raise exception 'Fiscal year start month must be between 1 and 12'
      using errcode = 'check_violation';
  end if;
  if p_phone is not null and p_phone !~ '^\+[1-9][0-9]{6,15}$' then
    raise exception 'Business phone must be in E.164 format' using errcode = 'check_violation';
  end if;

  v_workspace := public.create_workspace(
    p_name => p_name,
    p_currency => p_currency,
    p_country => p_country,
    p_timezone => p_timezone,
    p_legal_name => p_legal_name,
    p_locale => p_locale
  );
  v_workspace_id := (v_workspace ->> 'id')::uuid;

  update public.workspaces
  set business_type = p_business_type,
      city = nullif(trim(p_city), ''),
      industry = nullif(trim(p_industry), ''),
      business_size = p_business_size,
      phone = p_phone,
      fiscal_year_start_month = p_fiscal_year_start_month,
      settings = settings || jsonb_build_object(
        'onboarding_completed_at', now(),
        'business_type', p_business_type,
        'industry', p_industry,
        'business_size', p_business_size
      )
  where id = v_workspace_id;

  update public.profiles
  set onboarding_completed_at = now(),
      default_workspace_id = v_workspace_id,
      locale = p_locale,
      country_code = upper(p_country)
  where id = v_uid;

  return v_workspace || jsonb_build_object('onboarding_completed', true);
end;
$$;

revoke all on function public.complete_onboarding(
  text, text, text, text, text, text, integer, text, text, text, text, text
) from public, anon;
grant execute on function public.complete_onboarding(
  text, text, text, text, text, text, integer, text, text, text, text, text
) to authenticated;
