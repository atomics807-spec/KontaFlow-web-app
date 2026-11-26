-- =============================================================================
-- KontaFlow · 0033 — enforce AI history retention and honest purge semantics
-- Retention hides old conversations, messages and interactions immediately.
-- The purge button removes every stored AI conversation for the workspace while
-- keeping financial drafts and their audit trail.
-- =============================================================================

create or replace function app.ai_retention_cutoff(p_workspace_id uuid)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select now() - make_interval(days => coalesce((
    select history_retention_days
    from public.ai_workspace_preferences
    where workspace_id = p_workspace_id
  ), 90));
$$;

revoke all on function app.ai_retention_cutoff(uuid) from public, anon;
grant execute on function app.ai_retention_cutoff(uuid) to authenticated;

drop policy if exists ai_conversations_select_own on public.ai_conversations;
create policy ai_conversations_select_own on public.ai_conversations
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and app.is_workspace_member(workspace_id)
    and updated_at >= app.ai_retention_cutoff(workspace_id)
  );

drop policy if exists ai_conversations_update_own on public.ai_conversations;
create policy ai_conversations_update_own on public.ai_conversations
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and updated_at >= app.ai_retention_cutoff(workspace_id)
  )
  with check (user_id = (select auth.uid()));

drop policy if exists ai_messages_select_own on public.ai_messages;
create policy ai_messages_select_own on public.ai_messages
  for select to authenticated
  using (
    created_at >= app.ai_retention_cutoff(workspace_id)
    and exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists ai_interactions_select_own on public.ai_interactions;
create policy ai_interactions_select_own on public.ai_interactions
  for select to authenticated
  using (
    created_at >= app.ai_retention_cutoff(workspace_id)
    and user_id = (select auth.uid())
    and app.is_workspace_member(workspace_id)
  );

drop function if exists public.purge_ai_history(uuid, integer);

create or replace function public.purge_ai_history(
  p_workspace_id uuid,
  p_older_than_days integer default null,
  p_delete_all boolean default false
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

  if p_delete_all then
    v_days := 0;
    v_cutoff := 'infinity'::timestamptz;
  else
    select coalesce(p_older_than_days, history_retention_days)
      into v_days
    from public.ai_workspace_preferences
    where workspace_id = p_workspace_id;
    v_days := coalesce(v_days, 90);
    if v_days not between 7 and 730 then
      raise exception 'Retention must be between 7 and 730 days' using errcode = 'check_violation';
    end if;
    v_cutoff := now() - make_interval(days => v_days);
  end if;

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
      'delete_all', p_delete_all,
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

revoke all on function public.purge_ai_history(uuid, integer, boolean) from public, anon;
grant execute on function public.purge_ai_history(uuid, integer, boolean) to authenticated;
