-- =============================================================================
-- KontaFlow · 0008 — storage bucket and object policies (Supabase only)
-- =============================================================================
-- Receipts live under `<workspace_id>/<transaction_id>/<file>`. Storage
-- policies mirror the database rules: members read, writers upload, managers
-- or the uploader delete.
-- =============================================================================

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'kontaflow-documents',
      'kontaflow-documents',
      false,
      10485760,
      array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    )
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    execute $policy$
      drop policy if exists kontaflow_documents_read on storage.objects;
      create policy kontaflow_documents_read on storage.objects
        for select to authenticated
        using (
          bucket_id = 'kontaflow-documents'
          and app.is_workspace_member(((storage.foldername(name))[1])::uuid)
        );
    $policy$;

    execute $policy$
      drop policy if exists kontaflow_documents_insert on storage.objects;
      create policy kontaflow_documents_insert on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'kontaflow-documents'
          and app.can_write_finance(((storage.foldername(name))[1])::uuid)
        );
    $policy$;

    execute $policy$
      drop policy if exists kontaflow_documents_delete on storage.objects;
      create policy kontaflow_documents_delete on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'kontaflow-documents'
          and (
            owner = (select auth.uid())
            or app.can_manage_records(((storage.foldername(name))[1])::uuid)
          )
        );
    $policy$;
  end if;
end $$;
