-- ===========================================================================
-- TogetherWealth — 00003_storage.sql
-- Private "documents" bucket + object policies.
--
-- Path convention (enforced by the policies below):
--   {workspace_id}/{owner_id}/{filename}
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- Safe uuid cast: storage policies run against every objects row, so a
-- malformed first path segment must yield null (=> not a member) instead of
-- aborting the whole query.
create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

-- Owners write only inside their own {workspace_id}/{owner_id}/ folder,
-- and only for workspaces they belong to.
create policy "documents_objects_insert_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.is_workspace_member(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "documents_objects_update_owner" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.is_workspace_member(public.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.is_workspace_member(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "documents_objects_delete_owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.is_workspace_member(public.try_uuid((storage.foldername(name))[1]))
  );

-- Read: workspace members see their own files, plus any file whose documents
-- metadata row is not private. A partner's private file never resolves.
create policy "documents_objects_select_visible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member(public.try_uuid((storage.foldername(name))[1]))
    and (
      auth.uid()::text = (storage.foldername(name))[2]
      or exists (
        select 1 from public.documents d
        where d.storage_path = name
          and d.visibility <> 'private'
      )
    )
  );
