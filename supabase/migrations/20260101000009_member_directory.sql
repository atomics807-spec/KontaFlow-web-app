-- =============================================================================
-- KontaFlow · 0009 — member directory
-- =============================================================================
-- profiles are readable only by their owner, so the team screen needs a
-- controlled projection that a workspace member may call.
-- =============================================================================

create or replace function public.get_workspace_members(p_workspace_id uuid)
returns table (
  id uuid,
  user_id uuid,
  role public.workspace_role,
  status public.member_status,
  joined_at timestamptz,
  full_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_workspace_member(p_workspace_id) then
    raise exception 'Not a member of this workspace' using errcode = 'insufficient_privilege';
  end if;

  return query
    select m.id,
           m.user_id,
           m.role,
           m.status,
           m.joined_at,
           coalesce(nullif(trim(p.full_name), ''), split_part(coalesce(u.email, ''), '@', 1)),
           coalesce(u.email, '')
    from public.workspace_members m
    join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
end;
$$;

revoke all on function public.get_workspace_members(uuid) from public, anon;
grant execute on function public.get_workspace_members(uuid) to authenticated, service_role;
