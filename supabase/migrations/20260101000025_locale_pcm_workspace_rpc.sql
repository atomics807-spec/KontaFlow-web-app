-- =============================================================================
-- KontaFlow · 0025 — create_workspace accepts the canonical `pcm` locale
-- Existing databases kept the earlier function body after migration 0005 was
-- corrected, so replace it explicitly. Fresh databases already get `pcm` from
-- 0005 and simply re-create the same function here.
-- =============================================================================

create or replace function public.create_workspace(
  p_name text,
  p_currency text default 'XAF',
  p_country text default 'CM',
  p_timezone text default 'Africa/Douala',
  p_legal_name text default null,
  p_locale text default 'en'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
  v_workspace_id uuid;
  v_suffix text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'Business name must be between 1 and 120 characters'
      using errcode = 'check_violation';
  end if;
  if p_currency not in ('XAF','XOF','USD','EUR','GBP','NGN','KES','GHS') then
    raise exception 'Unsupported currency %', p_currency using errcode = 'check_violation';
  end if;
  if p_locale not in ('en','fr','pcm') then
    raise exception 'Unsupported locale' using errcode = 'check_violation';
  end if;
  if p_country is null or char_length(p_country) <> 2 then
    raise exception 'Country must be an ISO 3166-1 alpha-2 code' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    insert into public.profiles (id, full_name)
    values (v_uid, coalesce((auth.jwt() ->> 'email'), ''))
    on conflict (id) do nothing;
  end if;

  v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'business';
  end if;
  v_slug := left(v_slug, 40) || '-' || v_suffix;

  insert into public.workspaces (
    name, legal_name, slug, owner_id, currency, timezone, locale, country_code
  )
  values (
    v_name, nullif(trim(p_legal_name), ''), v_slug, v_uid, p_currency, p_timezone, p_locale, upper(p_country)
  )
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  values (v_workspace_id, v_uid, 'owner', 'active', now());

  insert into public.accounts (workspace_id, name, type, subtype, currency, is_system)
  values
    (v_workspace_id, 'Cash', 'asset', 'cash', p_currency, true),
    (v_workspace_id, 'Mobile money', 'asset', 'mobile_money', p_currency, true),
    (v_workspace_id, 'Bank', 'asset', 'bank', p_currency, true),
    (v_workspace_id, 'Accounts receivable', 'asset', 'receivable', p_currency, true),
    (v_workspace_id, 'Accounts payable', 'liability', 'payable', p_currency, true),
    (v_workspace_id, 'Owner equity', 'equity', 'equity', p_currency, true),
    (v_workspace_id, 'Sales revenue', 'income', 'revenue', p_currency, true),
    (v_workspace_id, 'Operating expenses', 'expense', 'operating_expense', p_currency, true);

  insert into public.categories (workspace_id, name, kind, color, is_system, translations)
  values
    (v_workspace_id, 'Sales', 'income', '#12B981', true, '{"fr":"Ventes","pcm":"Sale"}'::jsonb),
    (v_workspace_id, 'Services', 'income', '#0EA5E9', true, '{"fr":"Services","pcm":"Service"}'::jsonb),
    (v_workspace_id, 'Other income', 'income', '#8B5CF6', true, '{"fr":"Autres produits","pcm":"Other moni wey kam in"}'::jsonb),
    (v_workspace_id, 'Stock purchases', 'expense', '#F97316', true, '{"fr":"Achats de marchandises","pcm":"Buy stock"}'::jsonb),
    (v_workspace_id, 'Supplies', 'expense', '#EF4444', true, '{"fr":"Fournitures","pcm":"Supplies"}'::jsonb),
    (v_workspace_id, 'Transport', 'expense', '#F59E0B', true, '{"fr":"Transport","pcm":"Transport"}'::jsonb),
    (v_workspace_id, 'Rent', 'expense', '#6366F1', true, '{"fr":"Loyer","pcm":"Rent"}'::jsonb),
    (v_workspace_id, 'Salaries', 'expense', '#14B8A6', true, '{"fr":"Salaires","pcm":"Salary"}'::jsonb),
    (v_workspace_id, 'Utilities', 'expense', '#06B6D4', true, '{"fr":"Électricité et eau","pcm":"Light and water"}'::jsonb),
    (v_workspace_id, 'Fuel', 'expense', '#DC2626', true, '{"fr":"Carburant","pcm":"Fuel"}'::jsonb),
    (v_workspace_id, 'Marketing', 'expense', '#DB2777', true, '{"fr":"Marketing","pcm":"Marketing"}'::jsonb),
    (v_workspace_id, 'Taxes & fees', 'expense', '#78716C', true, '{"fr":"Impôts et taxes","pcm":"Tax"}'::jsonb),
    (v_workspace_id, 'Other expenses', 'expense', '#64748B', true, '{"fr":"Autres charges","pcm":"Other expense"}'::jsonb);

  insert into public.subscriptions (workspace_id, plan, status, price_minor, currency, trial_ends_at, current_period_start, current_period_end)
  values (v_workspace_id, 'starter', 'trialing', 0, p_currency, now() + interval '7 days', now(), now() + interval '7 days');

  update public.profiles
     set default_workspace_id = coalesce(default_workspace_id, v_workspace_id)
   where id = v_uid;

  perform app.write_audit(
    v_workspace_id, 'workspace.created', 'workspace', v_workspace_id,
    jsonb_build_object('name', v_name, 'currency', p_currency, 'country', upper(p_country))
  );

  return jsonb_build_object(
    'id', v_workspace_id,
    'name', v_name,
    'slug', v_slug,
    'currency', p_currency,
    'timezone', p_timezone,
    'locale', p_locale
  );
end;
$$;
