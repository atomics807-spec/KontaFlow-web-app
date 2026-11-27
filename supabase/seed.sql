-- =============================================================================
-- KontaFlow — seed data
-- =============================================================================
-- Runs after migrations on `supabase db reset`. Only global catalogue rows are
-- seeded here; tenant data (accounts, categories, settings, trial subscription)
-- is provisioned atomically by public.create_workspace().
-- Idempotent: safe to run against an existing database.
-- =============================================================================

insert into public.subscription_plans
  (code, name, description, price_minor, currency, billing_interval, seats_included, workspace_limit, ai_message_limit, sort_order)
values
  ('starter', 'Starter', 'A 14-day starter trial for small businesses beginning digital bookkeeping.', 0, 'XAF', 'month', 2, 1, 50, 1),
  ('growth', 'Growth', 'For shops and small teams with daily volume.', 9900, 'XAF', 'month', 8, 2, 500, 2),
  ('scale', 'Scale', 'For multi-branch businesses and accountants.', 29900, 'XAF', 'month', 25, null, 5000, 3)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      price_minor = excluded.price_minor,
      currency = excluded.currency,
      billing_interval = excluded.billing_interval,
      seats_included = excluded.seats_included,
      workspace_limit = excluded.workspace_limit,
      ai_message_limit = excluded.ai_message_limit,
      sort_order = excluded.sort_order,
      updated_at = now();

insert into public.subscription_features (code, name, description, category)
values
  ('core_bookkeeping', 'Double-entry bookkeeping', 'Ledger, accounts and immutable records.', 'accounting'),
  ('web_channels', 'Web, USSD and WhatsApp', 'Record money from every channel.', 'channels'),
  ('offline_sync', 'Offline capture and sync', 'Keep recording without a connection.', 'channels'),
  ('ai_assistant', 'AI assistant', 'Ask questions against your live books.', 'ai'),
  ('invoicing', 'Invoices', 'Issue invoices and track receivables.', 'accounting'),
  ('inventory', 'Inventory tracking', 'Stock levels and low-stock alerts.', 'accounting'),
  ('team_seats', 'Team members', 'Invite staff with granular roles.', 'team'),
  ('accountant_exports', 'Accountant exports', 'CSV and PDF packs for your accountant.', 'accounting'),
  ('priority_support', 'Priority support', 'Faster human support.', 'general')
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      category = excluded.category;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true,
       case f.code when 'team_seats' then 5 else null end
from public.subscription_plans p
join public.subscription_features f
  on f.code in ('core_bookkeeping', 'web_channels', 'offline_sync', 'ai_assistant')
where p.code in ('starter', 'growth', 'scale')
on conflict (plan_id, feature_id) do update
  set included = excluded.included, limit_value = excluded.limit_value;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, null
from public.subscription_plans p
join public.subscription_features f
  on f.code in ('invoicing', 'inventory', 'accountant_exports', 'team_seats')
where p.code = 'scale'
on conflict (plan_id, feature_id) do update
  set included = excluded.included, limit_value = excluded.limit_value;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, null
from public.subscription_plans p
join public.subscription_features f on f.code = 'priority_support'
where p.code = 'scale'
on conflict (plan_id, feature_id) do update
  set included = excluded.included, limit_value = excluded.limit_value;
