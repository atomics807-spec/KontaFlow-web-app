-- =============================================================================
-- KontaFlow · 0005 — workspace provisioning and financial write paths
-- =============================================================================
-- All writes that affect money go through these SECURITY DEFINER functions.
-- Each one re-checks membership and role against auth.uid(); the functions
-- never trust a workspace_id or role supplied by the client.
-- =============================================================================

create or replace function app.write_audit(
  p_workspace_id uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_after jsonb default null,
  p_before jsonb default null,
  p_actor_type public.actor_type default 'user',
  p_actor_id uuid default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_logs (
    workspace_id, actor_id, actor_type, action, entity, entity_id, before_data, after_data
  )
  values (
    p_workspace_id,
    coalesce(p_actor_id, auth.uid()),
    p_actor_type,
    p_action,
    p_entity,
    p_entity_id,
    p_before,
    p_after
  );
$$;

-- ---------------------------------------------------------------------------
-- create_workspace: provisions the tenant, the owner membership, the chart of
-- accounts, the starter categories and a trial subscription in one atomic call.
-- ---------------------------------------------------------------------------
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
  if p_locale not in ('en','fr','wes') then
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
    (v_workspace_id, 'Sales', 'income', '#12B981', true, '{"fr":"Ventes","wes":"Sale"}'::jsonb),
    (v_workspace_id, 'Services', 'income', '#0EA5E9', true, '{"fr":"Services","wes":"Service"}'::jsonb),
    (v_workspace_id, 'Other income', 'income', '#8B5CF6', true, '{"fr":"Autres produits","wes":"Other moni wey kam in"}'::jsonb),
    (v_workspace_id, 'Stock purchases', 'expense', '#F97316', true, '{"fr":"Achats de marchandises","wes":"Buy stock"}'::jsonb),
    (v_workspace_id, 'Supplies', 'expense', '#EF4444', true, '{"fr":"Fournitures","wes":"Supplies"}'::jsonb),
    (v_workspace_id, 'Transport', 'expense', '#F59E0B', true, '{"fr":"Transport","wes":"Transport"}'::jsonb),
    (v_workspace_id, 'Rent', 'expense', '#6366F1', true, '{"fr":"Loyer","wes":"Rent"}'::jsonb),
    (v_workspace_id, 'Salaries', 'expense', '#14B8A6', true, '{"fr":"Salaires","wes":"Salary"}'::jsonb),
    (v_workspace_id, 'Utilities', 'expense', '#06B6D4', true, '{"fr":"Électricité et eau","wes":"Light and water"}'::jsonb),
    (v_workspace_id, 'Fuel', 'expense', '#DC2626', true, '{"fr":"Carburant","wes":"Fuel"}'::jsonb),
    (v_workspace_id, 'Marketing', 'expense', '#DB2777', true, '{"fr":"Marketing","wes":"Marketing"}'::jsonb),
    (v_workspace_id, 'Taxes & fees', 'expense', '#78716C', true, '{"fr":"Impôts et taxes","wes":"Tax"}'::jsonb),
    (v_workspace_id, 'Other expenses', 'expense', '#64748B', true, '{"fr":"Autres charges","wes":"Other expense"}'::jsonb);

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

-- ---------------------------------------------------------------------------
-- record_transaction: the single write path for money. Idempotent when a
-- client_generated_id is supplied (offline sync, USSD retries, AI tools).
-- ---------------------------------------------------------------------------
create or replace function public.record_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_workspace_id uuid;
  v_ws record;
  v_kind public.transaction_kind;
  v_amount bigint;
  v_occurred_on date;
  v_account public.accounts;
  v_counter public.accounts;
  v_category_id uuid;
  v_contact_id uuid;
  v_payment_method public.payment_method;
  v_channel public.entry_channel;
  v_client_id text;
  v_description text;
  v_reference text;
  v_transaction_id uuid;
  v_existing uuid;
  v_money_line_account uuid;
  v_system_account uuid;
  v_line_category uuid;
  v_line_contact uuid;
  v_currency char(3);
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  v_workspace_id := nullif(p_payload ->> 'workspace_id', '')::uuid;
  if v_workspace_id is null or not app.can_write_finance(v_workspace_id) then
    raise exception 'Not allowed to record transactions in this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_ws from public.workspaces where id = v_workspace_id;

  v_client_id := nullif(trim(p_payload ->> 'client_generated_id'), '');
  if v_client_id is not null and char_length(v_client_id) > 120 then
    raise exception 'client_generated_id is too long' using errcode = 'check_violation';
  end if;

  if v_client_id is not null then
    select id into v_existing
    from public.transactions
    where workspace_id = v_workspace_id and client_generated_id = v_client_id;
    if found then
      return jsonb_build_object('id', v_existing, 'duplicate', true, 'status', 'posted');
    end if;
  end if;

  v_kind := (p_payload ->> 'kind')::public.transaction_kind;
  if v_kind is null then
    raise exception 'Transaction kind is required' using errcode = 'check_violation';
  end if;

  if (p_payload ->> 'amount_minor') is null
     or (p_payload ->> 'amount_minor') !~ '^[0-9]+$' then
    raise exception 'amount_minor must be a positive integer in minor units'
      using errcode = 'check_violation';
  end if;
  v_amount := (p_payload ->> 'amount_minor')::bigint;
  if v_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = 'check_violation';
  end if;

  v_description := trim(coalesce(p_payload ->> 'description', ''));
  if char_length(v_description) < 1 or char_length(v_description) > 500 then
    raise exception 'A description between 1 and 500 characters is required'
      using errcode = 'check_violation';
  end if;

  v_currency := coalesce(nullif(p_payload ->> 'currency', '')::char(3), v_ws.currency);
  if v_currency <> v_ws.currency then
    raise exception 'Currency % does not match workspace currency %', v_currency, v_ws.currency
      using errcode = 'check_violation';
  end if;

  v_occurred_on := coalesce(nullif(p_payload ->> 'occurred_on', '')::date, (now() at time zone v_ws.timezone)::date);
  if v_occurred_on > ((now() at time zone v_ws.timezone)::date + 1) then
    raise exception 'Transaction date cannot be in the future' using errcode = 'check_violation';
  end if;
  if v_occurred_on < ((now() at time zone v_ws.timezone)::date - interval '10 years') then
    raise exception 'Transaction date is too far in the past' using errcode = 'check_violation';
  end if;

  select * into v_account
  from public.accounts
  where id = nullif(p_payload ->> 'account_id', '')::uuid
    and workspace_id = v_workspace_id
    and type = 'asset'
    and subtype in ('cash', 'bank', 'mobile_money')
    and not is_archived;
  if not found then
    raise exception 'Select a valid cash, bank or mobile money account'
      using errcode = 'check_violation';
  end if;

  if v_kind = 'transfer' then
    select * into v_counter
    from public.accounts
    where id = nullif(p_payload ->> 'counter_account_id', '')::uuid
      and workspace_id = v_workspace_id
      and type = 'asset'
      and subtype in ('cash', 'bank', 'mobile_money')
      and not is_archived;
    if not found then
      raise exception 'Select a valid destination account for the transfer'
        using errcode = 'check_violation';
    end if;
    if v_counter.id = v_account.id then
      raise exception 'Source and destination accounts must differ' using errcode = 'check_violation';
    end if;
  end if;

  if v_kind in ('income', 'expense') then
    v_category_id := nullif(p_payload ->> 'category_id', '')::uuid;
    if v_category_id is null then
      select id into v_category_id
      from public.categories
      where workspace_id = v_workspace_id
        and kind = v_kind::text::public.category_kind
        and lower(name) = case when v_kind = 'income' then 'other income' else 'other expenses' end
      limit 1;
      if v_category_id is null then
        select id into v_category_id
        from public.categories
        where workspace_id = v_workspace_id and kind = v_kind::text::public.category_kind and not is_archived
        limit 1;
      end if;
    else
      if not exists (
        select 1 from public.categories
        where id = v_category_id
          and workspace_id = v_workspace_id
          and kind = v_kind::text::public.category_kind
      ) then
        raise exception 'Category does not match the transaction type'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  v_contact_id := nullif(p_payload ->> 'contact_id', '')::uuid;
  if v_contact_id is not null and not exists (
    select 1 from public.contacts where id = v_contact_id and workspace_id = v_workspace_id
  ) then
    raise exception 'Contact not found in this workspace' using errcode = 'check_violation';
  end if;

  v_payment_method := case
    when p_payload ->> 'payment_method' in ('cash','mobile_money','bank_transfer','card','cheque','other')
      then (p_payload ->> 'payment_method')::public.payment_method
    else 'cash'::public.payment_method
  end;

  v_channel := case
    when p_payload ->> 'channel' in ('web','ussd','whatsapp','ai','sync','api','system')
      then (p_payload ->> 'channel')::public.entry_channel
    else 'web'::public.entry_channel
  end;

  v_reference := nullif(trim(p_payload ->> 'reference'), '');

  insert into public.transactions (
    workspace_id, kind, occurred_on, description, reference, category_id,
    account_id, counter_account_id, contact_id, amount_minor, currency,
    payment_method, channel, attachment_path, client_generated_id, created_by,
    recorded_timezone, sync_received_at, metadata
  )
  values (
    v_workspace_id, v_kind, v_occurred_on, v_description, v_reference, v_category_id,
    v_account.id, case when v_kind = 'transfer' then v_counter.id else null end,
    v_contact_id, v_amount, v_currency, v_payment_method, v_channel,
    nullif(p_payload ->> 'attachment_path', ''), v_client_id, v_uid,
    v_ws.timezone, case when v_channel = 'sync' then now() else null end,
    coalesce(p_payload -> 'metadata', '{}'::jsonb)
  )
  returning id into v_transaction_id;

  if v_kind = 'income' then
    select id into v_system_account from public.accounts
      where workspace_id = v_workspace_id and subtype = 'revenue' limit 1;
    if v_system_account is null then
      raise exception 'Workspace has no revenue account configured' using errcode = 'check_violation';
    end if;
    v_money_line_account := v_account.id;
    insert into public.ledger_lines (workspace_id, transaction_id, account_id, category_id, contact_id, line_no, debit_minor, memo)
    values (v_workspace_id, v_transaction_id, v_account.id, null, v_contact_id, 1, v_amount, v_description);
    insert into public.ledger_lines (workspace_id, transaction_id, account_id, category_id, contact_id, line_no, credit_minor, memo)
    values (v_workspace_id, v_transaction_id, v_system_account, v_category_id, v_contact_id, 2, v_amount, v_description);
  elsif v_kind = 'expense' then
    select id into v_system_account from public.accounts
      where workspace_id = v_workspace_id and subtype = 'operating_expense' limit 1;
    if v_system_account is null then
      raise exception 'Workspace has no expense account configured' using errcode = 'check_violation';
    end if;
    v_money_line_account := v_account.id;
    insert into public.ledger_lines (workspace_id, transaction_id, account_id, category_id, contact_id, line_no, debit_minor, memo)
    values (v_workspace_id, v_transaction_id, v_system_account, v_category_id, v_contact_id, 1, v_amount, v_description);
    insert into public.ledger_lines (workspace_id, transaction_id, account_id, category_id, contact_id, line_no, credit_minor, memo)
    values (v_workspace_id, v_transaction_id, v_account.id, null, v_contact_id, 2, v_amount, v_description);
  else
    insert into public.ledger_lines (workspace_id, transaction_id, account_id, line_no, debit_minor, memo)
    values (v_workspace_id, v_transaction_id, v_counter.id, 1, v_amount, v_description);
    insert into public.ledger_lines (workspace_id, transaction_id, account_id, line_no, credit_minor, memo)
    values (v_workspace_id, v_transaction_id, v_account.id, 2, v_amount, v_description);
  end if;

  perform app.write_audit(
    v_workspace_id,
    case when v_kind = 'transfer' then 'transaction.transferred' else 'transaction.recorded' end,
    'transaction',
    v_transaction_id,
    jsonb_build_object(
      'kind', v_kind,
      'amount_minor', v_amount,
      'occurred_on', v_occurred_on,
      'account_id', v_account.id,
      'channel', v_channel,
      'description', v_description
    ),
    null,
    case when v_channel in ('ussd','whatsapp','ai','sync') then 'channel'::public.actor_type else 'user'::public.actor_type end
  );

  if v_channel = 'sync' then
    insert into public.usage_events (workspace_id, user_id, kind, quantity)
    values (v_workspace_id, v_uid, 'sync_push', 1);
  end if;

  return jsonb_build_object(
    'id', v_transaction_id,
    'duplicate', false,
    'status', 'posted',
    'amount_minor', v_amount,
    'currency', v_currency
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- void_transaction: corrections keep the original record for the audit trail.
-- ---------------------------------------------------------------------------
create or replace function public.void_transaction(p_transaction_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tx public.transactions;
begin
  select * into v_tx from public.transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction not found' using errcode = 'no_data_found';
  end if;
  if not app.can_manage_records(v_tx.workspace_id) then
    raise exception 'Not allowed to void transactions' using errcode = 'insufficient_privilege';
  end if;
  if v_tx.status = 'voided' then
    raise exception 'Transaction is already voided' using errcode = 'check_violation';
  end if;

  update public.transactions
     set status = 'voided',
         voided_at = now(),
         voided_by = auth.uid(),
         void_reason = nullif(trim(p_reason), '')
   where id = p_transaction_id;

  perform app.write_audit(
    v_tx.workspace_id, 'transaction.voided', 'transaction', p_transaction_id,
    jsonb_build_object('reason', p_reason), to_jsonb(v_tx)
  );

  return jsonb_build_object('id', p_transaction_id, 'status', 'voided');
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_invitation: the signed-in user's email must match the invite.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.email();
  v_invitation public.workspace_invitations;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invitation
  from public.workspace_invitations
  where token = p_token and status = 'pending'
  for update;

  if not found then
    raise exception 'Invitation not found or already used' using errcode = 'no_data_found';
  end if;
  if v_invitation.expires_at < now() then
    update public.workspace_invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'Invitation has expired' using errcode = 'check_violation';
  end if;
  if lower(v_invitation.email) <> lower(coalesce(v_email, '')) then
    raise exception 'This invitation belongs to a different email address'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status, invited_by, joined_at)
  values (v_invitation.workspace_id, v_uid, v_invitation.role, 'active', v_invitation.invited_by, now())
  on conflict (workspace_id, user_id) do update
    set role = excluded.role, status = 'active', joined_at = coalesce(public.workspace_members.joined_at, now());

  update public.workspace_invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_uid
   where id = v_invitation.id;

  update public.profiles
     set default_workspace_id = coalesce(default_workspace_id, v_invitation.workspace_id)
   where id = v_uid;

  perform app.write_audit(
    v_invitation.workspace_id, 'member.joined', 'workspace_member', v_uid,
    jsonb_build_object('role', v_invitation.role), null, 'user', v_uid
  );

  return jsonb_build_object('workspace_id', v_invitation.workspace_id, 'role', v_invitation.role);
end;
$$;
