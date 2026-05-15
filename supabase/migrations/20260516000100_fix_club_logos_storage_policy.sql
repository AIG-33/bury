-- ============================================================
-- Fix: club-logos upload was always denied by RLS because the
-- INSERT / UPDATE policy referenced an unqualified `name`. Inside
-- the `EXISTS (SELECT 1 FROM clubs c ...)` subquery Postgres
-- resolved `name` to `c.name` (the club's display name) instead of
-- to `storage.objects.name` (the file path). The folder check then
-- compared the club id to a folder derived from the club's name,
-- which never matches → every authenticated insert raised
-- "new row violates row-level security policy".
--
-- The fix is purely cosmetic: qualify `name` explicitly with
-- `storage.objects.name` (using a separate alias would be slightly
-- cleaner, but RLS expressions can reference the outer row directly).
-- Behaviour: a user who is the club's owner or an approved co-admin
-- can write under `<club_id>/...`.
-- ============================================================

drop policy if exists "club_logos_admin_insert" on storage.objects;
create policy "club_logos_admin_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'club-logos'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.clubs c
       where c.id::text = (storage.foldername(storage.objects.name))[1]
         and public.is_club_admin(c.id)
    )
  );

drop policy if exists "club_logos_admin_update" on storage.objects;
create policy "club_logos_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'club-logos'
    and exists (
      select 1 from public.clubs c
       where c.id::text = (storage.foldername(storage.objects.name))[1]
         and public.is_club_admin(c.id)
    )
  )
  with check (
    bucket_id = 'club-logos'
    and exists (
      select 1 from public.clubs c
       where c.id::text = (storage.foldername(storage.objects.name))[1]
         and public.is_club_admin(c.id)
    )
  );

drop policy if exists "club_logos_admin_delete" on storage.objects;
create policy "club_logos_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'club-logos'
    and exists (
      select 1 from public.clubs c
       where c.id::text = (storage.foldername(storage.objects.name))[1]
         and public.is_club_admin(c.id)
    )
  );
