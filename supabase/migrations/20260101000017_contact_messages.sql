-- =============================================================================
-- KontaFlow · 0017 — contact messages
-- =============================================================================
-- The public contact form is the only unauthenticated write surface. Rows are
-- written by the server with the service-role client and read only by trusted
-- operations: RLS is enabled with no authenticated policy.
-- =============================================================================

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (position('@' in email) > 1 and char_length(email) <= 160),
  company text check (company is null or char_length(company) <= 120),
  topic text not null default 'sales'
    check (topic in ('sales', 'support', 'partnership', 'press', 'other')),
  message text not null check (char_length(trim(message)) between 10 and 4000),
  locale text not null default 'en' check (locale in ('en', 'fr', 'wes')),
  status text not null default 'new'
    check (status in ('new', 'read', 'replied', 'closed', 'spam')),
  source text not null default 'contact_page',
  handled_at timestamptz,
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.contact_messages is
  'Inbound messages from the public contact form. Service-role only; no authenticated policy.';

create index if not exists contact_messages_status_idx
  on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;

revoke all on table public.contact_messages from anon, authenticated;
grant all on table public.contact_messages to service_role;
