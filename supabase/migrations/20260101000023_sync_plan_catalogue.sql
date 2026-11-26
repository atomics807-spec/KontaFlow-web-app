-- Keep the plan catalogue aligned with the runtime entitlements in src/lib/plans.ts.
update public.subscription_plans
set seats_included = 2, workspace_limit = 1, ai_message_limit = 50, updated_at = now()
where code = 'starter';

update public.subscription_plans
set seats_included = 8, workspace_limit = 2, ai_message_limit = 500, updated_at = now()
where code = 'growth';

update public.subscription_plans
set seats_included = 25, workspace_limit = null, ai_message_limit = 5000, updated_at = now()
where code = 'scale';
