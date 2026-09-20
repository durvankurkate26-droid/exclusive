-- ===========================================================================
-- EXCLUSIVE — 0004 storage
--
-- Two buckets, both PRIVATE. Vault holds a friend group's photographs; a public
-- bucket would mean anyone who ever sees one URL can keep reading it forever, and
-- object paths are guessable enough that "private by obscurity" is not private.
-- Reads go through short-lived signed URLs minted server-side after a membership
-- check.
--
-- Path conventions, which the policies below depend on:
--   avatars       <user_id>/<filename>
--   vault-media   <group_id>/<capsule_id>/<filename>
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vault-media',
  'vault-media',
  false,
  26214400, -- 25 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------- avatars
-- First path segment must be the uploader's own user id, so nobody can overwrite
-- somebody else's avatar by crafting a path.

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.group_members gm
        where gm.user_id::text = (storage.foldername(name))[1]
          and gm.group_id in (select public.my_group_ids())
      )
    )
  );

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- vault media
-- First path segment is the group id, checked against real membership. Typing
-- another group's uuid into an upload path fails the WITH CHECK.

drop policy if exists vault_read on storage.objects;
create policy vault_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vault-media'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists vault_write on storage.objects;
create policy vault_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vault-media'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists vault_update on storage.objects;
create policy vault_update on storage.objects
  for update to authenticated
  using (bucket_id = 'vault-media' and public.is_group_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'vault-media' and public.is_group_member(((storage.foldername(name))[1])::uuid));

drop policy if exists vault_delete on storage.objects;
create policy vault_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vault-media'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
    and owner = auth.uid()
  );
