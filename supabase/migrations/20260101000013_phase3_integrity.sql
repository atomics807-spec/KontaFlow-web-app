-- =============================================================================
-- KontaFlow · 0013 — integrity triggers, invoice numbering and reversals
-- =============================================================================
-- Derived money is always computed here, in the database, from integer
-- quantities. Historical records are corrected by reversing, never by editing.
-- =============================================================================

-- ------------------------------- invoices ----------------------------------
create or replace function app.calculate_invoice_item_total()
returns trigger
language plpgsql
as $$
begin
  new.line_total_minor := round(new.quantity * new.unit_price_minor)::bigint;
  return new;
end;
$$;

drop trigger if exists invoice_items_calculate_total on public.invoice_items;
create trigger invoice_items_calculate_total
before insert or update of quantity, unit_price_minor on public.invoice_items
for each row execute function app.calculate_invoice_item_total();

create or replace function app.assert_invoice_item_draft()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.invoice_status;
begin
  select status into v_status
  from public.invoices
  where id = case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;

  if v_status is null then
    raise exception 'Invoice not found' using errcode = 'check_violation';
  end if;
  if v_status <> 'draft' then
    raise exception 'Invoice items can only change while the invoice is a draft'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists invoice_items_draft_guard on public.invoice_items;
create trigger invoice_items_draft_guard
before insert or update or delete on public.invoice_items
for each row execute function app.assert_invoice_item_draft();

create or replace function app.recalculate_invoice_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices i
     set subtotal_minor = totals.subtotal,
         tax_minor = totals.tax,
         total_minor = totals.total
  from (
    select
      coalesce(sum(line_total_minor), 0)::bigint as subtotal,
      coalesce(sum(round(line_total_minor::numeric * tax_rate_bp / 10000)), 0)::bigint as tax,
      coalesce(sum(line_total_minor) + sum(round(line_total_minor::numeric * tax_rate_bp / 10000)), 0)::bigint as total
    from public.invoice_items
    where invoice_id = v_invoice_id
  ) totals
  where i.id = v_invoice_id;
  return null;
end;
$$;

drop trigger if exists invoice_items_recalculate on public.invoice_items;
create trigger invoice_items_recalculate
after insert or update or delete on public.invoice_items
for each row execute function app.recalculate_invoice_totals();

create or replace function app.guard_invoice_mutation()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft invoices can be deleted; void the invoice instead'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.status = 'void' then
    raise exception 'A void invoice is final' using errcode = 'check_violation';
  end if;

  if old.status <> 'draft' then
    if new.number <> old.number
       or new.customer_id <> old.customer_id
       or new.currency <> old.currency
       or new.subtotal_minor <> old.subtotal_minor
       or new.tax_minor <> old.tax_minor
       or new.total_minor <> old.total_minor then
      raise exception 'Issued invoice financial fields are immutable'
        using errcode = 'check_violation';
    end if;
    if new.amount_paid_minor <> old.amount_paid_minor
       and coalesce(current_setting('kontaflow.invoice_payment_sync', true), 'off') <> 'on' then
      raise exception 'Record a payment on the linked debt instead of editing the paid amount'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status <> old.status then
    v_allowed := case old.status
      when 'draft' then new.status in ('sent', 'void')
      when 'sent' then new.status in ('partially_paid', 'paid', 'overdue', 'void')
      when 'partially_paid' then new.status in ('paid', 'overdue', 'void')
      when 'overdue' then new.status in ('partially_paid', 'paid', 'void')
      when 'paid' then false
      else false
    end;
    if not v_allowed then
      raise exception 'Invoice cannot move from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'sent' and new.sent_at is null then
    new.sent_at := now();
  end if;
  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;
  if new.status = 'void' and new.voided_at is null then
    new.voided_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_guard_mutation on public.invoices;
create trigger invoices_guard_mutation
before update or delete on public.invoices
for each row execute function app.guard_invoice_mutation();

create or replace function public.next_invoice_number(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_number integer;
begin
  if not app.can_write_finance(p_workspace_id) then
    raise exception 'Not allowed to issue invoices in this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  update public.business_settings
     set invoice_next_number = invoice_next_number + 1
   where workspace_id = p_workspace_id
  returning invoice_prefix, invoice_next_number - 1 into v_prefix, v_number;

  if v_prefix is null then
    raise exception 'Business settings are missing for this workspace'
      using errcode = 'no_data_found';
  end if;

  return v_prefix || '-' || lpad(v_number::text, 4, '0');
end;
$$;

-- -------------------------------- debts ------------------------------------
create or replace function app.guard_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_debt public.debts;
  v_other bigint;
begin
  if tg_op = 'DELETE' then
    raise exception 'Debt payments are voided, never deleted' using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' then
    if old.voided_at is not null then
      raise exception 'A voided payment is final' using errcode = 'check_violation';
    end if;
    if new.amount_minor <> old.amount_minor
       or new.debt_id <> old.debt_id
       or new.workspace_id <> old.workspace_id
       or new.paid_on <> old.paid_on then
      raise exception 'Void the payment and record a new one to change it'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.voided_at is not null then
    return new;
  end if;

  select * into v_debt from public.debts where id = new.debt_id;
  if not found then
    raise exception 'Debt not found' using errcode = 'check_violation';
  end if;
  if v_debt.status = 'written_off' then
    raise exception 'A written-off debt cannot receive payments' using errcode = 'check_violation';
  end if;

  select coalesce(sum(amount_minor), 0) into v_other
  from public.debt_payments
  where debt_id = new.debt_id
    and voided_at is null
    and id <> new.id;

  if v_other + new.amount_minor > v_debt.principal_minor then
    raise exception 'Payment exceeds the outstanding balance of % minor units',
      v_debt.principal_minor - v_other
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists debt_payments_guard on public.debt_payments;
create trigger debt_payments_guard
before insert or update or delete on public.debt_payments
for each row execute function app.guard_debt_payment();

create or replace function app.apply_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_debt public.debts;
  v_paid bigint;
begin
  select * into v_debt
  from public.debts
  where id = coalesce(new.debt_id, old.debt_id);

  if not found then
    return null;
  end if;

  select coalesce(sum(amount_minor), 0) into v_paid
  from public.debt_payments
  where debt_id = v_debt.id
    and voided_at is null;

  update public.debts d
     set paid_minor = v_paid,
         status = case
           when d.status = 'written_off' then 'written_off'::public.debt_status
           when v_paid >= d.principal_minor then 'settled'::public.debt_status
           when v_paid > 0 then 'partially_paid'::public.debt_status
           else 'open'::public.debt_status
         end,
         closed_at = case
           when d.status = 'written_off' then d.closed_at
           when v_paid >= d.principal_minor then coalesce(d.closed_at, now())
           else null
         end
   where d.id = v_debt.id;

  if v_debt.invoice_id is not null then
    perform set_config('kontaflow.invoice_payment_sync', 'on', true);
    update public.invoices i
       set amount_paid_minor = least(v_paid, i.total_minor),
           status = case
             when i.status in ('sent', 'partially_paid', 'overdue') and v_paid >= i.total_minor then 'paid'::public.invoice_status
             when i.status in ('sent', 'overdue', 'partially_paid') and v_paid > 0 and v_paid < i.total_minor then 'partially_paid'::public.invoice_status
             else i.status
           end
     where i.id = v_debt.invoice_id
       and i.status <> 'void';
    perform set_config('kontaflow.invoice_payment_sync', 'off', true);
  end if;

  return null;
end;
$$;

drop trigger if exists debt_payments_apply on public.debt_payments;
create trigger debt_payments_apply
after insert or update or delete on public.debt_payments
for each row execute function app.apply_debt_payment();

-- ------------------------------ audit trail --------------------------------
create or replace function app.audit_invoice_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit(
      new.workspace_id, 'invoice.created', 'invoice', new.id,
      jsonb_build_object('number', new.number, 'total_minor', new.total_minor, 'status', new.status)
    );
  elsif new.status <> old.status
     or new.total_minor <> old.total_minor
     or new.amount_paid_minor <> old.amount_paid_minor then
    perform app.write_audit(
      new.workspace_id, 'invoice.updated', 'invoice', new.id,
      jsonb_build_object(
        'number', new.number, 'total_minor', new.total_minor,
        'amount_paid_minor', new.amount_paid_minor, 'status', new.status
      ),
      jsonb_build_object(
        'total_minor', old.total_minor, 'amount_paid_minor', old.amount_paid_minor,
        'status', old.status
      )
    );
  end if;
  return null;
end;
$$;

drop trigger if exists invoices_audit on public.invoices;
create trigger invoices_audit
after insert or update on public.invoices
for each row execute function app.audit_invoice_change();

create or replace function app.audit_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform app.write_audit(
    coalesce(new.workspace_id, old.workspace_id),
    case
      when tg_op = 'INSERT' then 'debt_payment.recorded'
      when new.voided_at is not null and old.voided_at is null then 'debt_payment.voided'
      else 'debt_payment.updated'
    end,
    'debt_payment',
    coalesce(new.id, old.id),
    jsonb_build_object('debt_id', coalesce(new.debt_id, old.debt_id), 'amount_minor', coalesce(new.amount_minor, old.amount_minor))
  );
  return null;
end;
$$;

drop trigger if exists debt_payments_audit on public.debt_payments;
create trigger debt_payments_audit
after insert or update on public.debt_payments
for each row execute function app.audit_debt_payment();

-- ------------------------------- reversals ---------------------------------
create or replace function public.reverse_transaction(
  p_transaction_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tx public.transactions;
  v_ws public.workspaces;
  v_reversal_id uuid;
  v_today date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_tx from public.transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction not found' using errcode = 'no_data_found';
  end if;
  if not app.can_write_finance(v_tx.workspace_id) then
    raise exception 'Not allowed to reverse this transaction' using errcode = 'insufficient_privilege';
  end if;
  if v_tx.status <> 'posted' then
    raise exception 'Only a posted transaction can be reversed' using errcode = 'check_violation';
  end if;
  if v_tx.reverses_transaction_id is not null then
    raise exception 'A reversal entry cannot itself be reversed; record a new transaction'
      using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.transactions
    where reverses_transaction_id = v_tx.id
  ) then
    raise exception 'Transaction is already reversed' using errcode = 'check_violation';
  end if;

  select * into v_ws from public.workspaces where id = v_tx.workspace_id;
  v_today := (now() at time zone v_ws.timezone)::date;

  insert into public.transactions (
    workspace_id, kind, occurred_on, description, reference, category_id,
    account_id, counter_account_id, contact_id, amount_minor, currency,
    payment_method, channel, source, sync_status, reverses_transaction_id,
    reversal_reason, created_by, recorded_timezone, metadata
  )
  values (
    v_tx.workspace_id, v_tx.kind, v_today,
    left('Reversal: ' || v_tx.description, 500),
    v_tx.reference, v_tx.category_id, v_tx.account_id, v_tx.counter_account_id,
    v_tx.contact_id, v_tx.amount_minor, v_tx.currency, v_tx.payment_method,
    'web', 'system', 'synced', v_tx.id, nullif(trim(p_reason), ''), auth.uid(),
    v_ws.timezone,
    jsonb_build_object('reversal_reason', p_reason, 'reversed_transaction_id', v_tx.id)
  )
  returning id into v_reversal_id;

  insert into public.ledger_lines (
    workspace_id, transaction_id, account_id, category_id, contact_id,
    line_no, debit_minor, credit_minor, memo
  )
  select
    l.workspace_id, v_reversal_id, l.account_id, l.category_id, l.contact_id,
    l.line_no, l.credit_minor, l.debit_minor,
    left('Reversal: ' || coalesce(l.memo, v_tx.description), 500)
  from public.ledger_lines l
  where l.transaction_id = v_tx.id
  order by l.line_no;

  perform app.write_audit(
    v_tx.workspace_id, 'transaction.reversed', 'transaction', v_tx.id,
    jsonb_build_object('reversal_id', v_reversal_id, 'reason', p_reason),
    to_jsonb(v_tx)
  );

  return jsonb_build_object(
    'id', v_reversal_id,
    'reverses', v_tx.id,
    'status', 'posted'
  );
end;
$$;

revoke all on function public.next_invoice_number(uuid) from public, anon;
revoke all on function public.reverse_transaction(uuid, text) from public, anon;
grant execute on function public.next_invoice_number(uuid) to authenticated, service_role;
grant execute on function public.reverse_transaction(uuid, text) to authenticated, service_role;
