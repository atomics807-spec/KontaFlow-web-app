-- =============================================================================
-- KontaFlow · 0028 — auditable debt payments and invoice voiding
-- =============================================================================
-- A repayment can optionally post a cash-basis ledger entry. The debt and any
-- linked invoice are always updated by the existing integrity triggers.
-- =============================================================================

create or replace function public.record_debt_payment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_debt public.debts;
  v_amount bigint;
  v_paid_on date;
  v_account_id uuid;
  v_method public.payment_method;
  v_reference text;
  v_notes text;
  v_payment_id uuid;
  v_transaction_id uuid;
  v_category_id uuid;
  v_kind public.transaction_kind;
  v_remaining bigint;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  if (p_payload ->> 'amount_minor') is null
     or (p_payload ->> 'amount_minor') !~ '^[0-9]+$' then
    raise exception 'Amount must be a positive integer in minor units' using errcode = 'check_violation';
  end if;
  v_amount := (p_payload ->> 'amount_minor')::bigint;
  if v_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = 'check_violation';
  end if;

  select * into v_debt
  from public.debts
  where id = nullif(p_payload ->> 'debt_id', '')::uuid
  for update;

  if not found then
    raise exception 'Debt not found' using errcode = 'no_data_found';
  end if;
  if not app.can_write_finance(v_debt.workspace_id) then
    raise exception 'Not allowed to record repayments in this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if v_debt.status = 'written_off' then
    raise exception 'A written-off debt cannot receive payments' using errcode = 'check_violation';
  end if;

  v_remaining := v_debt.principal_minor - v_debt.paid_minor;
  if v_amount > v_remaining then
    raise exception 'The repayment is larger than the remaining balance' using errcode = 'check_violation';
  end if;

  if p_payload ->> 'payment_method' is not null
     and (p_payload ->> 'payment_method') not in
       ('cash', 'mobile_money', 'bank_transfer', 'card', 'cheque', 'other') then
    raise exception 'Unsupported payment method' using errcode = 'check_violation';
  end if;
  v_method := coalesce(nullif(p_payload ->> 'payment_method', ''), 'cash')::public.payment_method;

  v_paid_on := coalesce(
    nullif(p_payload ->> 'paid_on', '')::date,
    (now() at time zone (select timezone from public.workspaces where id = v_debt.workspace_id))::date
  );

  v_account_id := nullif(p_payload ->> 'account_id', '')::uuid;
  if v_account_id is not null and not exists (
    select 1 from public.accounts
    where id = v_account_id
      and workspace_id = v_debt.workspace_id
      and type = 'asset'
      and subtype in ('cash', 'bank', 'mobile_money')
      and not is_archived
  ) then
    raise exception 'Select an active money account in this workspace' using errcode = 'check_violation';
  end if;

  v_reference := nullif(trim(p_payload ->> 'reference'), '');
  v_notes := nullif(trim(p_payload ->> 'notes'), '');
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'Notes are too long' using errcode = 'check_violation';
  end if;

  insert into public.debt_payments (
    workspace_id, debt_id, amount_minor, paid_on, account_id,
    payment_method, reference, notes, created_by
  )
  values (
    v_debt.workspace_id, v_debt.id, v_amount, v_paid_on, v_account_id,
    v_method, v_reference, v_notes, v_uid
  )
  returning id into v_payment_id;

  if v_account_id is not null then
    v_kind := case when v_debt.direction = 'receivable' then 'income'::public.transaction_kind
                   else 'expense'::public.transaction_kind end;

    select id into v_category_id
    from public.categories
    where workspace_id = v_debt.workspace_id
      and kind = case when v_debt.direction = 'receivable' then 'income'::public.category_kind
                      else 'expense'::public.category_kind end
      and is_system
      and not is_archived
    order by
      case when v_debt.direction = 'receivable' and name = 'Sales' then 0
           when v_debt.direction = 'payable' and name = 'Other expenses' then 0
           else 1 end,
      name
    limit 1;

    if v_category_id is null then
      raise exception 'The workspace category catalogue is incomplete' using errcode = 'no_data_found';
    end if;

    select (public.record_transaction(jsonb_build_object(
      'workspace_id', v_debt.workspace_id,
      'kind', v_kind,
      'amount_minor', v_amount::text,
      'description', left(
        case when v_debt.direction = 'receivable' then 'Repayment received: ' else 'Repayment made: ' end
        || v_debt.description, 500),
      'occurred_on', v_paid_on,
      'category_id', v_category_id,
      'account_id', v_account_id,
      'contact_id', v_debt.contact_id,
      'payment_method', v_method,
      'reference', coalesce(v_reference, 'Debt repayment'),
      'client_generated_id', 'debt-payment:' || v_payment_id::text,
      'channel', 'web',
      'currency', v_debt.currency
    )) ->> 'id')::uuid into v_transaction_id;

    update public.debt_payments
       set transaction_id = v_transaction_id
     where id = v_payment_id;
  end if;

  perform app.write_audit(
    v_debt.workspace_id, 'debt.payment_recorded', 'debt_payment', v_payment_id,
    jsonb_build_object(
      'debt_id', v_debt.id, 'amount_minor', v_amount,
      'account_id', v_account_id, 'transaction_id', v_transaction_id
    )
  );

  return jsonb_build_object(
    'id', v_payment_id,
    'transaction_id', v_transaction_id,
    'status', (select status from public.debts where id = v_debt.id)
  );
end;
$$;

revoke all on function public.record_debt_payment(jsonb) from public, anon;
grant execute on function public.record_debt_payment(jsonb) to authenticated;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_invoice public.invoices;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'no_data_found';
  end if;
  if not app.can_write_finance(v_invoice.workspace_id) then
    raise exception 'Not allowed to void invoices in this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if v_invoice.status = 'void' then
    raise exception 'Invoice is already void' using errcode = 'check_violation';
  end if;
  if v_invoice.status = 'paid'
     or v_invoice.amount_paid_minor > 0
     or exists (
       select 1 from public.debt_payments dp
       join public.debts d on d.id = dp.debt_id
       where d.invoice_id = v_invoice.id and dp.voided_at is null
     ) then
    raise exception 'An invoice with recorded payments cannot be voided'
      using errcode = 'check_violation';
  end if;

  update public.debts
     set status = 'written_off', closed_at = coalesce(closed_at, now())
   where invoice_id = v_invoice.id
     and status <> 'written_off';

  update public.invoices
     set status = 'void',
         void_reason = nullif(trim(p_reason), '')
   where id = v_invoice.id;

  perform app.write_audit(
    v_invoice.workspace_id, 'invoice.voided', 'invoice', v_invoice.id,
    jsonb_build_object('number', v_invoice.number, 'reason', nullif(trim(p_reason), ''))
  );

  return jsonb_build_object('id', v_invoice.id, 'status', 'void');
end;
$$;

revoke all on function public.void_invoice(uuid, text) from public, anon;
grant execute on function public.void_invoice(uuid, text) to authenticated;
