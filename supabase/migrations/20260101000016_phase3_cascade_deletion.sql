-- =============================================================================
-- KontaFlow · 0016 — cascade-safe workspace deletion
-- =============================================================================
-- Deleting a tenant must remain possible: invoices and payments are protected
-- from direct deletion, but a workspace owner deleting the workspace has to be
-- able to remove everything in it. A transaction-local marker set on the
-- workspace delete lets the guards distinguish the two situations. Foreign
-- keys between tenant tables are deferred so cascade order cannot fail.
-- =============================================================================

alter table public.invoices drop constraint if exists invoices_customer_fk;
alter table public.invoices
  add constraint invoices_customer_fk foreign key (workspace_id, customer_id)
    references public.contacts (workspace_id, id)
    on delete no action deferrable initially deferred;

alter table public.debts drop constraint if exists debts_contact_fk;
alter table public.debts
  add constraint debts_contact_fk foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id)
    on delete no action deferrable initially deferred;

alter table public.debts drop constraint if exists debts_invoice_fk;
alter table public.debts
  add constraint debts_invoice_fk foreign key (workspace_id, invoice_id)
    references public.invoices (workspace_id, id)
    on delete no action deferrable initially deferred;

alter table public.debt_payments drop constraint if exists debt_payments_debt_fk;
alter table public.debt_payments
  add constraint debt_payments_debt_fk foreign key (workspace_id, debt_id)
    references public.debts (workspace_id, id)
    on delete no action deferrable initially deferred;

alter table public.debt_payments drop constraint if exists debt_payments_account_id_fkey;
alter table public.debt_payments
  add constraint debt_payments_account_id_fkey foreign key (account_id)
    references public.accounts (id) on delete set null;

alter table public.budgets drop constraint if exists budgets_category_fk;
alter table public.budgets
  add constraint budgets_category_fk foreign key (workspace_id, category_id)
    references public.categories (workspace_id, id)
    on delete no action deferrable initially deferred;

alter table public.inventory_items drop constraint if exists inventory_items_category_fk;
alter table public.inventory_items
  add constraint inventory_items_category_fk foreign key (workspace_id, category_id)
    references public.categories (workspace_id, id)
    on delete no action deferrable initially deferred;

create or replace function app.mark_workspace_deletion()
returns trigger
language plpgsql
as $$
begin
  perform set_config('kontaflow.workspace_delete', old.id::text, true);
  return old;
end;
$$;

drop trigger if exists workspaces_mark_deletion on public.workspaces;
create trigger workspaces_mark_deletion
before delete on public.workspaces
for each row execute function app.mark_workspace_deletion();

create or replace function app.is_workspace_cascade(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    current_setting('kontaflow.workspace_delete', true) = p_workspace_id::text,
    false
  );
$$;

create or replace function app.protect_system_records()
returns trigger
language plpgsql
as $$
begin
  if app.is_workspace_cascade(old.workspace_id) then
    return old;
  end if;
  if old.is_system then
    raise exception 'System records cannot be deleted; archive them instead'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

-- The owner-protection trigger must also yield during a tenant cascade;
-- otherwise a workspace can never be deleted.
create or replace function public.protect_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remaining integer;
begin
  if app.is_workspace_cascade(old.workspace_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if (tg_op in ('UPDATE', 'DELETE')) then
    select count(*) into v_remaining
    from public.workspace_members m
    where m.workspace_id = old.workspace_id
      and m.user_id <> old.user_id
      and m.role = 'owner'
      and m.status = 'active';

    if old.role = 'owner' and old.status = 'active'
       and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active')
       and v_remaining = 0 then
      raise exception 'A workspace must keep at least one active owner'
        using errcode = 'check_violation';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function app.assert_invoice_item_draft()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.invoice_status;
  v_workspace_id uuid;
begin
  if app.is_workspace_cascade(coalesce(new.workspace_id, old.workspace_id)) then
    return coalesce(new, old);
  end if;

  select status, workspace_id into v_status, v_workspace_id
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

create or replace function app.guard_invoice_mutation()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean;
begin
  if tg_op = 'DELETE' then
    if app.is_workspace_cascade(old.workspace_id) then
      return old;
    end if;
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
    if app.is_workspace_cascade(old.workspace_id) then
      return old;
    end if;
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
