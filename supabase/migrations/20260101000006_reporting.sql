-- =============================================================================
-- KontaFlow · 0006 — reporting functions and RLS-safe views
-- =============================================================================
-- Aggregates are returned as ::text so no JavaScript float ever touches a
-- financial total. The client parses them with BigInt (see lib/money.ts).
-- =============================================================================

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
  v_result jsonb;
begin
  if not app.is_workspace_member(p_workspace_id) then
    raise exception 'Not a member of this workspace' using errcode = 'insufficient_privilege';
  end if;

  select * into v_ws from public.workspaces where id = p_workspace_id;
  v_period_days := greatest((p_to - p_from) + 1, 1);

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

create or replace function public.get_report(
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
  v_income bigint;
  v_expense bigint;
  v_count integer;
  v_result jsonb;
begin
  if not app.is_workspace_member(p_workspace_id) then
    raise exception 'Not a member of this workspace' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(sum(case when kind = 'income' then amount_minor else 0 end), 0),
         coalesce(sum(case when kind = 'expense' then amount_minor else 0 end), 0),
         count(*)
    into v_income, v_expense, v_count
  from public.transactions
  where workspace_id = p_workspace_id and status = 'posted'
    and occurred_on between p_from and p_to;

  v_result := jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'revenueMinor', v_income::text,
    'expenseMinor', v_expense::text,
    'netProfitMinor', (v_income - v_expense)::text,
    'transactionCount', v_count,
    'byCategory', coalesce((
      select jsonb_agg(row_to_json(x) order by x.total desc)
      from (
        select c.name as name, c.translations as translations, c.color as color,
               c.kind as kind, sum(t.amount_minor)::text as total
        from public.transactions t
        join public.categories c on c.id = t.category_id
        where t.workspace_id = p_workspace_id and t.status = 'posted'
          and t.occurred_on between p_from and p_to
        group by c.id, c.name, c.translations, c.color, c.kind
        order by sum(t.amount_minor) desc
      ) x
    ), '[]'::jsonb),
    'dailySeries', coalesce((
      select jsonb_agg(row_to_json(d) order by d.date)
      from (
        select to_char(day, 'YYYY-MM-DD') as date,
               coalesce(sum(case when kind = 'income' then amount_minor end), 0)::text as income,
               coalesce(sum(case when kind = 'expense' then amount_minor end), 0)::text as expense
        from generate_series(p_from, p_to, interval '1 day') as day
        left join public.transactions t
          on t.workspace_id = p_workspace_id and t.status = 'posted'
         and t.occurred_on = day::date
        group by day
      ) d
    ), '[]'::jsonb),
    'topCustomers', coalesce((
      select jsonb_agg(row_to_json(k) order by k.total desc)
      from (
        select ct.name as name, sum(t.amount_minor)::text as total
        from public.transactions t
        join public.contacts ct on ct.id = t.contact_id
        where t.workspace_id = p_workspace_id and t.status = 'posted'
          and t.kind = 'income' and t.occurred_on between p_from and p_to
        group by ct.id, ct.name
        order by sum(t.amount_minor) desc
        limit 5
      ) k
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Views. security_invoker keeps the caller's RLS policies in force; these are
-- conveniences for reading, never a bypass.
-- ---------------------------------------------------------------------------
create or replace view public.v_transactions
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
  t.created_at
from public.transactions t
left join public.categories c on c.id = t.category_id
left join public.contacts ct on ct.id = t.contact_id
join public.accounts a on a.id = t.account_id;

create or replace view public.v_account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.workspace_id,
  a.name,
  a.type,
  a.subtype,
  a.currency,
  a.opening_balance_minor,
  coalesce(sum(case when t.status = 'posted' then l.debit_minor - l.credit_minor else 0 end), 0)
    as movement_minor,
  a.opening_balance_minor
    + coalesce(sum(case when t.status = 'posted' then l.debit_minor - l.credit_minor else 0 end), 0)
    as balance_minor
from public.accounts a
left join public.ledger_lines l on l.account_id = a.id
left join public.transactions t on t.id = l.transaction_id
group by a.id;

create or replace view public.v_monthly_cashflow
with (security_invoker = true)
as
select
  workspace_id,
  date_trunc('month', occurred_on)::date as month,
  coalesce(sum(case when kind = 'income' then amount_minor end), 0) as income_minor,
  coalesce(sum(case when kind = 'expense' then amount_minor end), 0) as expense_minor
from public.transactions
where status = 'posted'
group by workspace_id, date_trunc('month', occurred_on);
