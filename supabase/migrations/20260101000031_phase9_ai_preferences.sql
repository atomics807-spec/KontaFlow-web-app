-- =============================================================================
-- KontaFlow · 0031 — owner-controlled AI preferences
-- The owner decides whether business data may be processed for insights, how
-- much history the advisor analyses and how long assistant conversations stay.
-- Financial records and ai_commands audit entries are never purged here.
-- =============================================================================

create table if not exists public.ai_workspace_preferences (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  insights_enabled boolean not null default true,
  analysis_window_days integer not null default 180
    check (analysis_window_days between 30 and 730),
  history_retention_days integer not null default 90
    check (history_retention_days between 7 and 730),
  advisor_focus text not null default 'balanced'
    check (advisor_focus in ('balanced', 'cash_flow', 'costs', 'growth', 'collections')),
  advisor_note text check (advisor_note is null or char_length(advisor_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ai_workspace_preferences is
  'Owner-controlled AI processing, analysis window, advisor focus and conversation retention.';

create or replace function app.create_ai_workspace_preferences()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ai_workspace_preferences (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists workspaces_create_ai_preferences on public.workspaces;
create trigger workspaces_create_ai_preferences
after insert on public.workspaces
for each row execute function app.create_ai_workspace_preferences();

insert into public.ai_workspace_preferences (workspace_id)
select id from public.workspaces
on conflict (workspace_id) do nothing;

drop trigger if exists ai_workspace_preferences_set_updated_at on public.ai_workspace_preferences;
create trigger ai_workspace_preferences_set_updated_at before update on public.ai_workspace_preferences
for each row execute function app.set_updated_at();

alter table public.ai_workspace_preferences enable row level security;

drop policy if exists ai_preferences_select_member on public.ai_workspace_preferences;
create policy ai_preferences_select_member on public.ai_workspace_preferences
  for select to authenticated
  using (app.is_workspace_member(workspace_id));

drop policy if exists ai_preferences_insert_owner on public.ai_workspace_preferences;
create policy ai_preferences_insert_owner on public.ai_workspace_preferences
  for insert to authenticated
  with check (app.is_workspace_owner(workspace_id));

drop policy if exists ai_preferences_update_owner on public.ai_workspace_preferences;
create policy ai_preferences_update_owner on public.ai_workspace_preferences
  for update to authenticated
  using (app.is_workspace_owner(workspace_id))
  with check (app.is_workspace_owner(workspace_id));

revoke all on table public.ai_workspace_preferences from public, anon;
grant select, insert, update on table public.ai_workspace_preferences to authenticated;

create or replace function public.update_ai_preferences(
  p_workspace_id uuid,
  p_insights_enabled boolean,
  p_analysis_window_days integer,
  p_history_retention_days integer,
  p_advisor_focus text,
  p_advisor_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.ai_workspace_preferences%rowtype;
  v_after public.ai_workspace_preferences%rowtype;
  v_note text := nullif(trim(coalesce(p_advisor_note, '')), '');
begin
  if auth.uid() is null or not app.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner can change AI preferences'
      using errcode = 'insufficient_privilege';
  end if;
  if p_analysis_window_days not between 30 and 730 then
    raise exception 'Analysis window must be between 30 and 730 days'
      using errcode = 'check_violation';
  end if;
  if p_history_retention_days not between 7 and 730 then
    raise exception 'History retention must be between 7 and 730 days'
      using errcode = 'check_violation';
  end if;
  if p_advisor_focus not in ('balanced', 'cash_flow', 'costs', 'growth', 'collections') then
    raise exception 'Unsupported advisor focus' using errcode = 'check_violation';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Advisor note must be 500 characters or fewer' using errcode = 'check_violation';
  end if;

  select * into v_before from public.ai_workspace_preferences where workspace_id = p_workspace_id;

  insert into public.ai_workspace_preferences (
    workspace_id, insights_enabled, analysis_window_days, history_retention_days,
    advisor_focus, advisor_note
  )
  values (
    p_workspace_id, coalesce(p_insights_enabled, true), p_analysis_window_days,
    p_history_retention_days, p_advisor_focus, v_note
  )
  on conflict (workspace_id) do update
    set insights_enabled = excluded.insights_enabled,
        analysis_window_days = excluded.analysis_window_days,
        history_retention_days = excluded.history_retention_days,
        advisor_focus = excluded.advisor_focus,
        advisor_note = excluded.advisor_note
  returning * into v_after;

  perform app.write_audit(
    p_workspace_id,
    'ai.preferences_updated',
    'ai_workspace_preferences',
    p_workspace_id,
    jsonb_build_object(
      'insights_enabled', v_after.insights_enabled,
      'analysis_window_days', v_after.analysis_window_days,
      'history_retention_days', v_after.history_retention_days,
      'advisor_focus', v_after.advisor_focus,
      'advisor_note', v_after.advisor_note
    ),
    to_jsonb(v_before)
  );

  return jsonb_build_object(
    'workspace_id', v_after.workspace_id,
    'insights_enabled', v_after.insights_enabled,
    'analysis_window_days', v_after.analysis_window_days,
    'history_retention_days', v_after.history_retention_days,
    'advisor_focus', v_after.advisor_focus,
    'advisor_note', v_after.advisor_note
  );
end;
$$;

revoke all on function public.update_ai_preferences(uuid, boolean, integer, integer, text, text) from public, anon;
grant execute on function public.update_ai_preferences(uuid, boolean, integer, integer, text, text) to authenticated;

-- Deletes old assistant conversations/interactions only. Financial records and
-- ai_commands audit entries are deliberately retained.
create or replace function public.purge_ai_history(
  p_workspace_id uuid,
  p_older_than_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer;
  v_cutoff timestamptz;
  v_messages integer := 0;
  v_interactions integer := 0;
  v_conversations integer := 0;
begin
  if auth.uid() is null or not app.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner can purge AI history'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(p_older_than_days, history_retention_days)
    into v_days
  from public.ai_workspace_preferences
  where workspace_id = p_workspace_id;
  v_days := coalesce(v_days, 90);
  if v_days not between 7 and 730 then
    raise exception 'Retention must be between 7 and 730 days' using errcode = 'check_violation';
  end if;
  v_cutoff := now() - make_interval(days => v_days);

  delete from public.ai_messages
  where workspace_id = p_workspace_id and created_at < v_cutoff;
  get diagnostics v_messages = row_count;

  delete from public.ai_interactions
  where workspace_id = p_workspace_id and created_at < v_cutoff;
  get diagnostics v_interactions = row_count;

  -- Keep financial draft audit rows; detach them before removing old
  -- conversation shells so the cascade cannot erase a confirmed command.
  update public.ai_commands
  set conversation_id = null
  where workspace_id = p_workspace_id
    and conversation_id is not null
    and not exists (
      select 1 from public.ai_conversations c
      where c.workspace_id = p_workspace_id and c.id = ai_commands.conversation_id
        and c.updated_at >= v_cutoff
    );

  delete from public.ai_conversations c
  where c.workspace_id = p_workspace_id
    and c.updated_at < v_cutoff
    and not exists (
      select 1 from public.ai_messages m
      where m.workspace_id = p_workspace_id and m.conversation_id = c.id
    );
  get diagnostics v_conversations = row_count;

  perform app.write_audit(
    p_workspace_id,
    'ai.history_purged',
    'ai_workspace_preferences',
    p_workspace_id,
    jsonb_build_object(
      'older_than_days', v_days,
      'messages', v_messages,
      'interactions', v_interactions,
      'conversations', v_conversations
    )
  );

  return jsonb_build_object(
    'older_than_days', v_days,
    'messages', v_messages,
    'interactions', v_interactions,
    'conversations', v_conversations
  );
end;
$$;

revoke all on function public.purge_ai_history(uuid, integer) from public, anon;
grant execute on function public.purge_ai_history(uuid, integer) to authenticated;
