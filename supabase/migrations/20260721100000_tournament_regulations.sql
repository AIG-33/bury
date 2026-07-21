-- ============================================================
-- Tournament regulations: optional free-form text + attached file.
--
-- Organizers can describe the tournament rules ("регламент") as long text
-- and/or attach a document (PDF/DOC/DOCX). Both are optional and shown in a
-- dedicated section on the public tournament page (web + mobile) and on the
-- organizer's tournament page.
--
-- Storage decision:
--   The file goes to a NEW public bucket `tournament-files` with per-USER
--   folders (`<user_id>/...`, avatars-bucket pattern) rather than per-
--   tournament folders (tournament-branding pattern): the file is uploaded
--   from the create dialog BEFORE the tournament row exists, so an ownership
--   check against public.tournaments can't work there. Only the URL is
--   stored on the tournament row.
--
-- RLS: no new table — both columns ride on public.tournaments (existing
-- tournaments_read / tournaments_owner_write policies). Storage policies for
-- the new bucket are below. Forward-only per AGENTS.md §3.9.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Regulations columns on tournaments.
-- ------------------------------------------------------------

alter table public.tournaments
  add column if not exists regulations_text text;

alter table public.tournaments
  add column if not exists regulations_file_url text;

comment on column public.tournaments.regulations_text is
  'Optional free-form tournament regulations ("регламент"), shown with '
  'preserved line breaks in a dedicated section on the public tournament '
  'page. Independent from description.';

comment on column public.tournaments.regulations_file_url is
  'Optional public URL of the attached regulations document (PDF/DOC/DOCX) '
  'in the tournament-files storage bucket. Rendered as a download link on '
  'the public tournament page.';

-- ------------------------------------------------------------
-- 2) Storage bucket for tournament documents.
--    Public read (backs a public page); authenticated users may write only
--    under their own `<user_id>/...` folder (same footgun-free pattern as
--    the avatars bucket: qualify nothing — `name` here is storage.objects').
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tournament-files',
  'tournament-files',
  true,
  10 * 1024 * 1024, -- 10 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tournament_files_public_read" on storage.objects;
create policy "tournament_files_public_read"
  on storage.objects for select
  using (bucket_id = 'tournament-files');

drop policy if exists "tournament_files_user_insert_own" on storage.objects;
create policy "tournament_files_user_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'tournament-files'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "tournament_files_user_update_own" on storage.objects;
create policy "tournament_files_user_update_own"
  on storage.objects for update
  using (
    bucket_id = 'tournament-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'tournament-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "tournament_files_user_delete_own" on storage.objects;
create policy "tournament_files_user_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'tournament-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
