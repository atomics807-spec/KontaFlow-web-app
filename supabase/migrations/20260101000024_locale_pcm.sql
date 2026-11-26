-- =============================================================================
-- KontaFlow · 0024 — Cameroonian Pidgin locale code `pcm`
-- Converts legacy `wes` values and upgrades existing constraints/triggers.
-- =============================================================================

alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.workspaces drop constraint if exists workspaces_locale_check;
alter table public.contact_messages drop constraint if exists contact_messages_locale_check;
alter table public.privacy_consents drop constraint if exists privacy_consents_locale_check;

update public.profiles set locale = 'pcm' where locale = 'wes';
update public.workspaces set locale = 'pcm' where locale = 'wes';
update public.contact_messages set locale = 'pcm' where locale = 'wes';
update public.privacy_consents set locale = 'pcm' where locale = 'wes';

alter table public.profiles
  add constraint profiles_locale_check check (locale in ('en', 'fr', 'pcm'));
alter table public.workspaces
  add constraint workspaces_locale_check check (locale in ('en', 'fr', 'pcm'));
alter table public.contact_messages
  add constraint contact_messages_locale_check check (locale in ('en', 'fr', 'pcm'));
alter table public.privacy_consents
  add constraint privacy_consents_locale_check
  check (locale is null or locale in ('en', 'fr', 'pcm'));

update public.categories
set translations = translations || jsonb_build_object('pcm', translations ->> 'wes')
where translations ? 'wes' and not translations ? 'pcm';

update public.categories
set translations = translations - 'wes'
where translations ? 'wes' and translations ? 'pcm';

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
  if v_locale = 'wes' then
    v_locale := 'pcm';
  end if;
  if v_locale not in ('en', 'fr', 'pcm') then
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
