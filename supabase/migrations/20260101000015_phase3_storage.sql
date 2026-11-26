-- =============================================================================
-- KontaFlow · 0015 — private storage buckets and tenant-scoped object policies
-- =============================================================================
-- Object paths are the tenant boundary:
--   workspace buckets: <workspace_id>/<...>
--   profile images:    <user_id>/<...>
-- All buckets are private; the app serves short-lived signed URLs. Nothing in
-- this file makes a bucket public.
-- =============================================================================

-- Storage object names are user-controlled. Parse the workspace folder
-- defensively so a malformed path fails closed instead of raising during RLS.
create or replace function app.uuid_or_null(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if p_value is null or p_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return p_value::uuid;
end;
$$;

revoke all on function app.uuid_or_null(text) from public, anon;
grant execute on function app.uuid_or_null(text) to authenticated, service_role;

do $$
declare
  bucket record;
  v_policy text;
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    return;
  end if;

  for bucket in
    select * from (values
      ('kontaflow-business-documents', 'app.can_write_finance', 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
      ('kontaflow-receipts', 'app.can_write_finance', 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
      ('kontaflow-invoices', 'app.can_write_finance', 10485760,
        array['application/pdf', 'image/jpeg', 'image/png']),
      ('kontaflow-report-exports', 'app.can_write_finance', 20971520,
        array['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
      ('kontaflow-workspace-logos', 'app.can_manage_workspace', 2097152,
        array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
    ) as t(bucket_name, write_fn, max_size, mimes)
  loop
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (bucket.bucket_name, bucket.bucket_name, false, bucket.max_size, bucket.mimes)
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    v_policy := bucket.bucket_name || '_read';
    execute format('drop policy if exists %I on storage.objects', v_policy);
    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and app.is_workspace_member(app.uuid_or_null((storage.foldername(name))[1])))',
      v_policy, bucket.bucket_name
    );

    v_policy := bucket.bucket_name || '_insert';
    execute format('drop policy if exists %I on storage.objects', v_policy);
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L and %s(app.uuid_or_null((storage.foldername(name))[1])))',
      v_policy, bucket.bucket_name, bucket.write_fn
    );

    v_policy := bucket.bucket_name || '_update';
    execute format('drop policy if exists %I on storage.objects', v_policy);
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L and %s(app.uuid_or_null((storage.foldername(name))[1])))
         with check (bucket_id = %L and %s(app.uuid_or_null((storage.foldername(name))[1])))',
      v_policy, bucket.bucket_name, bucket.write_fn, bucket.bucket_name, bucket.write_fn
    );

    v_policy := bucket.bucket_name || '_delete';
    execute format('drop policy if exists %I on storage.objects', v_policy);
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (
           bucket_id = %L
           and (
             owner = (select auth.uid())
             or app.can_manage_records(app.uuid_or_null((storage.foldername(name))[1]))
           )
         )',
      v_policy, bucket.bucket_name
    );
  end loop;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'kontaflow-profile-images',
    'kontaflow-profile-images',
    false,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists kontaflow_profile_images_read on storage.objects;
  create policy kontaflow_profile_images_read on storage.objects
    for select to authenticated
    using (
      bucket_id = 'kontaflow-profile-images'
      and app.uuid_or_null((storage.foldername(name))[1]) = (select auth.uid())
    );

  drop policy if exists kontaflow_profile_images_write on storage.objects;
  create policy kontaflow_profile_images_write on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'kontaflow-profile-images'
      and app.uuid_or_null((storage.foldername(name))[1]) = (select auth.uid())
    );

  drop policy if exists kontaflow_profile_images_update on storage.objects;
  create policy kontaflow_profile_images_update on storage.objects
    for update to authenticated
    using (
      bucket_id = 'kontaflow-profile-images'
      and app.uuid_or_null((storage.foldername(name))[1]) = (select auth.uid())
    )
    with check (
      bucket_id = 'kontaflow-profile-images'
      and app.uuid_or_null((storage.foldername(name))[1]) = (select auth.uid())
    );

  drop policy if exists kontaflow_profile_images_delete on storage.objects;
  create policy kontaflow_profile_images_delete on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'kontaflow-profile-images'
      and app.uuid_or_null((storage.foldername(name))[1]) = (select auth.uid())
    );
end $$;
