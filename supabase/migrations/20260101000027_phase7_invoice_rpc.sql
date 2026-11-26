-- =============================================================================
-- KontaFlow · 0027 — Phase 7 invoice write path
-- =============================================================================
-- Invoices, their items and the linked receivable debt are created atomically.
-- Browser clients never write financial totals directly.
-- =============================================================================

create or replace function public.create_invoice(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_workspace_id uuid;
  v_customer_id uuid;
  v_issue_on date;
  v_due_on date;
  v_number text;
  v_invoice_id uuid;
  v_total bigint;
  v_issue boolean;
  v_currency char(3);
  v_ws public.workspaces;
  v_item jsonb;
  v_position integer := 0;
  v_description text;
  v_quantity numeric;
  v_unit_price bigint;
  v_tax_bp integer;
  v_debt_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  v_workspace_id := nullif(p_payload ->> 'workspace_id', '')::uuid;
  if v_workspace_id is null or not app.can_write_finance(v_workspace_id) then
    raise exception 'Not allowed to create invoices in this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.has_workspace_feature(v_workspace_id, 'invoicing') then
    raise exception 'Invoicing is not enabled on this plan'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_ws from public.workspaces where id = v_workspace_id;

  v_customer_id := nullif(p_payload ->> 'customer_id', '')::uuid;
  if v_customer_id is null or not exists (
    select 1 from public.contacts
    where id = v_customer_id and workspace_id = v_workspace_id
      and kind in ('customer', 'both') and not is_archived
  ) then
    raise exception 'Select a customer in this workspace' using errcode = 'check_violation';
  end if;

  v_issue_on := coalesce(nullif(p_payload ->> 'issue_on', '')::date, (now() at time zone v_ws.timezone)::date);
  v_due_on := nullif(p_payload ->> 'due_on', '')::date;
  if v_due_on is null or v_due_on < v_issue_on then
    raise exception 'The due date must be on or after the issue date'
      using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_payload -> 'items') <> 'array'
     or jsonb_array_length(p_payload -> 'items') < 1
     or jsonb_array_length(p_payload -> 'items') > 100 then
    raise exception 'An invoice needs between 1 and 100 line items'
      using errcode = 'check_violation';
  end if;

  v_issue := coalesce((p_payload ->> 'issue')::boolean, false);
  v_currency := coalesce(nullif(p_payload ->> 'currency', '')::char(3), v_ws.currency);
  if v_currency <> v_ws.currency then
    raise exception 'Currency must match the workspace currency' using errcode = 'check_violation';
  end if;

  v_number := public.next_invoice_number(v_workspace_id);

  insert into public.invoices (
    workspace_id, customer_id, number, status, issue_on, due_on, currency,
    notes, terms, created_by
  )
  values (
    v_workspace_id, v_customer_id, v_number, 'draft', v_issue_on, v_due_on,
    v_currency, nullif(trim(p_payload ->> 'notes'), ''),
    nullif(trim(p_payload ->> 'terms'), ''), v_uid
  )
  returning id into v_invoice_id;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items')
  loop
    v_position := v_position + 1;
    v_description := trim(coalesce(v_item ->> 'description', ''));
    if char_length(v_description) < 1 or char_length(v_description) > 300 then
      raise exception 'Each invoice line needs a description of 1 to 300 characters'
        using errcode = 'check_violation';
    end if;

    if (v_item ->> 'quantity') is null
       or (v_item ->> 'quantity') !~ '^[0-9]+(\.[0-9]{1,3})?$' then
      raise exception 'Quantity must be a positive number with up to 3 decimals'
        using errcode = 'check_violation';
    end if;
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity <= 0 then
      raise exception 'Quantity must be greater than zero' using errcode = 'check_violation';
    end if;

    if (v_item ->> 'unit_price_minor') is null
       or (v_item ->> 'unit_price_minor') !~ '^[0-9]+$' then
      raise exception 'Unit price must be a non-negative integer in minor units'
        using errcode = 'check_violation';
    end if;
    v_unit_price := (v_item ->> 'unit_price_minor')::bigint;

    v_tax_bp := coalesce(nullif(v_item ->> 'tax_rate_bp', '')::integer, 0);
    if v_tax_bp < 0 or v_tax_bp > 10000 then
      raise exception 'Tax rate must be between 0 and 10000 basis points'
        using errcode = 'check_violation';
    end if;

    insert into public.invoice_items (
      workspace_id, invoice_id, position, description, quantity, unit_price_minor, tax_rate_bp
    )
    values (
      v_workspace_id, v_invoice_id, v_position, v_description, v_quantity, v_unit_price, v_tax_bp
    );
  end loop;

  select total_minor into v_total from public.invoices where id = v_invoice_id;

  if v_issue and v_total > 0 then
    update public.invoices set status = 'sent' where id = v_invoice_id;
    insert into public.debts (
      workspace_id, direction, contact_id, description, principal_minor,
      currency, opened_on, due_on, invoice_id, created_by
    )
    values (
      v_workspace_id, 'receivable', v_customer_id, 'Invoice ' || v_number,
      v_total, v_currency, v_issue_on, v_due_on, v_invoice_id, v_uid
    )
    returning id into v_debt_id;

    perform app.write_audit(
      v_workspace_id, 'debt.created', 'debt', v_debt_id,
      jsonb_build_object('direction', 'receivable', 'principal_minor', v_total, 'invoice_id', v_invoice_id)
    );
  end if;

  return jsonb_build_object(
    'id', v_invoice_id,
    'number', v_number,
    'total_minor', v_total::text,
    'status', case when v_issue and v_total > 0 then 'sent' else 'draft' end
  );
end;
$$;

revoke all on function public.create_invoice(jsonb) from public, anon;
grant execute on function public.create_invoice(jsonb) to authenticated;

create or replace function public.issue_invoice(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_invoice public.invoices;
  v_debt_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'no_data_found';
  end if;
  if not app.can_write_finance(v_invoice.workspace_id) then
    raise exception 'Not allowed to issue invoices in this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.has_workspace_feature(v_invoice.workspace_id, 'invoicing') then
    raise exception 'Invoicing is not enabled on this plan'
      using errcode = 'insufficient_privilege';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Only a draft invoice can be issued' using errcode = 'check_violation';
  end if;
  if v_invoice.total_minor <= 0 then
    raise exception 'Add at least one priced line before issuing' using errcode = 'check_violation';
  end if;

  update public.invoices set status = 'sent' where id = p_invoice_id;

  select id into v_debt_id
  from public.debts
  where invoice_id = p_invoice_id
  order by created_at
  limit 1;

  if v_debt_id is null then
    insert into public.debts (
      workspace_id, direction, contact_id, description, principal_minor,
      currency, opened_on, due_on, invoice_id, created_by
    )
    values (
      v_invoice.workspace_id, 'receivable', v_invoice.customer_id,
      'Invoice ' || v_invoice.number, v_invoice.total_minor, v_invoice.currency,
      v_invoice.issue_on, v_invoice.due_on, v_invoice.id, v_uid
    )
    returning id into v_debt_id;

    perform app.write_audit(
      v_invoice.workspace_id, 'debt.created', 'debt', v_debt_id,
      jsonb_build_object('direction', 'receivable', 'principal_minor', v_invoice.total_minor, 'invoice_id', v_invoice.id)
    );
  end if;

  return jsonb_build_object('id', p_invoice_id, 'status', 'sent', 'debt_id', v_debt_id);
end;
$$;

revoke all on function public.issue_invoice(uuid) from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated;
