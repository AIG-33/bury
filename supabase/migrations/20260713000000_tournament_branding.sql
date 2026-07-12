-- ============================================================
-- Tournament "room" branding.
--
-- Product shape:
--   Organizers can brand the public tournament page (/tournaments/[id]):
--   upload a logo and a full-width banner, set background / accent colors,
--   pick a theme preset, add a tagline and a sponsor strip, etc.
--
-- Storage decision:
--   All of it lives in ONE JSONB column `tournaments.branding`, validated by
--   TournamentBrandingSchema (lib/validators/tournament-branding.ts). Rationale:
--     * branding is a cohesive blob that is always read/written as a unit by
--       the organizer's editor — a dedicated table would add a 1:1 join for no
--       benefit;
--     * it mirrors the existing per-club pattern (clubs.page_blocks jsonb) and
--       keeps AGENTS.md §7 satisfied (JSONB column ⇒ Zod schema in lib/validators).
--   Uploaded assets (logo / banner / sponsor logos) are stored in a dedicated
--   `tournament-branding` storage bucket; the JSONB keeps only their public URLs.
--
-- RLS:
--   No NEW table is introduced, so no new table RLS is required. `branding`
--   rides on `public.tournaments`, whose existing policies already enforce:
--     * READ  → tournaments_read (public OR owner OR participant OR admin),
--     * WRITE → tournaments_owner_write (owner_id = auth.uid() OR is_admin()).
--   Storage policies below restrict writes to the tournament's owner / admins
--   and allow public read (the bucket backs a public page).
--
-- Forward-only per AGENTS.md §3.9 — additive only, no destructive edits.
-- ============================================================

-- ------------------------------------------------------------
-- 1) branding JSONB column on tournaments.
-- ------------------------------------------------------------

alter table public.tournaments
  add column if not exists branding jsonb not null default '{}'::jsonb;

-- Guard: branding must be a JSON object (never an array/scalar). The full
-- shape is validated in the app by TournamentBrandingSchema.
alter table public.tournaments
  drop constraint if exists tournaments_branding_is_object;
alter table public.tournaments
  add constraint tournaments_branding_is_object
  check (jsonb_typeof(branding) = 'object');

comment on column public.tournaments.branding is
  'Public tournament-page branding (logo, banner, colors, theme preset, '
  'tagline, sponsors, …). Validated by TournamentBrandingSchema in '
  'lib/validators/tournament-branding.ts. Image URLs point at the '
  'tournament-branding storage bucket.';

-- ------------------------------------------------------------
-- 2) Storage bucket for tournament branding assets.
--    Public read (backs a public page); only the tournament owner / admins
--    may write under `<tournament_id>/...`.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tournament-branding',
  'tournament-branding',
  true,
  5 * 1024 * 1024, -- 5 MB (banners are larger than avatars)
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tournament_branding_public_read" on storage.objects;
create policy "tournament_branding_public_read"
  on storage.objects for select
  using (bucket_id = 'tournament-branding');

-- IMPORTANT: qualify `name` with `storage.objects.name` (same footgun as the
-- club-logos policy) so the folder check compares the tournament id to the
-- file's top-level folder, not to some column of `tournaments`.
drop policy if exists "tournament_branding_owner_insert" on storage.objects;
create policy "tournament_branding_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'tournament-branding'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.tournaments t
       where t.id::text = (storage.foldername(storage.objects.name))[1]
         and (t.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "tournament_branding_owner_update" on storage.objects;
create policy "tournament_branding_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'tournament-branding'
    and exists (
      select 1 from public.tournaments t
       where t.id::text = (storage.foldername(storage.objects.name))[1]
         and (t.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    bucket_id = 'tournament-branding'
    and exists (
      select 1 from public.tournaments t
       where t.id::text = (storage.foldername(storage.objects.name))[1]
         and (t.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "tournament_branding_owner_delete" on storage.objects;
create policy "tournament_branding_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'tournament-branding'
    and exists (
      select 1 from public.tournaments t
       where t.id::text = (storage.foldername(storage.objects.name))[1]
         and (t.owner_id = auth.uid() or public.is_admin())
    )
  );
