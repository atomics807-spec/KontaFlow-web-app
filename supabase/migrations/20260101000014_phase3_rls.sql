-- =============================================================================
-- KontaFlow · 0014 — Row Level Security for Phase 3 tables
-- =============================================================================
-- Membership is always resolved from auth.uid() through the SECURITY DEFINER
-- helpers in 0002. A workspace_id supplied by a browser is only ever used to
-- look up the caller's membership; it never grants access by itself.
--
-- Service-only tables (payment webhooks, OTP challenges, idempotency records)
-- still enable RLS and simply define no authenticated policy, so the anon and
-- authenticated roles can never read them.
-- =============================================================================

alter table public.business_settings enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.budgets enable row level security;
alter table public.financial_goals enable row level security;
alter table public.inventory_items enable row level security;
alter table public.financial_reports enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscription_features enable row level security;
alter table public.plan_features enable row level security;
alter table public.payment_webhooks enable row level security;
alter table public.ai_interactions enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.privacy_consents enable row level security;
alter table public.otp_verifications enable row level security;
alter table public.integration_accounts enable row level security;
alter table public.integration_messages enable row level security;
alter table public.offline_sync_records enable row level security;
alter table public.idempotency_records enable row level security;

-- --------------------------- business settings -----------------------------
drop policy if exists business_settings_select_member on public.business_settings;
create policy business_settings_select_member on public.business_settings
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists business_settings_update_admin on public.business_settings;
create policy business_settings_update_admin on public.business_settings
  for update to authenticated
  using (app.can_manage_workspace(workspace_id))
  with check (app.can_manage_workspace(workspace_id));

-- ------------------------------- invoices ----------------------------------
drop policy if exists invoices_select_member on public.invoices;
create policy invoices_select_member on public.invoices
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists invoices_insert_finance on public.invoices;
create policy invoices_insert_finance on public.invoices
  for insert to authenticated
  with check (app.can_write_finance(workspace_id));

drop policy if exists invoices_update_finance on public.invoices;
create policy invoices_update_finance on public.invoices
  for update to authenticated
  using (app.can_write_finance(workspace_id))
  with check (app.can_write_finance(workspace_id));

drop policy if exists invoices_delete_manager on public.invoices;
create policy invoices_delete_manager on public.invoices
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

drop policy if exists invoice_items_select_member on public.invoice_items;
create policy invoice_items_select_member on public.invoice_items
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists invoice_items_write_finance on public.invoice_items;
create policy invoice_items_write_finance on public.invoice_items
  for insert to authenticated
  with check (app.can_write_finance(workspace_id));

drop policy if exists invoice_items_update_finance on public.invoice_items;
create policy invoice_items_update_finance on public.invoice_items
  for update to authenticated
  using (app.can_write_finance(workspace_id))
  with check (app.can_write_finance(workspace_id));

drop policy if exists invoice_items_delete_finance on public.invoice_items;
create policy invoice_items_delete_finance on public.invoice_items
  for delete to authenticated
  using (app.can_write_finance(workspace_id));

-- -------------------------------- debts ------------------------------------
drop policy if exists debts_select_member on public.debts;
create policy debts_select_member on public.debts
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists debts_insert_finance on public.debts;
create policy debts_insert_finance on public.debts
  for insert to authenticated
  with check (app.can_write_finance(workspace_id));

drop policy if exists debts_update_finance on public.debts;
create policy debts_update_finance on public.debts
  for update to authenticated
  using (app.can_write_finance(workspace_id))
  with check (app.can_write_finance(workspace_id));

drop policy if exists debts_delete_manager on public.debts;
create policy debts_delete_manager on public.debts
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

drop policy if exists debt_payments_select_member on public.debt_payments;
create policy debt_payments_select_member on public.debt_payments
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists debt_payments_insert_finance on public.debt_payments;
create policy debt_payments_insert_finance on public.debt_payments
  for insert to authenticated
  with check (app.can_write_finance(workspace_id));

drop policy if exists debt_payments_delete_manager on public.debt_payments;
create policy debt_payments_delete_manager on public.debt_payments
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

drop policy if exists debt_payments_update_finance on public.debt_payments;
create policy debt_payments_update_finance on public.debt_payments
  for update to authenticated
  using (app.can_write_finance(workspace_id))
  with check (app.can_write_finance(workspace_id));

-- --------------------------- budgets and goals -----------------------------
drop policy if exists budgets_select_member on public.budgets;
create policy budgets_select_member on public.budgets
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists budgets_write_manager on public.budgets;
create policy budgets_write_manager on public.budgets
  for insert to authenticated
  with check (app.can_manage_records(workspace_id));

drop policy if exists budgets_update_manager on public.budgets;
create policy budgets_update_manager on public.budgets
  for update to authenticated
  using (app.can_manage_records(workspace_id))
  with check (app.can_manage_records(workspace_id));

drop policy if exists budgets_delete_manager on public.budgets;
create policy budgets_delete_manager on public.budgets
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

drop policy if exists financial_goals_select_member on public.financial_goals;
create policy financial_goals_select_member on public.financial_goals
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists financial_goals_write_manager on public.financial_goals;
create policy financial_goals_write_manager on public.financial_goals
  for insert to authenticated
  with check (app.can_manage_records(workspace_id));

drop policy if exists financial_goals_update_manager on public.financial_goals;
create policy financial_goals_update_manager on public.financial_goals
  for update to authenticated
  using (app.can_manage_records(workspace_id))
  with check (app.can_manage_records(workspace_id));

drop policy if exists financial_goals_delete_manager on public.financial_goals;
create policy financial_goals_delete_manager on public.financial_goals
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

-- ------------------------------ inventory ----------------------------------
drop policy if exists inventory_items_select_member on public.inventory_items;
create policy inventory_items_select_member on public.inventory_items
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists inventory_items_write_finance on public.inventory_items;
create policy inventory_items_write_finance on public.inventory_items
  for insert to authenticated
  with check (app.can_write_finance(workspace_id));

drop policy if exists inventory_items_update_finance on public.inventory_items;
create policy inventory_items_update_finance on public.inventory_items
  for update to authenticated
  using (app.can_write_finance(workspace_id))
  with check (app.can_write_finance(workspace_id));

drop policy if exists inventory_items_delete_manager on public.inventory_items;
create policy inventory_items_delete_manager on public.inventory_items
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

-- ---------------------------- saved reports --------------------------------
drop policy if exists financial_reports_select_member on public.financial_reports;
create policy financial_reports_select_member on public.financial_reports
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists financial_reports_insert_finance on public.financial_reports;
create policy financial_reports_insert_finance on public.financial_reports
  for insert to authenticated
  with check (app.can_write_finance(workspace_id));

drop policy if exists financial_reports_delete_manager on public.financial_reports;
create policy financial_reports_delete_manager on public.financial_reports
  for delete to authenticated
  using (app.can_manage_records(workspace_id) or generated_by = (select auth.uid()));

-- --------------------------- plan catalogue --------------------------------
drop policy if exists plans_select_authenticated on public.subscription_plans;
create policy plans_select_authenticated on public.subscription_plans
  for select to authenticated
  using (true);

drop policy if exists features_select_authenticated on public.subscription_features;
create policy features_select_authenticated on public.subscription_features
  for select to authenticated
  using (true);

drop policy if exists plan_features_select_authenticated on public.plan_features;
create policy plan_features_select_authenticated on public.plan_features
  for select to authenticated
  using (true);

drop policy if exists subscriptions_update_admin on public.subscriptions;
create policy subscriptions_update_admin on public.subscriptions
  for update to authenticated
  using (app.can_manage_workspace(workspace_id))
  with check (app.can_manage_workspace(workspace_id));

-- ------------------------------ AI telemetry -------------------------------
drop policy if exists ai_interactions_select_own on public.ai_interactions;
create policy ai_interactions_select_own on public.ai_interactions
  for select to authenticated
  using (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

drop policy if exists ai_interactions_insert_own on public.ai_interactions;
create policy ai_interactions_insert_own on public.ai_interactions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

drop policy if exists ai_suggestions_select_own on public.ai_suggestions;
create policy ai_suggestions_select_own on public.ai_suggestions
  for select to authenticated
  using (
    app.is_workspace_member(workspace_id)
    and (user_id is null or user_id = (select auth.uid()))
  );

drop policy if exists ai_suggestions_update_own on public.ai_suggestions;
create policy ai_suggestions_update_own on public.ai_suggestions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

drop policy if exists ai_suggestions_delete_manager on public.ai_suggestions;
create policy ai_suggestions_delete_manager on public.ai_suggestions
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

-- ------------------------ notifications and consent ------------------------
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

drop policy if exists privacy_consents_select_own on public.privacy_consents;
create policy privacy_consents_select_own on public.privacy_consents
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists privacy_consents_insert_own on public.privacy_consents;
create policy privacy_consents_insert_own on public.privacy_consents
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (workspace_id is null or app.is_workspace_member(workspace_id))
  );

drop policy if exists privacy_consents_update_own on public.privacy_consents;
create policy privacy_consents_update_own on public.privacy_consents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ----------------------------- integrations --------------------------------
drop policy if exists integration_accounts_select_admin on public.integration_accounts;
create policy integration_accounts_select_admin on public.integration_accounts
  for select to authenticated
  using (app.can_manage_workspace(workspace_id));

drop policy if exists integration_accounts_write_admin on public.integration_accounts;
create policy integration_accounts_write_admin on public.integration_accounts
  for insert to authenticated
  with check (app.can_manage_workspace(workspace_id));

drop policy if exists integration_accounts_update_admin on public.integration_accounts;
create policy integration_accounts_update_admin on public.integration_accounts
  for update to authenticated
  using (app.can_manage_workspace(workspace_id))
  with check (app.can_manage_workspace(workspace_id));

drop policy if exists integration_messages_select_manager on public.integration_messages;
create policy integration_messages_select_manager on public.integration_messages
  for select to authenticated
  using (app.can_manage_records(workspace_id));

-- ---------------------------- offline and sync -----------------------------
drop policy if exists offline_sync_select_own on public.offline_sync_records;
create policy offline_sync_select_own on public.offline_sync_records
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists offline_sync_insert_own on public.offline_sync_records;
create policy offline_sync_insert_own on public.offline_sync_records
  for insert to authenticated
  with check (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

drop policy if exists offline_sync_update_own on public.offline_sync_records;
create policy offline_sync_update_own on public.offline_sync_records
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileges. RLS is the gate; these grants only decide which operations the
-- API roles may attempt at all.
-- ---------------------------------------------------------------------------
revoke all on table
  public.business_settings, public.invoices, public.invoice_items,
  public.debts, public.debt_payments, public.budgets, public.financial_goals,
  public.inventory_items, public.financial_reports, public.ai_interactions,
  public.ai_suggestions, public.notification_preferences, public.privacy_consents,
  public.integration_accounts, public.integration_messages,
  public.offline_sync_records
from anon;

grant select, insert, update, delete on table
  public.business_settings, public.invoices, public.invoice_items,
  public.debts, public.debt_payments, public.budgets, public.financial_goals,
  public.inventory_items, public.financial_reports, public.ai_suggestions,
  public.notification_preferences, public.privacy_consents,
  public.integration_accounts
to authenticated;

grant select, insert on table public.ai_interactions, public.offline_sync_records to authenticated;
grant update on table public.offline_sync_records to authenticated;
grant select on table public.ai_interactions to authenticated;
grant select on table public.integration_messages to authenticated;

grant select on table
  public.subscription_plans, public.subscription_features, public.plan_features
to authenticated;

revoke all on table
  public.payment_webhooks, public.otp_verifications, public.idempotency_records,
  public.subscription_plans, public.subscription_features, public.plan_features
from anon;

revoke all on table
  public.payment_webhooks, public.otp_verifications, public.idempotency_records
from authenticated;

grant all on table
  public.business_settings, public.invoices, public.invoice_items,
  public.debts, public.debt_payments, public.budgets, public.financial_goals,
  public.inventory_items, public.financial_reports, public.subscription_plans,
  public.subscription_features, public.plan_features, public.payment_webhooks,
  public.ai_interactions, public.ai_suggestions, public.notification_preferences,
  public.privacy_consents, public.otp_verifications, public.integration_accounts,
  public.integration_messages, public.offline_sync_records, public.idempotency_records
to service_role;

revoke all on table
  public.financial_accounts, public.customers, public.suppliers,
  public.transaction_categories, public.business_categories
from anon;

grant select on table
  public.financial_accounts, public.customers, public.suppliers,
  public.transaction_categories, public.business_categories
to authenticated, service_role;
