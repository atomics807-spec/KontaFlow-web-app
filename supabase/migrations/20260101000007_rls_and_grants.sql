-- =============================================================================
-- KontaFlow · 0007 — Row Level Security and grants
-- =============================================================================
-- Rules of the road:
--   * every tenant table is protected by workspace membership
--   * financial writes (transactions + ledger) have NO insert/update policy:
--     they are only reachable through the SECURITY DEFINER functions in 0005
--   * anon has no table privileges at all
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.channel_identities enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.contacts enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_lines enable row level security;
alter table public.attachments enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.ussd_sessions enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.webhook_events enable row level security;
alter table public.sync_devices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.usage_events enable row level security;

-- ------------------------------- profiles -----------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

-- ------------------------------ workspaces ---------------------------------
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using (app.is_workspace_member(id));

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin on public.workspaces
  for update to authenticated
  using (app.can_manage_workspace(id))
  with check (app.can_manage_workspace(id));

drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner on public.workspaces
  for delete to authenticated
  using (app.is_workspace_owner(id));

-- --------------------------- workspace members -----------------------------
drop policy if exists members_select_workspace on public.workspace_members;
create policy members_select_workspace on public.workspace_members
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists members_insert_admin on public.workspace_members;
create policy members_insert_admin on public.workspace_members
  for insert to authenticated
  with check (app.can_manage_workspace(workspace_id));

drop policy if exists members_update_admin on public.workspace_members;
create policy members_update_admin on public.workspace_members
  for update to authenticated
  using (app.can_manage_workspace(workspace_id))
  with check (app.can_manage_workspace(workspace_id));

drop policy if exists members_delete_admin on public.workspace_members;
create policy members_delete_admin on public.workspace_members
  for delete to authenticated
  using (app.can_manage_workspace(workspace_id));

-- --------------------------- invitations -----------------------------------
drop policy if exists invitations_select_admin on public.workspace_invitations;
create policy invitations_select_admin on public.workspace_invitations
  for select to authenticated
  using (app.can_manage_workspace(workspace_id));

drop policy if exists invitations_insert_admin on public.workspace_invitations;
create policy invitations_insert_admin on public.workspace_invitations
  for insert to authenticated
  with check (app.can_manage_workspace(workspace_id));

drop policy if exists invitations_update_admin on public.workspace_invitations;
create policy invitations_update_admin on public.workspace_invitations
  for update to authenticated
  using (app.can_manage_workspace(workspace_id))
  with check (app.can_manage_workspace(workspace_id));

drop policy if exists invitations_delete_admin on public.workspace_invitations;
create policy invitations_delete_admin on public.workspace_invitations
  for delete to authenticated
  using (app.can_manage_workspace(workspace_id));

-- --------------------------- channel identities ----------------------------
drop policy if exists channel_identities_select_own on public.channel_identities;
create policy channel_identities_select_own on public.channel_identities
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists channel_identities_write_own on public.channel_identities;
create policy channel_identities_write_own on public.channel_identities
  for all to authenticated
  using (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

-- ------------------------------- accounts ---------------------------------
drop policy if exists accounts_select_member on public.accounts;
create policy accounts_select_member on public.accounts
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists accounts_write_manager on public.accounts;
create policy accounts_write_manager on public.accounts
  for insert to authenticated
  with check (app.can_manage_records(workspace_id));

drop policy if exists accounts_update_manager on public.accounts;
create policy accounts_update_manager on public.accounts
  for update to authenticated
  using (app.can_manage_records(workspace_id))
  with check (app.can_manage_records(workspace_id));

drop policy if exists accounts_delete_manager on public.accounts;
create policy accounts_delete_manager on public.accounts
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

-- ------------------------------- categories -------------------------------
drop policy if exists categories_select_member on public.categories;
create policy categories_select_member on public.categories
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists categories_insert_manager on public.categories;
create policy categories_insert_manager on public.categories
  for insert to authenticated
  with check (app.can_manage_records(workspace_id));

drop policy if exists categories_update_manager on public.categories;
create policy categories_update_manager on public.categories
  for update to authenticated
  using (app.can_manage_records(workspace_id))
  with check (app.can_manage_records(workspace_id));

drop policy if exists categories_delete_manager on public.categories;
create policy categories_delete_manager on public.categories
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

-- -------------------------------- contacts --------------------------------
drop policy if exists contacts_select_member on public.contacts;
create policy contacts_select_member on public.contacts
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists contacts_insert_manager on public.contacts;
create policy contacts_insert_manager on public.contacts
  for insert to authenticated
  with check (app.can_manage_records(workspace_id));

drop policy if exists contacts_update_manager on public.contacts;
create policy contacts_update_manager on public.contacts
  for update to authenticated
  using (app.can_manage_records(workspace_id))
  with check (app.can_manage_records(workspace_id));

drop policy if exists contacts_delete_manager on public.contacts;
create policy contacts_delete_manager on public.contacts
  for delete to authenticated
  using (app.can_manage_records(workspace_id));

-- ------------------------- transactions and ledger ------------------------
-- Read-only through the API. Writes must go through record_transaction() /
-- void_transaction() so the ledger can never drift from the records.
drop policy if exists transactions_select_member on public.transactions;
create policy transactions_select_member on public.transactions
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists ledger_lines_select_member on public.ledger_lines;
create policy ledger_lines_select_member on public.ledger_lines
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

-- ------------------------------ attachments -------------------------------
drop policy if exists attachments_select_member on public.attachments;
create policy attachments_select_member on public.attachments
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists attachments_insert_writer on public.attachments;
create policy attachments_insert_writer on public.attachments
  for insert to authenticated
  with check (app.can_write_finance(workspace_id) and uploaded_by = (select auth.uid()));

drop policy if exists attachments_delete_owner on public.attachments;
create policy attachments_delete_owner on public.attachments
  for delete to authenticated
  using (uploaded_by = (select auth.uid()) or app.can_manage_records(workspace_id));

-- ---------------------------- AI conversations ----------------------------
drop policy if exists ai_conversations_select_own on public.ai_conversations;
create policy ai_conversations_select_own on public.ai_conversations
  for select to authenticated
  using (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

drop policy if exists ai_conversations_insert_own on public.ai_conversations;
create policy ai_conversations_insert_own on public.ai_conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

drop policy if exists ai_conversations_update_own on public.ai_conversations;
create policy ai_conversations_update_own on public.ai_conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ai_conversations_delete_own on public.ai_conversations;
create policy ai_conversations_delete_own on public.ai_conversations
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists ai_messages_select_own on public.ai_messages;
create policy ai_messages_select_own on public.ai_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists ai_messages_insert_own on public.ai_messages;
create policy ai_messages_insert_own on public.ai_messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = (select auth.uid())
        and c.workspace_id = ai_messages.workspace_id
    )
    and app.is_workspace_member(workspace_id)
  );

-- -------------------------------- audit -----------------------------------
drop policy if exists audit_select_admin on public.audit_logs;
create policy audit_select_admin on public.audit_logs
  for select to authenticated
  using (app.can_manage_workspace(workspace_id));

-- ---------------------------- notifications -------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------------ channels ----------------------------------
-- USSD sessions and webhook payloads are service-role only: no policy.
drop policy if exists whatsapp_messages_select_admin on public.whatsapp_messages;
create policy whatsapp_messages_select_admin on public.whatsapp_messages
  for select to authenticated
  using (workspace_id is not null and app.can_manage_workspace(workspace_id));

-- ------------------------------- billing ----------------------------------
drop policy if exists subscriptions_select_admin on public.subscriptions;
create policy subscriptions_select_admin on public.subscriptions
  for select to authenticated
  using (app.can_manage_workspace(workspace_id));

drop policy if exists payments_select_admin on public.payment_transactions;
create policy payments_select_admin on public.payment_transactions
  for select to authenticated
  using (app.can_manage_workspace(workspace_id));

drop policy if exists usage_select_admin on public.usage_events;
create policy usage_select_admin on public.usage_events
  for select to authenticated
  using (app.can_manage_workspace(workspace_id));

-- ------------------------------- devices ----------------------------------
drop policy if exists sync_devices_select_own on public.sync_devices;
create policy sync_devices_select_own on public.sync_devices
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists sync_devices_write_own on public.sync_devices;
create policy sync_devices_write_own on public.sync_devices
  for all to authenticated
  using (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- Role escalation guard: only an owner can grant the owner role.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_owner_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'owner'
     and not app.is_workspace_owner(new.workspace_id)
     and exists (
       select 1 from public.workspace_members m
       where m.workspace_id = new.workspace_id and m.role = 'owner'
     ) then
    raise exception 'Only an owner can grant the owner role' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_members_prevent_escalation on public.workspace_members;
create trigger workspace_members_prevent_escalation
before insert or update on public.workspace_members
for each row execute function public.prevent_owner_escalation();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema app to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on public.v_transactions, public.v_account_balances, public.v_monthly_cashflow to authenticated;

grant execute on all functions in schema app to authenticated, service_role;

revoke all on all functions in schema public from public;
grant execute on all functions in schema public to authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Supabase's auth service writes into auth.users and fires the profile trigger.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant usage on schema public to supabase_auth_admin';
    execute 'grant execute on function public.handle_new_user() to supabase_auth_admin';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'grant usage on schema public to authenticator';
  end if;
end $$;

-- PostgREST needs to resolve these functions through its exposed schema.
grant execute on function public.create_workspace(text, text, text, text, text, text) to authenticated;
grant execute on function public.record_transaction(jsonb) to authenticated;
grant execute on function public.void_transaction(uuid, text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.get_dashboard_summary(uuid, date, date) to authenticated;
grant execute on function public.get_report(uuid, date, date) to authenticated;
grant execute on function public.consume_quota(uuid, public.usage_kind, integer) to authenticated;
