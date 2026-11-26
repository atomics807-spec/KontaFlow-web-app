-- =============================================================================
-- KontaFlow · 0026 — Phase 7 finance views and dashboard aggregates
-- =============================================================================
-- All money stays in bigint minor units. Views are security_invoker so the
-- caller's RLS policies remain in force; the dashboard RPC is SECURITY DEFINER
-- but checks workspace membership before returning anything.
-- =============================================================================

-- Receipts need to be visible on the ledger row. Recreate the view to add the
-- attachment column at the end.
drop view if exists public.v_transactions;
create view public.v_transactions
with (security_invoker = true)
as
select
  t.id,
  t.workspace_id,
  t.kind,
  t.status,
  t.occurred_on,
  t.description,
  t.reference,
  t.amount_minor,
  t.currency,
  t.payment_method,
  t.channel,
  t.category_id,
  c.name as category_name,
  c.translations as category_translations,
  t.contact_id,
  ct.name as contact_name,
  t.account_id,
  a.name as account_name,
  t.created_by,
  t.created_at,
  t.attachment_path
from public.transactions t
left join public.categories c on c.id = t.category_id
left join public.contacts ct on ct.id = t.contact_id
join public.accounts a on a.id = t.account_id;

grant select on public.v_transactions to authenticated;

-- Money-account balances including account metadata for the accounts page.
drop view if exists public.v_account_balances;
create view public.v_account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.workspace_id,
  a.name,
  a.type,
  a.subtype,
  a.institution,
  a.masked_number,
  a.currency,
  a.opening_balance_minor,
  a.is_system,
  a.is_archived,
  a.created_at,
  a.updated_at,
  coalesce(sum(case when t.status = 'posted' then l.debit_minor - l.credit_minor else 0 end), 0)
    as movement_minor,
  a.opening_balance_minor
    + coalesce(sum(case when t.status = 'posted' then l.debit_minor - l.credit_minor else 0 end), 0)
    as balance_minor
from public.accounts a
left join public.ledger_lines l on l.account_id = a.id
left join public.transactions t on t.id = l.transaction_id
group by a.id;

grant select on public.v_account_balances to authenticated;

create or replace view public.v_debts
with (security_invoker = true)
as
select
  d.id,
  d.workspace_id,
  d.direction,
  d.contact_id,
  c.name as contact_name,
  c.kind as contact_kind,
  d.description,
  d.principal_minor,
  d.paid_minor,
  greatest(d.principal_minor - d.paid_minor, 0) as remaining_minor,
  d.currency,
  d.opened_on,
  d.due_on,
  d.status,
  d.invoice_id,
  i.number as invoice_number,
  d.transaction_id,
  d.notes,
  d.closed_at,
  d.created_at,
  d.updated_at,
  (
    d.status in ('open', 'partially_paid')
    and d.due_on is not null
    and d.due_on < current_date
  ) as is_overdue
from public.debts d
join public.contacts c on c.id = d.contact_id
left join public.invoices i on i.id = d.invoice_id;

grant select on public.v_debts to authenticated;

create or replace view public.v_invoices
with (security_invoker = true)
as
select
  i.id,
  i.workspace_id,
  i.customer_id,
  c.name as customer_name,
  i.number,
  i.status,
  i.issue_on,
  i.due_on,
  i.currency,
  i.subtotal_minor,
  i.tax_minor,
  i.total_minor,
  i.amount_paid_minor,
  greatest(i.total_minor - i.amount_paid_minor, 0) as remaining_minor,
  i.notes,
  i.terms,
  i.sent_at,
  i.paid_at,
  i.voided_at,
  i.created_at,
  i.updated_at,
  (
    i.status in ('sent', 'partially_paid', 'overdue')
    and i.due_on < current_date
  ) as is_overdue,
  (
    select d.id from public.debts d
    where d.invoice_id = i.id
    order by d.created_at
    limit 1
  ) as linked_debt_id
from public.invoices i
join public.contacts c on c.id = i.customer_id;

grant select on public.v_invoices to authenticated;

-- Budget progress is derived exclusively from posted expense records in the
-- budget's own period. A category-less budget covers all expenses.
create or replace view public.v_budget_progress
with (security_invoker = true)
as
select
  b.id,
  b.workspace_id,
  b.name,
  b.category_id,
  c.name as category_name,
  c.translations as category_translations,
  c.color as category_color,
  b.period_start,
  b.period_end,
  b.amount_minor,
  b.currency,
  b.alert_threshold_bp,
  coalesce((
    select sum(t.amount_minor)
    from public.transactions t
    where t.workspace_id = b.workspace_id
      and t.kind = 'expense'
      and t.status = 'posted'
      and t.occurred_on between b.period_start and b.period_end
      and (b.category_id is null or t.category_id = b.category_id)
  ), 0) as spent_minor
from public.budgets b
left join public.categories c on c.id = b.category_id
where b.archived_at is null;

grant select on public.v_budget_progress to authenticated;

-- Plan feature lookup used by server-side route guards. It never trusts a plan
-- supplied by the browser.
create or replace function public.has_workspace_feature(
  p_workspace_id uuid,
  p_feature_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_workspace_member(p_workspace_id)
    and exists (
      select 1
      from public.subscriptions s
      join public.plan_features pf on pf.plan_id = s.plan_id
      join public.subscription_features f on f.id = pf.feature_id
      where s.workspace_id = p_workspace_id
        and f.code = p_feature_code
        and pf.included
    );
$$;

revoke all on function public.has_workspace_feature(uuid, text) from public, anon;
grant execute on function public.has_workspace_feature(uuid, text) to authenticated;

-- Extend the dashboard aggregates with debts, overdue balances and budgets.
create or replace function public.get_dashboard_summary(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ws public.workspaces;
  v_income bigint;
  v_expense bigint;
  v_prev_income bigint;
  v_prev_expense bigint;
  v_cash bigint;
  v_opening bigint;
  v_ai_used integer;
  v_period_days integer;
  v_receivables bigint;
  v_payables bigint;
  v_overdue_receivables bigint;
  v_overdue_payables bigint;
  v_open_debts integer;
  v_today date;
  v_result jsonb;
begin
  if not app.is_workspace_member(p_workspace_id) then
    raise exception 'Not a member of this workspace' using errcode = 'insufficient_privilege';
  end if;

  select * into v_ws from public.workspaces where id = p_workspace_id;
  v_period_days := greatest((p_to - p_from) + 1, 1);
  v_today := (now() at time zone v_ws.timezone)::date;

  select coalesce(sum(amount_minor), 0) into v_income
  from public.transactions
  where workspace_id = p_workspace_id and kind = 'income' and status = 'posted'
    and occurred_on between p_from and p_to;

  select coalesce(sum(amount_minor), 0) into v_expense
  from public.transactions
  where workspace_id = p_workspace_id and kind = 'expense' and status = 'posted'
    and occurred_on between p_from and p_to;

  select coalesce(sum(amount_minor), 0) into v_prev_income
  from public.transactions
  where workspace_id = p_workspace_id and kind = 'income' and status = 'posted'
    and occurred_on between (p_from - v_period_days) and (p_from - 1);

  select coalesce(sum(amount_minor), 0) into v_prev_expense
  from public.transactions
  where workspace_id = p_workspace_id and kind = 'expense' and status = 'posted'
    and occurred_on between (p_from - v_period_days) and (p_from - 1);

  select coalesce(sum(l.debit_minor - l.credit_minor), 0) into v_cash
  from public.ledger_lines l
  join public.transactions t on t.id = l.transaction_id and t.status = 'posted'
  join public.accounts a on a.id = l.account_id
  where l.workspace_id = p_workspace_id
    and a.subtype in ('cash', 'bank', 'mobile_money');

  select coalesce(sum(opening_balance_minor), 0) into v_opening
  from public.accounts
  where workspace_id = p_workspace_id
    and subtype in ('cash', 'bank', 'mobile_money');

  select coalesce(sum(quantity), 0) into v_ai_used
  from public.usage_events
  where workspace_id = p_workspace_id and kind = 'ai_message'
    and created_at >= date_trunc('month', now());

  select
    coalesce(sum(case when direction = 'receivable' then principal_minor - paid_minor else 0 end), 0),
    coalesce(sum(case when direction = 'payable' then principal_minor - paid_minor else 0 end), 0),
    coalesce(sum(case when direction = 'receivable' and due_on is not null and due_on < v_today
                      then principal_minor - paid_minor else 0 end), 0),
    coalesce(sum(case when direction = 'payable' and due_on is not null and due_on < v_today
                      then principal_minor - paid_minor else 0 end), 0),
    count(*)::integer
  into v_receivables, v_payables, v_overdue_receivables, v_overdue_payables, v_open_debts
  from public.debts
  where workspace_id = p_workspace_id
    and status in ('open', 'partially_paid');

  v_result := jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', v_ws.id,
      'name', v_ws.name,
      'currency', v_ws.currency,
      'timezone', v_ws.timezone,
      'plan', v_ws.plan
    ),
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'totalIncomeMinor', v_income::text,
    'totalExpenseMinor', v_expense::text,
    'netProfitMinor', (v_income - v_expense)::text,
    'previousIncomeMinor', v_prev_income::text,
    'previousExpenseMinor', v_prev_expense::text,
    'cashBalanceMinor', (v_cash + v_opening)::text,
    'outstandingReceivablesMinor', v_receivables::text,
    'outstandingPayablesMinor', v_payables::text,
    'overdueReceivablesMinor', v_overdue_receivables::text,
    'overduePayablesMinor', v_overdue_payables::text,
    'openDebtCount', v_open_debts,
    'aiMessagesUsed', v_ai_used,
    'monthlySeries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', to_char(m.month, 'YYYY-MM'),
          'income', coalesce(i.total, 0)::text,
          'expense', coalesce(e.total, 0)::text
        ) order by m.month
      )
      from generate_series(
        date_trunc('month', p_to) - interval '5 months',
        date_trunc('month', p_to),
        interval '1 month'
      ) as m(month)
      left join (
        select date_trunc('month', occurred_on) as month, sum(amount_minor) as total
        from public.transactions
        where workspace_id = p_workspace_id and kind = 'income' and status = 'posted'
        group by 1
      ) i on i.month = m.month
      left join (
        select date_trunc('month', occurred_on) as month, sum(amount_minor) as total
        from public.transactions
        where workspace_id = p_workspace_id and kind = 'expense' and status = 'posted'
        group by 1
      ) e on e.month = m.month
    ), '[]'::jsonb),
    'topExpenseCategories', coalesce((
      select jsonb_agg(row_to_json(x) order by x.total desc)
      from (
        select c.name as name, c.translations as translations, c.color as color,
               sum(t.amount_minor)::text as total
        from public.transactions t
        join public.categories c on c.id = t.category_id
        where t.workspace_id = p_workspace_id and t.kind = 'expense' and t.status = 'posted'
          and t.occurred_on between p_from and p_to
        group by c.id, c.name, c.translations, c.color
        order by sum(t.amount_minor) desc
        limit 5
      ) x
    ), '[]'::jsonb),
    'budgetProgress', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'category_id', b.category_id,
          'category_name', b.category_name,
          'category_translations', b.category_translations,
          'category_color', b.category_color,
          'period_start', to_char(b.period_start, 'YYYY-MM-DD'),
          'period_end', to_char(b.period_end, 'YYYY-MM-DD'),
          'amount_minor', b.amount_minor::text,
          'spent_minor', b.spent_minor::text,
          'currency', b.currency
        )
        order by b.period_end, b.name
      )
      from public.v_budget_progress b
      where b.workspace_id = p_workspace_id
        and b.period_start <= p_to
        and b.period_end >= p_from
    ), '[]'::jsonb),
    'recentTransactions', coalesce((
      select jsonb_agg(row_to_json(r) order by r.occurred_on desc, r.created_at desc)
      from (
        select t.id as id,
               t.kind as kind,
               t.amount_minor::text as amount_minor,
               t.currency as currency,
               to_char(t.occurred_on, 'YYYY-MM-DD') as occurred_on,
               t.description as description,
               t.channel as channel,
               t.status as status,
               t.created_at as created_at,
               c.name as category_name,
               c.translations as category_translations,
               ct.name as contact_name,
               a.name as account_name
        from public.transactions t
        left join public.categories c on c.id = t.category_id
        left join public.contacts ct on ct.id = t.contact_id
        join public.accounts a on a.id = t.account_id
        where t.workspace_id = p_workspace_id and t.status = 'posted'
        order by t.occurred_on desc, t.created_at desc
        limit 8
      ) r
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

grant execute on function public.get_dashboard_summary(uuid, date, date) to authenticated;
