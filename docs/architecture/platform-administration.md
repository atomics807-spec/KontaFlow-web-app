# Platform administration

KontaFlow has two separate identity planes.

1. **Tenant identities** belong to a business workspace and hold a role of
   `owner`, `admin`, `accountant`, `manager` or `staff`.
2. **Platform identities** operate KontaFlow itself. They live in
   `public.platform_admins`, never in `workspace_members`, and never own a
   workspace.

The distinction is enforced in PostgreSQL, not only in the interface.

## Why the planes are separate

A normal workspace administrator can change team members, records and settings
inside one tenant. They must never see another tenant, change a subscription
plan, suspend an account or read the platform audit log.

A platform administrator has no tenant role at all. This avoids a class of bugs
where an "admin" flag on a workspace account accidentally grants cross-tenant
power.

Three triggers protect the boundary:

| Trigger | Purpose |
| --- | --- |
| `members_reject_platform_admin` | A platform admin cannot be inserted into `workspace_members`. |
| `workspaces_reject_platform_admin_owner` | A platform admin cannot become `workspaces.owner_id`. |
| `platform_admins_require_separation` | An account that already owns or belongs to a workspace cannot become a platform admin. |

`create_workspace` and `complete_onboarding` therefore fail for platform admins,
and the application redirects them to `/admin`.

## Roles

| Role | Read console | Restrict accounts | Change plans | Manage platform admins |
| --- | --- | --- | --- | --- |
| `support` | Yes | No | No | No |
| `admin` | Yes | Yes | Yes | No |
| `super_admin` | Yes | Yes | Yes | Yes |

The last active `super_admin` cannot be deactivated or deleted. The guard is a
database trigger so it also protects direct service-role operations.

## Account restrictions

`public.account_restrictions` stores platform restrictions. A user has at most
one active row (partial unique index).

| Severity | Sign-in | Tenant data | Typical use |
| --- | --- | --- | --- |
| `limited` | Allowed | Blocked | Investigation, unpaid invoice, abuse review |
| `suspended` | Blocked by Supabase Auth ban | Blocked | Fraud or a serious policy breach |

A restriction with `expires_at` in the past no longer blocks anything. GoTrue
receives the matching `ban_duration`, so a suspension lifts at the same time in
the database and in Auth.

### Enforcement

`app.is_user_restricted(uuid, timestamptz)` is called from:

- `app.is_workspace_member` and `app.workspace_role`, the helpers every tenant
  policy and financial RPC already uses;
- a restrictive `account_not_restricted` policy added to every public table
  that had RLS at migration 0034.

`profiles` and `account_restrictions` are deliberately exempt so a restricted
person can still see who they are and why access stopped. The platform admin and
platform audit tables are also exempt, but they have no tenant policy.

New public tables must add the same restrictive policy. The migration includes a
loop over existing RLS tables; future migrations should call the same helper.

## Console

| Route | Contents |
| --- | --- |
| `/[locale]/admin` | Platform totals, plan mix, recent restrictions |
| `/[locale]/admin/users` | Account search, restriction controls |
| `/[locale]/admin/workspaces` | Tenant list, owner, plan and volume |
| `/[locale]/admin/admins` | Super-admin-only administrator directory |
| `/[locale]/admin/audit` | Append-only platform action history |

The console has its own shell, is `noindex`, and is protected by the request proxy plus
`requirePlatformAdmin`. A normal user who opens `/admin` is sent back to their
dashboard; a platform admin who opens a tenant page is sent to `/admin`.

## Provisioning

Demo and preview:

```bash
npm run demo:super-admin
# superadmin@kontaflow.demo
```

The script reads `.env.local`, creates or updates the Auth user, disables tenant
verification requirements for the operator, and upserts the `super_admin` row.
Production provisioning requires `KONTAFLOW_SUPER_ADMIN_PASSWORD`; the known demo
fallback is refused when `APP_ENV=production` or `VERCEL_ENV=production`.

Ongoing administrators are created from the console by a `super_admin`. The
server action uses the service-role client only for Auth user creation and the
subsequent `platform_admins` insert. The database triggers still enforce
separation.

## Audit trail

Every RPC writes to `platform_admin_audit_log` with the acting admin, action,
target, safe details and request IP. The table is append-only from the app: only
the `SECURITY DEFINER` audit helper and the service role can insert, and
`authenticated` has no direct write grant.
