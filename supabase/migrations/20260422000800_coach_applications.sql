-- ============================================================
-- Coach applications: a player asks to become a coach.
--
-- Why
--   Today an admin has to know "who wants to be a coach" out of
--   band (chat, e-mail, gut feeling). Players have no surface
--   inside the app to declare intent, attach documents, or see
--   the verdict. This migration adds:
--
--     * `public.coach_applications` — one row per application,
--       with status (pending / approved / rejected), the player's
--       message, an attachments JSONB array (paths in storage),
--       and an admin decision trail (decided_by / decided_at /
--       admin_comment).
--
--     * `storage.coach-applications` private bucket for the
--       attached files (diplomas, IDs, certificates). Only the
--       owning player can upload into their own folder; only the
--       service role / admins can read (we serve files via signed
--       URLs from a server action).
--
-- A player can have at most one PENDING application at a time
-- (partial unique index). After a rejection they may submit a
-- new one — the previous row stays in history.
--
-- Approving an application sets `profiles.is_coach = true` for
-- the player. We do NOT do this from a database trigger here so
-- the audit trail is explicit in the server action; admins also
-- get to write a free-form comment that's emailed/displayed back
-- to the applicant.
-- ============================================================

create table if not exists public.coach_applications (
  id              uuid        primary key default gen_random_uuid(),
  player_id       uuid        not null references public.profiles(id) on delete cascade,
  status          text        not null default 'pending'
                              check (status in ('pending', 'approved', 'rejected')),
  message         text        not null,
  attachments     jsonb       not null default '[]'::jsonb,
  -- Admin decision trail
  decided_by      uuid        references public.profiles(id) on delete set null,
  decided_at      timestamptz,
  admin_comment   text,
  -- Meta
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists coach_applications_player_idx
  on public.coach_applications (player_id, created_at desc);
create index if not exists coach_applications_status_idx
  on public.coach_applications (status, created_at desc);

-- Enforce: at most one pending application per player.
create unique index if not exists coach_applications_one_pending_per_player
  on public.coach_applications (player_id)
  where status = 'pending';

create trigger trg_coach_applications_updated
  before update on public.coach_applications
  for each row execute function set_updated_at();

comment on table public.coach_applications is
  'Player → admin requests to be granted coach status. Files live '
  'in the storage bucket "coach-applications" under '
  '<player_id>/<application_id>/<filename>.';
comment on column public.coach_applications.attachments is
  'JSONB array of objects: {path, name, size, mime_type}. Path is '
  'relative to the coach-applications bucket.';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.coach_applications enable row level security;

-- Player can see their own applications (history + status).
drop policy if exists coach_applications_self_read on public.coach_applications;
create policy coach_applications_self_read on public.coach_applications
  for select using (player_id = auth.uid() or is_admin());

-- Player can submit a new application for themselves.
drop policy if exists coach_applications_self_insert on public.coach_applications;
create policy coach_applications_self_insert on public.coach_applications
  for insert with check (
    player_id = auth.uid()
    -- New rows are always created in `pending` state.
    and status = 'pending'
    and decided_by is null
    and decided_at is null
    and admin_comment is null
  );

-- Player can edit their OWN PENDING application (e.g. fix a typo,
-- add a missing file) but cannot tamper with the decision fields.
-- Admins can update anything.
drop policy if exists coach_applications_pending_self_update on public.coach_applications;
create policy coach_applications_pending_self_update on public.coach_applications
  for update
  using (
    (player_id = auth.uid() and status = 'pending') or is_admin()
  )
  with check (
    is_admin()
    or (
      player_id = auth.uid()
      and status = 'pending'
      and decided_by is null
      and decided_at is null
      and admin_comment is null
    )
  );

-- Only admin can delete (cleanup of spam etc).
drop policy if exists coach_applications_admin_delete on public.coach_applications;
create policy coach_applications_admin_delete on public.coach_applications
  for delete using (is_admin());

-- ------------------------------------------------------------
-- Storage bucket: private. Files are served via signed URLs
-- generated server-side; never exposed publicly.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-applications',
  'coach-applications',
  false,
  10 * 1024 * 1024, -- 10 MB per file
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies on storage.objects.
-- Pattern: <player_id>/<application_id>/<filename>.

drop policy if exists "coach_applications_owner_insert" on storage.objects;
create policy "coach_applications_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'coach-applications'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "coach_applications_owner_read" on storage.objects;
create policy "coach_applications_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'coach-applications'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin()
    )
  );

drop policy if exists "coach_applications_owner_update" on storage.objects;
create policy "coach_applications_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'coach-applications'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'coach-applications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "coach_applications_owner_delete" on storage.objects;
create policy "coach_applications_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'coach-applications'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin()
    )
  );
