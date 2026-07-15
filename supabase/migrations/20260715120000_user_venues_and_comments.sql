-- ============================================================
-- User-created venues + venue comments.
--
-- Product shape:
--   * Any authenticated user can add a venue (площадка) with its courts —
--     the directory is no longer admin-only. Admin-seeded venues keep
--     created_by = NULL and stay admin-editable only.
--   * The creator can edit their own venue and manage its courts; admins
--     can still edit everything (existing venues_admin_write policy).
--   * New venues publish immediately (no moderation queue) — they show up
--     in the /venues catalog like the seeded ones.
--   * Anyone authenticated can leave a comment on a venue («заметили
--     неточность — напишите»). The author can delete their own comment;
--     admins moderate. Authored comments are deleted on account purge
--     (same approach as coach_reviews), hence ON DELETE CASCADE.
--
-- Forward-only per AGENTS.md §3.9 — additive only.
-- ============================================================

-- ------------------------------------------------------------
-- 1) venues.created_by + contact fields.
-- ------------------------------------------------------------

alter table public.venues
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.venues
  add column if not exists website text;

alter table public.venues
  add column if not exists phone text;

create index if not exists venues_created_by_idx
  on public.venues (created_by)
  where created_by is not null;

comment on column public.venues.created_by is
  'Profile that added this venue via the public «Добавить площадку» flow. '
  'NULL for admin-seeded directory entries. The creator may edit their venue '
  '(venues_creator_update policy).';

-- ------------------------------------------------------------
-- 2) RLS: authenticated users insert venues they own; creators update
--    their own. Admin keeps full CRUD via the existing venues_admin_write.
--    Deletion stays admin-only (venues can be referenced by tournaments,
--    open matches and slots).
-- ------------------------------------------------------------

drop policy if exists venues_user_insert on public.venues;
create policy venues_user_insert on public.venues
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists venues_creator_update on public.venues;
create policy venues_creator_update on public.venues
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Courts of a creator-owned venue: full CRUD for the creator.
drop policy if exists courts_creator_write on public.courts;
create policy courts_creator_write on public.courts
  for all to authenticated
  using (
    exists (
      select 1 from public.venues v
       where v.id = courts.venue_id and v.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.venues v
       where v.id = courts.venue_id and v.created_by = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3) venue_comments.
-- ------------------------------------------------------------

create table if not exists public.venue_comments (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 3 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.venue_comments is
  'User feedback on venue pages («заметили неточность — напишите»). '
  'Authored comments are removed on account deletion (CASCADE + explicit '
  'purge step in lib/account/actions.ts, mirroring coach_reviews).';

create index if not exists venue_comments_venue_idx
  on public.venue_comments (venue_id, created_at desc);

create index if not exists venue_comments_author_idx
  on public.venue_comments (author_id);

drop trigger if exists trg_venue_comments_updated on public.venue_comments;
create trigger trg_venue_comments_updated
  before update on public.venue_comments
  for each row execute function public.set_updated_at();

alter table public.venue_comments enable row level security;

drop policy if exists venue_comments_read on public.venue_comments;
create policy venue_comments_read on public.venue_comments
  for select using (true);

drop policy if exists venue_comments_insert_own on public.venue_comments;
create policy venue_comments_insert_own on public.venue_comments
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists venue_comments_delete_own on public.venue_comments;
create policy venue_comments_delete_own on public.venue_comments
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

drop policy if exists venue_comments_admin_all on public.venue_comments;
create policy venue_comments_admin_all on public.venue_comments
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 4) Storage bucket for venue photos. Files live under
--    <user_id>/... (per-user folders like `avatars`) because the venue
--    row does not exist yet when the creator uploads the photo.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-photos',
  'venue-photos',
  true,
  5 * 1024 * 1024, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "venue_photos_public_read" on storage.objects;
create policy "venue_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'venue-photos');

drop policy if exists "venue_photos_user_insert_own" on storage.objects;
create policy "venue_photos_user_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'venue-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

drop policy if exists "venue_photos_user_update_own" on storage.objects;
create policy "venue_photos_user_update_own"
  on storage.objects for update
  using (
    bucket_id = 'venue-photos'
    and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'venue-photos'
    and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

drop policy if exists "venue_photos_user_delete_own" on storage.objects;
create policy "venue_photos_user_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'venue-photos'
    and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );
