-- =============================================================================
-- KontaFlow · 0032 — tenant-scoped business intelligence
-- Deterministic analytics over one workspace's posted ledger, debts, budgets
-- and goals. The RPC refuses callers who are not workspace members and never
-- joins across workspaces.
-- =============================================================================

create or replace function public.get_business_intelligence(
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
  v_days integer;
  v_prev_from date;
  v_prev_to date;
  v_today date;
  v_income bigint;
  v_expense bigint;
  v_prev_income bigint;
  v_prev_expense bigint;
  v_cogs bigint;
  v_prev_cogs bigint;
  v_cash_movement bigint;
  v_cash_opening bigint;
  v_transaction_count integer;
  v_active_days integer;
  v_first_on date;
  v_last_on date;
  v_attributed_income bigint;
  v_top_customer bigint;
  v_top_five bigint;
begin
  if auth.uid() is null or not app.is_workspace_member(p_workspace_id) then
    raise exception 'Not a member of this workspace' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce((
    select insights_enabled from public.ai_workspace_preferences where workspace_id = p_workspace_id
  ), true) then
    raise exception 'Business intelligence is disabled for this workspace' using errcode = 'insufficient_privilege';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'A valid date range is required' using errcode = 'check_violation';
  end if;
  if p_to - p_from > 730 then
    raise exception 'The analysis window cannot exceed 730 days' using errcode = 'check_violation';
  end if;

  select * into v_ws from public.workspaces where id = p_workspace_id;
  if not found then
    raise exception 'Workspace not found' using errcode = 'no_data_found';
  end if;

  v_days := (p_to - p_from) + 1;
  v_prev_to := p_from - 1;
  v_prev_from := p_from - v_days;
  v_today := (now() at time zone v_ws.timezone)::date;

  select coalesce(sum(case when kind = 'income' then amount_minor else 0 end), 0),
         coalesce(sum(case when kind = 'expense' then amount_minor else 0 end), 0),
         count(*)::integer,
         count(distinct occurred_on)::integer,
         min(occurred_on),
         max(occurred_on)
    into v_income, v_expense, v_transaction_count, v_active_days, v_first_on, v_last_on
  from public.transactions
  where workspace_id = p_workspace_id and status = 'posted'
    and occurred_on between p_from and p_to;

  select coalesce(sum(case when kind = 'income' then amount_minor else 0 end), 0),
         coalesce(sum(case when kind = 'expense' then amount_minor else 0 end), 0)
    into v_prev_income, v_prev_expense
  from public.transactions
  where workspace_id = p_workspace_id and status = 'posted'
    and occurred_on between v_prev_from and v_prev_to;

  select coalesce(sum(l.debit_minor - l.credit_minor), 0) into v_cash_movement
  from public.ledger_lines l
  join public.transactions t on t.id = l.transaction_id and t.status = 'posted'
  join public.accounts a on a.id = l.account_id
  where l.workspace_id = p_workspace_id
    and a.subtype in ('cash', 'bank', 'mobile_money');

  select coalesce(sum(opening_balance_minor), 0) into v_cash_opening
  from public.accounts
  where workspace_id = p_workspace_id
    and subtype in ('cash', 'bank', 'mobile_money');

  select coalesce(sum(t.amount_minor), 0) into v_cogs
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.workspace_id = p_workspace_id and t.kind = 'expense' and t.status = 'posted'
    and t.occurred_on between p_from and p_to
    and (
      lower(c.name) ~ '(stock|inventory|cost of goods|purchases)'
      or lower(coalesce(c.translations ->> 'fr', '')) like '%achat%'
      or lower(coalesce(c.translations ->> 'pcm', '')) like '%stock%'
    );

  select coalesce(sum(t.amount_minor), 0) into v_prev_cogs
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.workspace_id = p_workspace_id and t.kind = 'expense' and t.status = 'posted'
    and t.occurred_on between v_prev_from and v_prev_to
    and (
      lower(c.name) ~ '(stock|inventory|cost of goods|purchases)'
      or lower(coalesce(c.translations ->> 'fr', '')) like '%achat%'
      or lower(coalesce(c.translations ->> 'pcm', '')) like '%stock%'
    );

  select coalesce(sum(t.amount_minor), 0) into v_attributed_income
  from public.transactions t
  where t.workspace_id = p_workspace_id and t.kind = 'income' and t.status = 'posted'
    and t.contact_id is not null and t.occurred_on between p_from and p_to;

  select coalesce(max(total), 0) into v_top_customer
  from (
    select sum(t.amount_minor) as total
    from public.transactions t
    where t.workspace_id = p_workspace_id and t.kind = 'income' and t.status = 'posted'
      and t.contact_id is not null and t.occurred_on between p_from and p_to
    group by t.contact_id
    order by sum(t.amount_minor) desc
    limit 1
  ) top_one;

  select coalesce(sum(total), 0) into v_top_five
  from (
    select sum(t.amount_minor) as total
    from public.transactions t
    where t.workspace_id = p_workspace_id and t.kind = 'income' and t.status = 'posted'
      and t.contact_id is not null and t.occurred_on between p_from and p_to
    group by t.contact_id
    order by sum(t.amount_minor) desc
    limit 5
  ) top_five;

  return jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', v_ws.id,
      'name', v_ws.name,
      'currency', v_ws.currency,
      'timezone', v_ws.timezone,
      'industry', v_ws.industry,
      'businessSize', v_ws.business_size
    ),
    'period', jsonb_build_object(
      'from', to_char(p_from, 'YYYY-MM-DD'),
      'to', to_char(p_to, 'YYYY-MM-DD'),
      'days', v_days
    ),
    'previousPeriod', jsonb_build_object(
      'from', to_char(v_prev_from, 'YYYY-MM-DD'),
      'to', to_char(v_prev_to, 'YYYY-MM-DD')
    ),
    'coverage', jsonb_build_object(
      'transactionCount', v_transaction_count,
      'activeDays', v_active_days,
      'firstRecordedOn', case when v_first_on is null then null else to_char(v_first_on, 'YYYY-MM-DD') end,
      'lastRecordedOn', case when v_last_on is null then null else to_char(v_last_on, 'YYYY-MM-DD') end
    ),
    'totals', jsonb_build_object(
      'incomeMinor', v_income::text,
      'expenseMinor', v_expense::text,
      'netResultMinor', (v_income - v_expense)::text,
      'previousIncomeMinor', v_prev_income::text,
      'previousExpenseMinor', v_prev_expense::text,
      'previousNetResultMinor', (v_prev_income - v_prev_expense)::text,
      'averageDailyExpenseMinor', (v_expense / greatest(v_days, 1))::text,
      'averageWeeklyExpenseMinor', ((v_expense * 7) / greatest(v_days, 1))::text
    ),
    'profitability', jsonb_build_object(
      'costOfGoodsRecorded', v_cogs > 0,
      'costOfGoodsMinor', v_cogs::text,
      'previousCostOfGoodsMinor', v_prev_cogs::text,
      'grossResultAvailable', (v_cogs > 0 and v_income > 0),
      'grossResultMinor', case when v_cogs > 0 and v_income > 0 then (v_income - v_cogs)::text else null end,
      'grossMarginBp', case when v_cogs > 0 and v_income > 0
        then round(((v_income - v_cogs) * 10000.0) / v_income)::integer else null end,
      'note', 'Net result is recorded income minus recorded expenses. Gross result is shown only when stock, inventory or cost-of-goods purchases are recorded.'
    ),
    'cashFlow', jsonb_build_object(
      'cashBalanceMinor', (v_cash_movement + v_cash_opening)::text,
      'netMovementMinor', (v_income - v_expense)::text,
      'openingBalanceMinor', v_cash_opening::text
    ),
    'dailySeries', coalesce((
      select jsonb_agg(row_to_json(d) order by d.date)
      from (
        select to_char(day, 'YYYY-MM-DD') as date,
               coalesce(sum(case when t.kind = 'income' then t.amount_minor end), 0)::text as income,
               coalesce(sum(case when t.kind = 'expense' then t.amount_minor end), 0)::text as expense,
               (coalesce(sum(case when t.kind = 'income' then t.amount_minor end), 0)
                - coalesce(sum(case when t.kind = 'expense' then t.amount_minor end), 0))::text as net
        from generate_series(p_from, p_to, interval '1 day') as day
        left join public.transactions t
          on t.workspace_id = p_workspace_id and t.status = 'posted' and t.occurred_on = day::date
        group by day
      ) d
    ), '[]'::jsonb),
    'weeklySeries', coalesce((
      select jsonb_agg(row_to_json(w) order by w.week_start)
      from (
        select to_char(ws.week_start::date, 'YYYY-MM-DD') as week_start,
               to_char(least(ws.week_start::date + 6, p_to), 'YYYY-MM-DD') as week_end,
               coalesce(sum(case when t.kind = 'income' then t.amount_minor end), 0)::text as income,
               coalesce(sum(case when t.kind = 'expense' then t.amount_minor end), 0)::text as expense,
               (coalesce(sum(case when t.kind = 'income' then t.amount_minor end), 0)
                - coalesce(sum(case when t.kind = 'expense' then t.amount_minor end), 0))::text as net
        from generate_series(date_trunc('week', p_from)::date, p_to, interval '1 week') as ws(week_start)
        left join public.transactions t
          on t.workspace_id = p_workspace_id and t.status = 'posted'
         and t.occurred_on between greatest(p_from, ws.week_start::date)
                               and least(p_to, ws.week_start::date + 6)
        group by ws.week_start
      ) w
    ), '[]'::jsonb),
    'monthlySeries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', to_char(ms.month, 'YYYY-MM'),
          'income', coalesce(i.total, 0)::text,
          'expense', coalesce(e.total, 0)::text,
          'net', (coalesce(i.total, 0) - coalesce(e.total, 0))::text
        ) order by ms.month
      )
      from generate_series(
        date_trunc('month', p_to) - interval '5 months',
        date_trunc('month', p_to),
        interval '1 month'
      ) as ms(month)
      left join (
        select date_trunc('month', occurred_on) as month, sum(amount_minor) as total
        from public.transactions
        where workspace_id = p_workspace_id and kind = 'income' and status = 'posted'
        group by 1
      ) i on i.month = ms.month
      left join (
        select date_trunc('month', occurred_on) as month, sum(amount_minor) as total
        from public.transactions
        where workspace_id = p_workspace_id and kind = 'expense' and status = 'posted'
        group by 1
      ) e on e.month = ms.month
    ), '[]'::jsonb),
    'expenseCategories', coalesce((
      select jsonb_agg(row_to_json(x) order by x.total_minor::numeric desc)
      from (
        select c.id, c.name, c.translations, c.color,
               coalesce(sum(case when t.occurred_on between p_from and p_to then t.amount_minor end), 0)::text as total_minor,
               coalesce(sum(case when t.occurred_on between v_prev_from and v_prev_to then t.amount_minor end), 0)::text as previous_minor,
               case when v_expense > 0 then round(coalesce(sum(case when t.occurred_on between p_from and p_to then t.amount_minor end), 0) * 10000.0 / v_expense)::integer else 0 end as share_bp,
               case when coalesce(sum(case when t.occurred_on between v_prev_from and v_prev_to then t.amount_minor end), 0) > 0
                    then round((coalesce(sum(case when t.occurred_on between p_from and p_to then t.amount_minor end), 0)
                              - coalesce(sum(case when t.occurred_on between v_prev_from and v_prev_to then t.amount_minor end), 0)) * 10000.0
                              / coalesce(sum(case when t.occurred_on between v_prev_from and v_prev_to then t.amount_minor end), 1))::integer
                    else null end as change_bp
        from public.categories c
        left join public.transactions t
          on t.category_id = c.id and t.workspace_id = c.workspace_id
         and t.kind = 'expense' and t.status = 'posted'
         and t.occurred_on between v_prev_from and p_to
        where c.workspace_id = p_workspace_id and c.kind = 'expense' and not c.is_archived
        group by c.id, c.name, c.translations, c.color
        having coalesce(sum(case when t.occurred_on between p_from and p_to then t.amount_minor end), 0) > 0
           or coalesce(sum(case when t.occurred_on between v_prev_from and v_prev_to then t.amount_minor end), 0) > 0
      ) x
    ), '[]'::jsonb),
    'incomeCategories', coalesce((
      select jsonb_agg(row_to_json(x) order by x.total_minor::numeric desc)
      from (
        select c.id, c.name, c.translations, c.color,
               coalesce(sum(case when t.occurred_on between p_from and p_to then t.amount_minor end), 0)::text as total_minor,
               case when v_income > 0 then round(coalesce(sum(case when t.occurred_on between p_from and p_to then t.amount_minor end), 0) * 10000.0 / v_income)::integer else 0 end as share_bp
        from public.categories c
        left join public.transactions t
          on t.category_id = c.id and t.workspace_id = c.workspace_id
         and t.kind = 'income' and t.status = 'posted'
         and t.occurred_on between p_from and p_to
        where c.workspace_id = p_workspace_id and c.kind = 'income' and not c.is_archived
        group by c.id, c.name, c.translations, c.color
        having coalesce(sum(case when t.occurred_on between p_from and p_to then t.amount_minor end), 0) > 0
      ) x
    ), '[]'::jsonb),
    'categoryWeekComparisons', coalesce((
      select jsonb_agg(row_to_json(x) order by x.current_minor::numeric desc)
      from (
        select c.id, c.name, c.translations,
               coalesce(sum(case when t.occurred_on between (p_to - 6) and p_to then t.amount_minor end), 0)::text as current_minor,
               coalesce(sum(case when t.occurred_on between (p_to - 13) and (p_to - 7) then t.amount_minor end), 0)::text as previous_minor
        from public.categories c
        left join public.transactions t
          on t.category_id = c.id and t.workspace_id = c.workspace_id
         and t.kind = 'expense' and t.status = 'posted'
         and t.occurred_on between (p_to - 13) and p_to
        where c.workspace_id = p_workspace_id and c.kind = 'expense' and not c.is_archived
        group by c.id, c.name, c.translations
        having coalesce(sum(case when t.occurred_on between (p_to - 6) and p_to then t.amount_minor end), 0) > 0
           or coalesce(sum(case when t.occurred_on between (p_to - 13) and (p_to - 7) then t.amount_minor end), 0) > 0
      ) x
    ), '[]'::jsonb),
    'topCustomers', coalesce((
      select jsonb_agg(row_to_json(k) order by k.total_minor::numeric desc)
      from (
        select ct.id, ct.name, sum(t.amount_minor)::text as total_minor,
               case when v_income > 0 then round(sum(t.amount_minor) * 10000.0 / v_income)::integer else 0 end as share_bp
        from public.transactions t
        join public.contacts ct on ct.id = t.contact_id
        where t.workspace_id = p_workspace_id and t.kind = 'income' and t.status = 'posted'
          and t.occurred_on between p_from and p_to
        group by ct.id, ct.name
        order by sum(t.amount_minor) desc
        limit 5
      ) k
    ), '[]'::jsonb),
    'revenueConcentration', jsonb_build_object(
      'attributedIncomeMinor', v_attributed_income::text,
      'unattributedIncomeMinor', (v_income - v_attributed_income)::text,
      'topCustomerMinor', v_top_customer::text,
      'topCustomerShareBp', case when v_income > 0 then round(v_top_customer * 10000.0 / v_income)::integer else 0 end,
      'topFiveShareBp', case when v_income > 0 then round(v_top_five * 10000.0 / v_income)::integer else 0 end
    ),
    'debts', jsonb_build_object(
      'receivableMinor', coalesce((
        select sum(principal_minor - paid_minor) from public.debts
        where workspace_id = p_workspace_id and direction = 'receivable' and status in ('open', 'partially_paid')
      ), 0)::text,
      'payableMinor', coalesce((
        select sum(principal_minor - paid_minor) from public.debts
        where workspace_id = p_workspace_id and direction = 'payable' and status in ('open', 'partially_paid')
      ), 0)::text,
      'overdueReceivableMinor', coalesce((
        select sum(principal_minor - paid_minor) from public.debts
        where workspace_id = p_workspace_id and direction = 'receivable'
          and status in ('open', 'partially_paid') and due_on is not null and due_on < v_today
      ), 0)::text,
      'overduePayableMinor', coalesce((
        select sum(principal_minor - paid_minor) from public.debts
        where workspace_id = p_workspace_id and direction = 'payable'
          and status in ('open', 'partially_paid') and due_on is not null and due_on < v_today
      ), 0)::text,
      'openCount', (
        select count(*)::integer from public.debts
        where workspace_id = p_workspace_id and status in ('open', 'partially_paid')
      ),
      'aging', coalesce((
        select jsonb_agg(row_to_json(a) order by a.direction, a.bucket)
        from (
          select d.direction,
                 case
                   when d.due_on is null or d.due_on >= v_today then 'not_due'
                   when v_today - d.due_on <= 30 then 'days_1_30'
                   when v_today - d.due_on <= 60 then 'days_31_60'
                   else 'days_61_plus'
                 end as bucket,
                 sum(d.principal_minor - d.paid_minor)::text as total_minor,
                 count(*)::integer as debt_count
          from public.debts d
          where d.workspace_id = p_workspace_id and d.status in ('open', 'partially_paid')
          group by d.direction, bucket
        ) a
      ), '[]'::jsonb),
      'topOpen', coalesce((
        select jsonb_agg(row_to_json(o) order by o.overdue desc, o.due_on nulls last)
        from (
          select d.direction, ct.name as contact_name, d.description,
                 (d.principal_minor - d.paid_minor)::text as outstanding_minor,
                 case when d.due_on is null then null else to_char(d.due_on, 'YYYY-MM-DD') end as due_on,
                 (d.due_on is not null and d.due_on < v_today) as overdue
          from public.debts d
          left join public.contacts ct on ct.id = d.contact_id
          where d.workspace_id = p_workspace_id and d.status in ('open', 'partially_paid')
          order by (d.due_on is not null and d.due_on < v_today) desc, d.due_on nulls last
          limit 8
        ) o
      ), '[]'::jsonb)
    ),
    'budgets', coalesce((
      select jsonb_agg(row_to_json(b) order by b.period_end, b.name)
      from (
        select bp.id, bp.name, bp.category_name, bp.category_translations, bp.category_color,
               to_char(bp.period_start, 'YYYY-MM-DD') as period_start,
               to_char(bp.period_end, 'YYYY-MM-DD') as period_end,
               bp.amount_minor::text as amount_minor,
               bp.spent_minor::text as spent_minor,
               bp.alert_threshold_bp,
               case when bp.amount_minor > 0 then round(bp.spent_minor * 10000.0 / bp.amount_minor)::integer else 0 end as used_bp
        from public.v_budget_progress bp
        where bp.workspace_id = p_workspace_id
          and bp.period_start <= p_to and bp.period_end >= p_from
      ) b
    ), '[]'::jsonb),
    'recurringExpenses', coalesce((
      select jsonb_agg(row_to_json(r) order by r.occurrences desc, r.average_minor::numeric desc)
      from (
        select min(t.description) as description,
               c.name as category_name, c.translations as category_translations,
               count(*)::integer as occurrences,
               count(distinct date_trunc('month', t.occurred_on))::integer as months_seen,
               (sum(t.amount_minor) / count(*))::text as average_minor,
               min(t.amount_minor)::text as min_minor,
               max(t.amount_minor)::text as max_minor,
               to_char(max(t.occurred_on), 'YYYY-MM-DD') as last_on,
               round((max(t.occurred_on) - min(t.occurred_on))::numeric / greatest(count(*) - 1, 1))::integer as cadence_days
        from public.transactions t
        left join public.categories c on c.id = t.category_id
        where t.workspace_id = p_workspace_id and t.kind = 'expense' and t.status = 'posted'
          and t.occurred_on between p_from and p_to
        group by lower(trim(t.description)), c.id, c.name, c.translations
        having count(*) > 1
           and count(distinct date_trunc('month', t.occurred_on)) >= 2
           and max(t.amount_minor) <= min(t.amount_minor) * 1.75
        order by count(*) desc, sum(t.amount_minor) desc
        limit 8
      ) r
    ), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(row_to_json(g) order by g.target_date nulls last, g.name)
      from (
        select id, name, target_minor::text as target_minor, saved_minor::text as saved_minor,
               currency, case when target_date is null then null else to_char(target_date, 'YYYY-MM-DD') end as target_date,
               case when target_minor > 0 then round(saved_minor * 10000.0 / target_minor)::integer else 0 end as progress_bp
        from public.financial_goals
        where workspace_id = p_workspace_id and archived_at is null and status = 'active'
        limit 6
      ) g
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_business_intelligence(uuid, date, date) from public, anon;
grant execute on function public.get_business_intelligence(uuid, date, date) to authenticated;
