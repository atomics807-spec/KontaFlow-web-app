-- =============================================================================
-- KontaFlow · 0030 — natural-language AI bookkeeping
-- AI drafts are reviewed before posting. Confirmation is one database
-- transaction so a multi-entry message either posts completely or not at all.
-- =============================================================================

-- ---------------------------- auto-post settings ---------------------------
alter table public.business_settings
  add column if not exists ai_auto_post boolean not null default false,
  add column if not exists ai_auto_post_max_minor bigint not null default 5000;

alter table public.business_settings
  drop constraint if exists business_settings_ai_auto_post_max_check;
alter table public.business_settings
  add constraint business_settings_ai_auto_post_max_check
  check (ai_auto_post_max_minor > 0 and ai_auto_post_max_minor <= 1000000000000);

-- Food and Water are common everyday expenses. Add them to existing
-- workspaces and to every workspace created from now on.
insert into public.categories (workspace_id, name, kind, color, is_system, translations)
select w.id, 'Food', 'expense', '#F97316', true, '{"fr":"Nourriture","pcm":"Food"}'::jsonb
from public.workspaces w
on conflict do nothing;
insert into public.categories (workspace_id, name, kind, color, is_system, translations)
select w.id, 'Water', 'expense', '#0EA5E9', true, '{"fr":"Eau","pcm":"Water"}'::jsonb
from public.workspaces w
on conflict do nothing;

create or replace function app.seed_ai_categories()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.categories (workspace_id, name, kind, color, is_system, translations)
  values
    (new.id, 'Food', 'expense', '#F97316', true, '{"fr":"Nourriture","pcm":"Food"}'::jsonb),
    (new.id, 'Water', 'expense', '#0EA5E9', true, '{"fr":"Eau","pcm":"Water"}'::jsonb)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists workspaces_seed_ai_categories on public.workspaces;
create trigger workspaces_seed_ai_categories
after insert on public.workspaces
for each row execute function app.seed_ai_categories();

-- ----------------------------- AI command drafts ---------------------------
create table if not exists public.ai_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid,
  message_id uuid references public.ai_messages (id) on delete set null,
  request_id text not null check (char_length(request_id) between 8 and 120),
  command_text text not null check (char_length(command_text) between 1 and 4000),
  reply text not null default '',
  locale text not null default 'en' check (locale in ('en', 'fr', 'pcm')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'dismissed', 'reversed', 'failed')),
  auto_posted boolean not null default false,
  interpretation jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  reversed_at timestamptz,
  reversed_by uuid references public.profiles (id) on delete set null,
  undo_expires_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  constraint ai_commands_conversation_fk foreign key (workspace_id, conversation_id)
    references public.ai_conversations (workspace_id, id) on delete cascade,
  constraint ai_commands_request_key unique (workspace_id, request_id)
);
create index if not exists ai_commands_workspace_created_idx
  on public.ai_commands (workspace_id, created_at desc);
create index if not exists ai_commands_user_created_idx
  on public.ai_commands (user_id, created_at desc);
create index if not exists ai_commands_pending_idx
  on public.ai_commands (workspace_id, status, created_at desc)
  where status = 'pending';

drop trigger if exists ai_commands_set_updated_at on public.ai_commands;
create trigger ai_commands_set_updated_at before update on public.ai_commands
for each row execute function app.set_updated_at();

alter table public.ai_commands enable row level security;

drop policy if exists ai_commands_select_own on public.ai_commands;
create policy ai_commands_select_own on public.ai_commands
  for select to authenticated
  using (user_id = auth.uid() and app.is_workspace_member(workspace_id));

drop policy if exists ai_commands_insert_own on public.ai_commands;
create policy ai_commands_insert_own on public.ai_commands
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and app.is_workspace_member(workspace_id)
    and app.can_write_finance(workspace_id)
  );

grant select, insert on table public.ai_commands to authenticated;
revoke all on table public.ai_commands from anon;

-- --------------------------- confirmation / undo ---------------------------
create or replace function public.confirm_ai_command(
  p_command_id uuid,
  p_auto_posted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_cmd public.ai_commands;
  v_actions jsonb;
  v_action jsonb;
  v_index integer := 0;
  v_result jsonb;
  v_created jsonb;
  v_tx_ids jsonb := '[]'::jsonb;
  v_debt_ids jsonb := '[]'::jsonb;
  v_payment_ids jsonb := '[]'::jsonb;
  v_currency char(3);
  v_id uuid;
  v_amount bigint;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_cmd from public.ai_commands where id = p_command_id for update;
  if not found then
    raise exception 'AI command not found' using errcode = 'no_data_found';
  end if;
  if not app.can_write_finance(v_cmd.workspace_id) then
    raise exception 'Not allowed to post this AI command' using errcode = 'insufficient_privilege';
  end if;
  if v_cmd.user_id <> v_uid then
    raise exception 'Only the person who created this AI draft can confirm it'
      using errcode = 'insufficient_privilege';
  end if;

  if v_cmd.status = 'confirmed' then
    return coalesce(v_cmd.result, '{}'::jsonb)
      || jsonb_build_object('command_id', v_cmd.id, 'status', 'confirmed', 'already_confirmed', true);
  end if;
  if v_cmd.status <> 'pending' then
    raise exception 'Only a pending AI command can be confirmed' using errcode = 'check_violation';
  end if;
  if v_cmd.expires_at < now() then
    update public.ai_commands
       set status = 'failed', error = 'expired'
     where id = v_cmd.id;
    raise exception 'This AI draft has expired' using errcode = 'check_violation';
  end if;

  v_actions := coalesce(v_cmd.preview -> 'actions', '[]'::jsonb);
  if jsonb_typeof(v_actions) <> 'array' or jsonb_array_length(v_actions) = 0 then
    raise exception 'The AI draft has no actions' using errcode = 'check_violation';
  end if;

  select currency into v_currency from public.workspaces where id = v_cmd.workspace_id;

  for v_action in select value from jsonb_array_elements(v_actions)
  loop
    v_index := v_index + 1;

    if v_action ->> 'type' = 'transaction' then
      v_created := public.record_transaction(jsonb_build_object(
        'workspace_id', v_cmd.workspace_id,
        'kind', v_action ->> 'kind',
        'amount_minor', v_action ->> 'amountMinor',
        'description', v_action ->> 'description',
        'category_id', nullif(v_action ->> 'categoryId', ''),
        'account_id', nullif(v_action ->> 'accountId', ''),
        'counter_account_id', nullif(v_action ->> 'counterAccountId', ''),
        'contact_id', nullif(v_action ->> 'contactId', ''),
        'payment_method', nullif(v_action ->> 'paymentMethod', ''),
        'occurred_on', nullif(v_action ->> 'occurredOn', ''),
        'client_generated_id', 'ai:' || v_cmd.id::text || ':' || v_index::text,
        'channel', 'ai',
        'currency', v_currency
      ));
      v_tx_ids := v_tx_ids || to_jsonb(v_created ->> 'id');
    elsif v_action ->> 'type' = 'debt' then
      if not app.can_manage_records(v_cmd.workspace_id) then
        raise exception 'Not allowed to create debts from AI in this workspace'
          using errcode = 'insufficient_privilege';
      end if;
      if (v_action ->> 'amountMinor') is null
         or (v_action ->> 'amountMinor') !~ '^[0-9]+$' then
        raise exception 'Debt amount is invalid' using errcode = 'check_violation';
      end if;
      v_amount := (v_action ->> 'amountMinor')::bigint;
      if v_amount <= 0 then
        raise exception 'Debt amount must be greater than zero' using errcode = 'check_violation';
      end if;
      if not exists (
        select 1 from public.contacts
        where id = (v_action ->> 'contactId')::uuid
          and workspace_id = v_cmd.workspace_id
          and not is_archived
      ) then
        raise exception 'Debt contact not found in this workspace' using errcode = 'check_violation';
      end if;

      insert into public.debts (
        workspace_id, direction, contact_id, description, principal_minor,
        currency, opened_on, due_on, notes, created_by
      )
      values (
        v_cmd.workspace_id,
        (v_action ->> 'direction')::public.debt_direction,
        (v_action ->> 'contactId')::uuid,
        v_action ->> 'description',
        v_amount,
        v_currency,
        (v_action ->> 'openedOn')::date,
        nullif(v_action ->> 'dueOn', '')::date,
        nullif(v_action ->> 'notes', ''),
        v_uid
      )
      returning id into v_id;
      v_debt_ids := v_debt_ids || to_jsonb(v_id);
    elsif v_action ->> 'type' = 'debt_payment' then
      if not app.can_manage_records(v_cmd.workspace_id) then
        raise exception 'Not allowed to record debt payments from AI in this workspace'
          using errcode = 'insufficient_privilege';
      end if;
      v_created := public.record_debt_payment(jsonb_build_object(
        'debt_id', v_action ->> 'debtId',
        'amount_minor', v_action ->> 'amountMinor',
        'paid_on', nullif(v_action ->> 'paidOn', ''),
        'account_id', nullif(v_action ->> 'accountId', ''),
        'payment_method', nullif(v_action ->> 'paymentMethod', ''),
        'reference', 'AI command ' || v_cmd.id::text
      ));
      v_payment_ids := v_payment_ids || to_jsonb(v_created ->> 'id');
      if v_created ->> 'transaction_id' is not null then
        v_tx_ids := v_tx_ids || to_jsonb(v_created ->> 'transaction_id');
      end if;
    else
      raise exception 'Unsupported AI action type %', v_action ->> 'type'
        using errcode = 'check_violation';
    end if;
  end loop;

  v_result := jsonb_build_object(
    'command_id', v_cmd.id,
    'transactions', v_tx_ids,
    'debts', v_debt_ids,
    'payments', v_payment_ids
  );

  update public.ai_commands
     set status = 'confirmed',
         auto_posted = p_auto_posted,
         result = v_result,
         confirmed_at = now(),
         confirmed_by = v_uid,
         undo_expires_at = now() + interval '24 hours',
         error = null
   where id = v_cmd.id;

  perform app.write_audit(
    v_cmd.workspace_id,
    'ai.command_confirmed',
    'ai_command',
    v_cmd.id,
    jsonb_build_object(
      'actions', jsonb_array_length(v_actions),
      'auto_posted', p_auto_posted,
      'transactions', v_tx_ids,
      'debts', v_debt_ids,
      'payments', v_payment_ids
    ),
    jsonb_build_object('status', v_cmd.status)
  );

  return v_result || jsonb_build_object('status', 'confirmed');
end;
$$;

create or replace function public.dismiss_ai_command(p_command_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_cmd public.ai_commands;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_cmd from public.ai_commands where id = p_command_id for update;
  if not found then
    raise exception 'AI command not found' using errcode = 'no_data_found';
  end if;
  if not app.is_workspace_member(v_cmd.workspace_id) then
    raise exception 'Not allowed to dismiss this AI command' using errcode = 'insufficient_privilege';
  end if;
  if v_cmd.user_id <> v_uid then
    raise exception 'Only the person who created this AI draft can dismiss it'
      using errcode = 'insufficient_privilege';
  end if;

  if v_cmd.status = 'dismissed' then
    return jsonb_build_object('command_id', v_cmd.id, 'status', 'dismissed', 'already_dismissed', true);
  end if;
  if v_cmd.status <> 'pending' then
    raise exception 'Only a pending AI command can be dismissed' using errcode = 'check_violation';
  end if;

  update public.ai_commands
     set status = 'dismissed', error = null
   where id = v_cmd.id;

  perform app.write_audit(
    v_cmd.workspace_id,
    'ai.command_dismissed',
    'ai_command',
    v_cmd.id,
    jsonb_build_object('status', 'dismissed'),
    jsonb_build_object('status', v_cmd.status)
  );

  return jsonb_build_object('command_id', v_cmd.id, 'status', 'dismissed');
end;
$$;

create or replace function public.undo_ai_command(
  p_command_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_cmd public.ai_commands;
  v_tx_id uuid;
  v_reversal jsonb;
  v_reversals jsonb := '[]'::jsonb;
  v_actions jsonb;
  v_action jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_cmd from public.ai_commands where id = p_command_id for update;
  if not found then
    raise exception 'AI command not found' using errcode = 'no_data_found';
  end if;
  if not app.can_write_finance(v_cmd.workspace_id) then
    raise exception 'Not allowed to undo this AI command' using errcode = 'insufficient_privilege';
  end if;
  if v_cmd.user_id <> v_uid then
    raise exception 'Only the person who created this AI command can undo it'
      using errcode = 'insufficient_privilege';
  end if;

  if v_cmd.status = 'reversed' then
    return jsonb_build_object('command_id', v_cmd.id, 'status', 'reversed', 'already_reversed', true);
  end if;
  if v_cmd.status <> 'confirmed' then
    raise exception 'Only a posted AI command can be undone' using errcode = 'check_violation';
  end if;
  if v_cmd.undo_expires_at is not null and v_cmd.undo_expires_at < now() then
    raise exception 'The undo window for this AI command has ended' using errcode = 'check_violation';
  end if;

  v_actions := coalesce(v_cmd.preview -> 'actions', '[]'::jsonb);
  if exists (
    select 1 from jsonb_array_elements(v_actions) a
    where a ->> 'type' <> 'transaction'
  ) then
    raise exception 'Debt changes cannot be undone from the assistant. Adjust them from the Debts page.'
      using errcode = 'check_violation';
  end if;

  for v_tx_id in
    select value::uuid
    from jsonb_array_elements_text(coalesce(v_cmd.result -> 'transactions', '[]'::jsonb))
  loop
    v_reversal := public.reverse_transaction(
      v_tx_id,
      coalesce(nullif(trim(p_reason), ''), 'Undo AI command ' || v_cmd.id::text)
    );
    v_reversals := v_reversals || jsonb_build_object(
      'original', v_tx_id,
      'reversal', v_reversal ->> 'id'
    );
  end loop;

  update public.ai_commands
     set status = 'reversed',
         reversed_at = now(),
         reversed_by = v_uid,
         result = coalesce(result, '{}'::jsonb) || jsonb_build_object('reversals', v_reversals)
   where id = v_cmd.id;

  perform app.write_audit(
    v_cmd.workspace_id,
    'ai.command_reversed',
    'ai_command',
    v_cmd.id,
    jsonb_build_object('reversals', v_reversals, 'reason', nullif(trim(p_reason), '')),
    jsonb_build_object('status', v_cmd.status)
  );

  return jsonb_build_object(
    'command_id', v_cmd.id,
    'status', 'reversed',
    'reversals', v_reversals
  );
end;
$$;


create or replace function public.set_ai_command_reply(
  p_command_id uuid,
  p_reply text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_cmd public.ai_commands;
  v_reply text := left(coalesce(p_reply, ''), 8000);
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_cmd from public.ai_commands where id = p_command_id for update;
  if not found then
    raise exception 'AI command not found' using errcode = 'no_data_found';
  end if;
  if v_cmd.user_id <> v_uid then
    raise exception 'Only the person who created this AI draft can update it'
      using errcode = 'insufficient_privilege';
  end if;
  if v_cmd.status not in ('pending', 'confirmed') then
    raise exception 'This AI command can no longer be updated' using errcode = 'check_violation';
  end if;

  update public.ai_commands set reply = v_reply where id = v_cmd.id;
  return jsonb_build_object('command_id', v_cmd.id, 'status', v_cmd.status);
end;
$$;

revoke all on function public.set_ai_command_reply(uuid, text) from public, anon;
grant execute on function public.set_ai_command_reply(uuid, text) to authenticated, service_role;

revoke all on function public.confirm_ai_command(uuid, boolean) from public, anon;
revoke all on function public.dismiss_ai_command(uuid) from public, anon;
revoke all on function public.undo_ai_command(uuid, text) from public, anon;
grant execute on function public.confirm_ai_command(uuid, boolean) to authenticated, service_role;
grant execute on function public.dismiss_ai_command(uuid) to authenticated, service_role;
grant execute on function public.undo_ai_command(uuid, text) to authenticated, service_role;
