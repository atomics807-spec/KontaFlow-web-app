-- =============================================================================
-- KontaFlow · 0002 — identity, tenants and access control
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  locale text not null default 'en' check (locale in ('en', 'fr', 'wes')),
  avatar_url text,
  default_workspace_id uuid,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{6,15}$')
);
comment on table public.profiles is 'Application profile mirroring auth.users. One row per authenticated user.';

create unique index if not exists profiles_phone_key on public.profiles (phone) where phone is not null;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  legal_name text,
  slug text not null unique,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  currency char(3) not null default 'XAF' check (currency in ('XAF','XOF','USD','EUR','GBP','NGN','KES','GHS')),
  timezone text not null default 'Africa/Douala',
  locale text not null default 'en' check (locale in ('en', 'fr', 'wes')),
  country_code char(2) not null default 'CM',
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  logo_url text,
  plan public.workspace_plan not null default 'starter',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.workspaces is 'Tenant root. Every tenant-owned record references one workspace.';

create index if not exists workspaces_owner_idx on public.workspaces (owner_id);

alter table public.profiles
  drop constraint if exists profiles_default_workspace_fk;
alter table public.profiles
  add constraint profiles_default_workspace_fk
  foreign key (default_workspace_id) references public.workspaces (id) on delete set null;

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'staff',
  status public.member_status not null default 'active',
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
comment on table public.workspace_members is 'Membership and role of a user inside a tenant.';

create index if not exists workspace_members_user_active_idx
  on public.workspace_members (user_id, workspace_id) where status = 'active';
create index if not exists workspace_members_workspace_idx on public.workspace_members (workspace_id);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.workspace_role not null default 'staff',
  token uuid not null default gen_random_uuid() unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspace_invitations_workspace_idx
  on public.workspace_invitations (workspace_id, status);
create unique index if not exists workspace_invitations_pending_key
  on public.workspace_invitations (workspace_id, lower(email)) where status = 'pending';

create table if not exists public.channel_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  channel public.entry_channel not null default 'whatsapp',
  address text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, address)
);
comment on table public.channel_identities is 'Maps a phone number (E.164) to a user and their default workspace for USSD/WhatsApp.';

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER: needed because they read membership
-- rows while RLS is active on workspace_members itself).
-- ---------------------------------------------------------------------------

create or replace function app.workspace_role(p_workspace_id uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function app.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function app.has_workspace_role(p_workspace_id uuid, p_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(app.workspace_role(p_workspace_id) = any (p_roles), false);
$$;

create or replace function app.can_write_finance(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    app.workspace_role(p_workspace_id) = any (
      array['owner','admin','accountant','manager','staff']::public.workspace_role[]
    ),
    false
  );
$$;

create or replace function app.can_manage_records(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    app.workspace_role(p_workspace_id) = any (
      array['owner','admin','accountant','manager']::public.workspace_role[]
    ),
    false
  );
$$;

create or replace function app.can_manage_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    app.workspace_role(p_workspace_id) = any (
      array['owner','admin']::public.workspace_role[]
    ),
    false
  );
$$;

create or replace function app.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(app.workspace_role(p_workspace_id) = 'owner', false);
$$;

revoke all on function app.workspace_role(uuid) from public, anon;
revoke all on function app.is_workspace_member(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Profile bootstrap: one profile per auth user, created server-side.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locale text;
begin
  v_locale := coalesce(new.raw_user_meta_data ->> 'locale', 'en');
  if v_locale not in ('en', 'fr', 'wes') then
    v_locale := 'en';
  end if;

  insert into public.profiles (id, full_name, phone, locale)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', new.phone)), ''),
    v_locale
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Invariant: a workspace always keeps at least one active owner.
-- ---------------------------------------------------------------------------
create or replace function public.protect_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remaining integer;
begin
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

drop trigger if exists workspace_members_protect_owner on public.workspace_members;
create trigger workspace_members_protect_owner
before update or delete on public.workspace_members
for each row execute function public.protect_workspace_owner();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function app.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function app.set_updated_at();

drop trigger if exists workspace_members_set_updated_at on public.workspace_members;
create trigger workspace_members_set_updated_at before update on public.workspace_members
for each row execute function app.set_updated_at();

drop trigger if exists workspace_invitations_set_updated_at on public.workspace_invitations;
create trigger workspace_invitations_set_updated_at before update on public.workspace_invitations
for each row execute function app.set_updated_at();
