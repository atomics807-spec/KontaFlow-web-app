-- =============================================================================
-- KontaFlow · 0039 — MTN MoMo / Orange Money payment lifecycle
-- =============================================================================
-- Payment rows are created by the authenticated checkout route, then advanced
-- only by service-role code after a provider callback and an authoritative
-- status check. The database repeats the amount, currency, reference and state
-- checks so a bug in one adapter cannot grant a subscription on its own.
-- =============================================================================

alter table public.payment_transactions
  add column if not exists merchant_reference text,
  add column if not exists plan_id uuid references public.subscription_plans (id) on delete restrict,
  add column if not exists plan_code text,
  add column if not exists payer_msisdn text,
  add column if not exists checkout_url text,
  add column if not exists provider_status text,
  add column if not exists failure_code text,
  add column if not exists failure_message text,
  add column if not exists expires_at timestamptz,
  add column if not exists initiated_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists reconciled_at timestamptz,
  add column if not exists refunded_amount_minor bigint not null default 0,
  add column if not exists refunded_at timestamptz,
  add column if not exists reversed_at timestamptz,
  add column if not exists idempotency_key text,
  add column if not exists webhook_token_hash text,
  add column if not exists updated_at timestamptz not null default now();

update public.payment_transactions
   set merchant_reference = 'legacy-' || replace(id::text, '-', '')
 where merchant_reference is null;

update public.payment_transactions
   set expires_at = created_at + interval '30 minutes'
 where expires_at is null;

update public.payment_transactions
   set plan_code = nullif(metadata ->> 'plan_code', '')
 where plan_code is null;

update public.payment_transactions p
   set plan_id = s.id
  from public.subscription_plans s
 where p.plan_id is null
   and p.plan_code = s.code::text;

update public.payment_transactions
   set refunded_amount_minor = amount_minor
 where status = 'refunded' and refunded_amount_minor = 0;

alter table public.payment_transactions
  alter column merchant_reference set not null;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_merchant_reference_check;
alter table public.payment_transactions
  add constraint payment_transactions_merchant_reference_check
  check (merchant_reference ~ '^[A-Za-z0-9_-]{8,80}$');

alter table public.payment_transactions
  drop constraint if exists payment_transactions_payer_msisdn_check;
alter table public.payment_transactions
  add constraint payment_transactions_payer_msisdn_check
  check (payer_msisdn is null or payer_msisdn ~ '^[1-9][0-9]{5,31}$');

alter table public.payment_transactions
  drop constraint if exists payment_transactions_webhook_hash_check;
alter table public.payment_transactions
  add constraint payment_transactions_webhook_hash_check
  check (webhook_token_hash is null or webhook_token_hash ~ '^[a-f0-9]{64}$');

alter table public.payment_transactions
  drop constraint if exists payment_transactions_refunded_amount_check;
alter table public.payment_transactions
  add constraint payment_transactions_refunded_amount_check
  check (refunded_amount_minor >= 0 and refunded_amount_minor <= amount_minor);

alter table public.payment_transactions
  drop constraint if exists payment_transactions_expiry_check;
alter table public.payment_transactions
  add constraint payment_transactions_expiry_check
  check (expires_at is null or expires_at >= created_at);

create unique index if not exists payment_transactions_merchant_reference_key
  on public.payment_transactions (merchant_reference);

create unique index if not exists payment_transactions_idempotency_key
  on public.payment_transactions (workspace_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payment_transactions_status_idx
  on public.payment_transactions (status, created_at desc);

create index if not exists payment_transactions_expiry_idx
  on public.payment_transactions (expires_at)
  where status in ('pending', 'processing');

drop trigger if exists payment_transactions_set_updated_at on public.payment_transactions;
create trigger payment_transactions_set_updated_at before update on public.payment_transactions
for each row execute function app.set_updated_at();

comment on column public.payment_transactions.merchant_reference is
  'KontaFlow-generated reference sent to the provider. Never derived from the browser.';
comment on column public.payment_transactions.webhook_token_hash is
  'SHA-256 of the per-payment callback token. The raw token is never stored.';

-- ------------------------------- refunds ------------------------------------
create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  payment_transaction_id uuid not null references public.payment_transactions (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  status text not null default 'succeeded'
    check (status in ('pending', 'succeeded', 'failed')),
  kind text not null default 'refund' check (kind in ('refund', 'reversal')),
  provider_ref text,
  reason text check (reason is null or char_length(reason) <= 500),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_refunds_payment_idx
  on public.payment_refunds (payment_transaction_id, created_at desc);

alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from public, anon, authenticated;
grant all on public.payment_refunds to service_role;

-- ----------------------------- webhook inbox --------------------------------
alter table public.payment_webhooks
  add column if not exists payload_hash text,
  add column if not exists verified_at timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text;

alter table public.payment_webhooks enable row level security;
revoke all on public.payment_webhooks from public, anon, authenticated;
grant all on public.payment_webhooks to service_role;

create index if not exists payment_webhooks_status_idx
  on public.payment_webhooks (status, received_at desc);

comment on table public.payment_webhooks is
  'Service-role-only provider callback inbox. Deduplicates on provider + external event id.';

-- ------------------------ payment lifecycle RPCs ----------------------------
create or replace function public.create_payment_intent(
  p_workspace_id uuid,
  p_plan_code text,
  p_provider text,
  p_payer_msisdn text,
  p_idempotency_key text,
  p_merchant_reference text,
  p_webhook_token_hash text,
  p_actor_id uuid,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.subscription_plans;
  v_subscription public.subscriptions;
  v_existing public.payment_transactions;
  v_payment public.payment_transactions;
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_idempotency text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_payer text := nullif(regexp_replace(coalesce(p_payer_msisdn, ''), '[^0-9]', '', 'g'), '');
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = 'insufficient_privilege';
  end if;
  if v_provider not in ('mtn_momo', 'orange_money', 'aggregator') then
    raise exception 'Unsupported payment provider' using errcode = 'check_violation';
  end if;
  if p_merchant_reference is null or p_merchant_reference !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Invalid merchant reference' using errcode = 'check_violation';
  end if;
  if p_webhook_token_hash is null or p_webhook_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid webhook token hash' using errcode = 'check_violation';
  end if;
  if v_payer is not null and v_payer !~ '^[1-9][0-9]{5,31}$' then
    raise exception 'Invalid payer phone number' using errcode = 'check_violation';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'Payment expiry must be in the future' using errcode = 'check_violation';
  end if;

  if v_idempotency is not null then
    select * into v_existing
    from public.payment_transactions
    where workspace_id = p_workspace_id and idempotency_key = v_idempotency
    for update;
    if found then
      if v_existing.provider <> v_provider or coalesce(v_existing.plan_code, '') <> p_plan_code then
        raise exception 'Idempotency key reused with different payment details'
          using errcode = 'check_violation';
      end if;
      return jsonb_build_object(
        'payment_id', v_existing.id,
        'merchant_reference', v_existing.merchant_reference,
        'provider', v_existing.provider,
        'plan_code', v_existing.plan_code,
        'amount_minor', v_existing.amount_minor,
        'currency', v_existing.currency,
        'status', v_existing.status,
        'checkout_url', v_existing.checkout_url,
        'expires_at', v_existing.expires_at,
        'reused', true
      );
    end if;
  end if;

  select * into v_plan
  from public.subscription_plans
  where code = p_plan_code and is_active;
  if not found then
    raise exception 'Plan not found' using errcode = 'no_data_found';
  end if;
  if v_plan.price_minor <= 0 then
    raise exception 'This plan does not require a payment' using errcode = 'check_violation';
  end if;

  select * into v_subscription
  from public.subscriptions
  where workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'no_data_found';
  end if;

  insert into public.payment_transactions (
    workspace_id, subscription_id, provider, provider_ref, merchant_reference,
    amount_minor, currency, status, plan_id, plan_code, payer_msisdn, expires_at,
    idempotency_key, webhook_token_hash, metadata
  )
  values (
    p_workspace_id, v_subscription.id, v_provider, null, p_merchant_reference,
    v_plan.price_minor, v_plan.currency, 'pending', v_plan.id, v_plan.code::text,
    v_payer, p_expires_at, v_idempotency, p_webhook_token_hash,
    jsonb_build_object(
      'plan_name', v_plan.name,
      'price_minor', v_plan.price_minor,
      'initiated_by', p_actor_id
    )
  )
  returning * into v_payment;

  perform app.write_audit(
    p_workspace_id,
    'payment.created',
    'payment_transaction',
    v_payment.id,
    jsonb_build_object(
      'provider', v_provider,
      'merchant_reference', v_payment.merchant_reference,
      'plan', v_plan.code,
      'amount_minor', v_payment.amount_minor,
      'currency', v_payment.currency
    ),
    null,
    'user',
    p_actor_id
  );

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'merchant_reference', v_payment.merchant_reference,
    'provider', v_payment.provider,
    'plan_code', v_payment.plan_code,
    'amount_minor', v_payment.amount_minor,
    'currency', v_payment.currency,
    'status', v_payment.status,
    'checkout_url', v_payment.checkout_url,
    'expires_at', v_payment.expires_at,
    'reused', false
  );
end;
$$;

revoke all on function public.create_payment_intent(uuid, text, text, text, text, text, text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_payment_intent(uuid, text, text, text, text, text, text, uuid, timestamptz)
  to service_role;

create or replace function public.mark_payment_initiated(
  p_payment_id uuid,
  p_provider_ref text,
  p_checkout_url text,
  p_provider_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payment_transactions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = 'insufficient_privilege';
  end if;
  if p_provider_ref is null or char_length(trim(p_provider_ref)) < 3 then
    raise exception 'Provider reference is required' using errcode = 'check_violation';
  end if;

  select * into v_payment
  from public.payment_transactions
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'no_data_found';
  end if;
  if v_payment.status = 'succeeded' then
    return jsonb_build_object('duplicate', true, 'status', v_payment.status);
  end if;
  if v_payment.status not in ('pending', 'processing') then
    raise exception 'Payment can no longer be initiated' using errcode = 'check_violation';
  end if;
  if v_payment.provider_ref is not null and v_payment.provider_ref <> trim(p_provider_ref) then
    raise exception 'Provider reference already set' using errcode = 'check_violation';
  end if;

  update public.payment_transactions
     set provider_ref = trim(p_provider_ref),
         checkout_url = p_checkout_url,
         provider_status = p_provider_status,
         status = 'processing',
         initiated_at = coalesce(initiated_at, now()),
         last_checked_at = now(),
         metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
   where id = p_payment_id
   returning * into v_payment;

  perform app.write_audit(
    v_payment.workspace_id,
    'payment.provider_initiated',
    'payment_transaction',
    v_payment.id,
    jsonb_build_object(
      'provider', v_payment.provider,
      'provider_ref', v_payment.provider_ref,
      'provider_status', v_payment.provider_status
    )
  );

  return jsonb_build_object('duplicate', false, 'status', v_payment.status);
end;
$$;

revoke all on function public.mark_payment_initiated(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_payment_initiated(uuid, text, text, text, jsonb)
  to service_role;

create or replace function public.fail_payment(
  p_payment_id uuid,
  p_code text,
  p_message text,
  p_status text default 'failed'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payment_transactions;
  v_status public.payment_status;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('failed', 'expired') then
    raise exception 'Invalid failure status' using errcode = 'check_violation';
  end if;
  v_status := p_status::public.payment_status;

  select * into v_payment
  from public.payment_transactions
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'no_data_found';
  end if;
  if v_payment.status in ('succeeded', 'refunded', 'reversed') then
    return jsonb_build_object('duplicate', true, 'status', v_payment.status);
  end if;
  if v_payment.status = v_status and v_payment.failure_code = p_code then
    return jsonb_build_object('duplicate', true, 'status', v_payment.status);
  end if;

  update public.payment_transactions
     set status = v_status,
         failure_code = left(coalesce(p_code, 'provider_error'), 80),
         failure_message = left(coalesce(p_message, 'The payment did not complete.'), 500),
         completed_at = now(),
         last_checked_at = now()
   where id = p_payment_id
   returning * into v_payment;

  perform app.write_audit(
    v_payment.workspace_id,
    'payment.failed',
    'payment_transaction',
    v_payment.id,
    jsonb_build_object(
      'provider', v_payment.provider,
      'status', v_payment.status,
      'failure_code', v_payment.failure_code
    )
  );

  return jsonb_build_object('duplicate', false, 'status', v_payment.status);
end;
$$;

revoke all on function public.fail_payment(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.fail_payment(uuid, text, text, text)
  to service_role;

create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_provider_ref text,
  p_paid_at timestamptz,
  p_amount_minor bigint,
  p_currency text,
  p_provider_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payment_transactions;
  v_plan public.subscription_plans;
  v_subscription public.subscriptions;
  v_workspace public.workspaces;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = 'insufficient_privilege';
  end if;
  if p_provider_ref is null or char_length(trim(p_provider_ref)) < 3 then
    raise exception 'Provider reference is required' using errcode = 'check_violation';
  end if;

  select * into v_payment
  from public.payment_transactions
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'no_data_found';
  end if;

  if v_payment.status = 'succeeded' then
    if v_payment.provider_ref = trim(p_provider_ref)
       and v_payment.amount_minor = p_amount_minor
       and v_payment.currency = upper(p_currency) then
      return jsonb_build_object('duplicate', true, 'status', v_payment.status);
    end if;
    raise exception 'Payment already confirmed with different details' using errcode = 'check_violation';
  end if;
  if v_payment.status in ('refunded', 'reversed') then
    raise exception 'Payment has already been refunded or reversed' using errcode = 'check_violation';
  end if;
  if v_payment.provider_ref is not null and v_payment.provider_ref <> trim(p_provider_ref) then
    raise exception 'Provider reference mismatch' using errcode = 'check_violation';
  end if;
  if p_amount_minor <> v_payment.amount_minor then
    raise exception 'Payment amount mismatch' using errcode = 'check_violation';
  end if;
  if upper(p_currency) <> v_payment.currency then
    raise exception 'Payment currency mismatch' using errcode = 'check_violation';
  end if;

  select * into v_plan
  from public.subscription_plans
  where (v_payment.plan_id is not null and id = v_payment.plan_id)
     or (v_payment.plan_id is null and code = v_payment.plan_code)
  for update;
  if not found or not v_plan.is_active then
    raise exception 'Plan not found' using errcode = 'no_data_found';
  end if;
  if v_payment.amount_minor < v_plan.price_minor then
    raise exception 'Payment amount is below the plan price' using errcode = 'check_violation';
  end if;
  if v_payment.currency <> v_plan.currency then
    raise exception 'Payment currency does not match the plan' using errcode = 'check_violation';
  end if;

  select * into v_subscription
  from public.subscriptions
  where workspace_id = v_payment.workspace_id
  for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'no_data_found';
  end if;

  update public.payment_transactions
     set status = 'succeeded',
         provider_ref = trim(p_provider_ref),
         provider_status = p_provider_status,
         paid_at = coalesce(p_paid_at, now()),
         completed_at = now(),
         reconciled_at = now(),
         last_checked_at = now(),
         failure_code = null,
         failure_message = null,
         metadata = metadata || coalesce(p_metadata, '{}'::jsonb) ||
           jsonb_build_object('provider_status', p_provider_status, 'confirmed_at', now())
   where id = p_payment_id
   returning * into v_payment;

  update public.subscriptions
     set plan = v_plan.code::public.workspace_plan,
         plan_id = v_plan.id,
         status = 'active',
         provider = v_payment.provider,
         provider_ref = v_payment.provider_ref,
         price_minor = v_plan.price_minor,
         currency = v_plan.currency,
         seats = greatest(v_plan.seats_included, 1),
         trial_plan_id = null,
         trial_ends_at = null,
         current_period_start = now(),
         current_period_end = now() + interval '30 days',
         cancel_at_period_end = false,
         canceled_at = null
   where id = v_subscription.id;

  update public.workspaces
     set plan = v_plan.code::public.workspace_plan
   where id = v_payment.workspace_id;

  select * into v_workspace
  from public.workspaces
  where id = v_payment.workspace_id;

  perform app.write_audit(
    v_payment.workspace_id,
    'payment.succeeded',
    'payment_transaction',
    v_payment.id,
    jsonb_build_object(
      'provider', v_payment.provider,
      'provider_ref', v_payment.provider_ref,
      'provider_status', v_payment.provider_status,
      'amount_minor', v_payment.amount_minor,
      'currency', v_payment.currency,
      'plan', v_plan.code
    )
  );

  perform app.write_audit(
    v_payment.workspace_id,
    'subscription.activated',
    'subscription',
    v_subscription.id,
    jsonb_build_object(
      'plan', v_plan.code,
      'payment_id', v_payment.id,
      'provider', v_payment.provider,
      'amount_minor', v_payment.amount_minor,
      'currency', v_payment.currency
    )
  );

  insert into public.notifications (
    workspace_id, user_id, channel, title, body, data, sent_at
  )
  values (
    v_payment.workspace_id,
    v_workspace.owner_id,
    'in_app',
    'Payment confirmed',
    'Your ' || v_plan.name || ' plan is active.',
    jsonb_build_object(
      'kind', 'payment_succeeded',
      'payment_id', v_payment.id,
      'plan', v_plan.code,
      'amount_minor', v_payment.amount_minor,
      'currency', v_payment.currency
    ),
    now()
  );

  return jsonb_build_object(
    'duplicate', false,
    'payment_id', v_payment.id,
    'workspace_id', v_payment.workspace_id,
    'workspace_name', v_workspace.name,
    'owner_id', v_workspace.owner_id,
    'owner_locale', v_workspace.locale,
    'plan_code', v_plan.code,
    'plan_name', v_plan.name,
    'amount_minor', v_payment.amount_minor,
    'currency', v_payment.currency,
    'status', v_payment.status
  );
end;
$$;

revoke all on function public.confirm_payment(uuid, text, timestamptz, bigint, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, text, timestamptz, bigint, text, text, jsonb)
  to service_role;

create or replace function public.refund_payment(
  p_payment_id uuid,
  p_amount_minor bigint,
  p_provider_ref text,
  p_reason text,
  p_actor_id uuid,
  p_kind text default 'refund'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payment_transactions;
  v_subscription public.subscriptions;
  v_remaining bigint;
  v_full boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = 'insufficient_privilege';
  end if;
  if p_kind not in ('refund', 'reversal') then
    raise exception 'Invalid refund kind' using errcode = 'check_violation';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Refund amount must be positive' using errcode = 'check_violation';
  end if;

  select * into v_payment
  from public.payment_transactions
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'no_data_found';
  end if;
  if v_payment.status <> 'succeeded' then
    raise exception 'Only a successful payment can be refunded' using errcode = 'check_violation';
  end if;

  v_remaining := v_payment.amount_minor - v_payment.refunded_amount_minor;
  if p_amount_minor > v_remaining then
    raise exception 'Refund exceeds the remaining paid amount' using errcode = 'check_violation';
  end if;
  v_full := p_amount_minor = v_remaining;

  insert into public.payment_refunds (
    workspace_id, payment_transaction_id, amount_minor, currency, status, kind,
    provider_ref, reason, requested_by, completed_at, metadata
  )
  values (
    v_payment.workspace_id, v_payment.id, p_amount_minor, v_payment.currency,
    'succeeded', p_kind, nullif(trim(p_provider_ref), ''), nullif(trim(p_reason), ''),
    p_actor_id, now(), jsonb_build_object('full', v_full)
  );

  update public.payment_transactions
     set refunded_amount_minor = refunded_amount_minor + p_amount_minor,
         refunded_at = now(),
         status = case
           when v_full and p_kind = 'reversal' then 'reversed'::public.payment_status
           when v_full then 'refunded'::public.payment_status
           else status
         end,
         reversed_at = case when v_full and p_kind = 'reversal' then now() else reversed_at end,
         last_checked_at = now()
   where id = p_payment_id
   returning * into v_payment;

  select * into v_subscription
  from public.subscriptions
  where workspace_id = v_payment.workspace_id
  for update;

  if v_full and found then
    if p_kind = 'reversal' then
      update public.subscriptions
         set status = 'past_due'
       where id = v_subscription.id;
      perform app.write_audit(
        v_payment.workspace_id,
        'subscription.reversed',
        'subscription',
        v_subscription.id,
        jsonb_build_object('payment_id', v_payment.id, 'reason', left(coalesce(p_reason, ''), 500))
      );
    else
      update public.subscriptions
         set cancel_at_period_end = true,
             canceled_at = now()
       where id = v_subscription.id;
      perform app.write_audit(
        v_payment.workspace_id,
        'subscription.refunded',
        'subscription',
        v_subscription.id,
        jsonb_build_object('payment_id', v_payment.id, 'reason', left(coalesce(p_reason, ''), 500))
      );
    end if;
  end if;

  perform app.write_audit(
    v_payment.workspace_id,
    case when p_kind = 'reversal' then 'payment.reversed' else 'payment.refunded' end,
    'payment_transaction',
    v_payment.id,
    jsonb_build_object(
      'amount_minor', p_amount_minor,
      'currency', v_payment.currency,
      'full', v_full,
      'provider_ref', nullif(trim(p_provider_ref), ''),
      'reason', left(coalesce(p_reason, ''), 500)
    ),
    null,
    'user',
    p_actor_id
  );

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'status', v_payment.status,
    'refunded_amount_minor', v_payment.refunded_amount_minor,
    'full', v_full
  );
end;
$$;

revoke all on function public.refund_payment(uuid, bigint, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.refund_payment(uuid, bigint, text, text, uuid, text)
  to service_role;

create or replace function public.touch_payment(
  p_payment_id uuid,
  p_provider_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = 'insufficient_privilege';
  end if;
  update public.payment_transactions
     set last_checked_at = now(),
         provider_status = left(coalesce(p_provider_status, provider_status), 80)
   where id = p_payment_id;
end;
$$;

revoke all on function public.touch_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.touch_payment(uuid, text) to service_role;

-- ------------------------------- grants -------------------------------------
revoke insert, update, delete on public.payment_transactions from authenticated;
revoke all on public.payment_webhooks from public, anon, authenticated;
grant all on public.payment_webhooks to service_role;
