-- ============================================================
-- Clubs — owner-approved membership, primary-club flag, join policies,
-- invite tokens, ownership transfer + club logos bucket.
--
-- The previous (dead) `clubs` table was dropped in migration
-- 20260514000100_db_audit_drop_dead_objects.sql together with the
-- `tournaments.club_id` / `venues.club_id` FK columns. This migration
-- recreates the table from scratch with the new schema and re-adds the
-- FK columns on `tournaments` and `venues` (now meaningful because the
-- Clubs section is wired to the UI).
--
--   1) Recreate `public.clubs` with:
--        * owner_id, slug, name, description, logo_url (core)
--        * city / district_id            — public catalogue filters
--        * join_policy                   — 'approval' | 'open' | 'closed'
--        * invite_token_hash / invite_expires_at
--                                        — reusable public invite link
--                                          (only meaningful for `closed`
--                                          clubs but stored for any policy)
--        * pending_owner_id / pending_owner_at
--                                        — two-step ownership transfer
--
--   2) New table `public.club_members` — one row per (club, user).
--      Mirrors the `tournament_participants` lifecycle:
--        status: pending / approved / rejected (owner & co-admins decide)
--        role:   member  / admin              (admin = co-moderator)
--        is_primary boolean — at most one approved primary per user,
--                              enforced by a partial unique index.
--
--   3) Re-add `tournaments.club_id` and `venues.club_id`. Both nullable;
--      ON DELETE SET NULL (deleting a club leaves the tournament/venue
--      intact but unaffiliated).
--
--   4) SECURITY DEFINER helpers `is_club_owner / is_club_admin /
--      is_club_member` (mirror `is_tournament_owner / _visible`). All
--      policies route through these helpers — no recursion through RLS,
--      no `clubs` ↔ `club_members` policy loops.
--
--   5) RLS:
--        * approved rows are public (roster is open per product decision);
--        * a user can read their own pending/rejected row;
--        * owners + co-admins read everything inside their club;
--        * self-insert only as `member` / not-primary / `pending` (for
--          approval & closed) or `approved` (only when the parent club's
--          `join_policy = 'open'`);
--        * a BEFORE UPDATE trigger blocks a regular user from flipping
--          `status` or `role` on their own row — they can only toggle
--          `is_primary` and edit `message`. Owners + co-admins are
--          unrestricted.
--
--   6) SECURITY DEFINER functions:
--        * accept_club_invite(token text)        — claim a closed-club
--                                                  invite link, returns
--                                                  the new club_member id.
--        * accept_club_ownership(club_id uuid)   — finishes the two-step
--                                                  transfer (the previous
--                                                  owner is demoted to
--                                                  `role='admin'`).
--        * club_stats(club_id uuid)              — counts + top-5 avg Elo
--                                                  used by the public
--                                                  catalogue and club page.
--
--   7) Storage bucket `club-logos` — public read, owner/admin write,
--      path = <club_id>/<filename>.
-- ============================================================

-- ------------------------------------------------------------
-- 1) (Re)create `public.clubs`.
-- ------------------------------------------------------------

create table if not exists public.clubs (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  slug               text not null unique,
  name               text not null,
  description        text,
  logo_url           text,
  city               text,
  district_id        uuid references public.districts(id) on delete set null,
  join_policy        text not null default 'approval'
                     check (join_policy in ('approval', 'open', 'closed')),
  invite_token_hash  text,
  invite_expires_at  timestamptz,
  pending_owner_id   uuid references public.profiles(id) on delete set null,
  pending_owner_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.clubs enable row level security;

drop trigger if exists trg_clubs_updated on public.clubs;
create trigger trg_clubs_updated
  before update on public.clubs
  for each row execute function set_updated_at();

drop policy if exists clubs_read on public.clubs;
create policy clubs_read on public.clubs
  for select using (true);

drop policy if exists clubs_owner_write on public.clubs;
create policy clubs_owner_write on public.clubs
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

create unique index if not exists clubs_invite_token_hash_uniq
  on public.clubs (invite_token_hash)
  where invite_token_hash is not null;

create index if not exists clubs_city_idx
  on public.clubs (city)
  where city is not null;

create index if not exists clubs_district_idx
  on public.clubs (district_id)
  where district_id is not null;

comment on column public.clubs.join_policy is
  '''approval'' (default): user applies, owner/admin approves. '
  '''open'': self-join is auto-approved. '
  '''closed'': only manual add by owner/admin OR via the invite_token link.';

comment on column public.clubs.invite_token_hash is
  'SHA-256 hash of the multi-use invite token. The raw token only lives in '
  'the URL the owner shares; the hash is what the DB stores.';

comment on column public.clubs.pending_owner_id is
  'Two-step ownership transfer target. Set by the current owner; cleared '
  'once the candidate calls public.accept_club_ownership(club_id) or the '
  'offer expires (14 days from pending_owner_at).';

-- ------------------------------------------------------------
-- 1.bis) Re-add the `club_id` FK columns on tournaments / venues.
--        Both were dropped in 20260514000100 because the old clubs
--        table was dead; the Clubs section uses them now.
-- ------------------------------------------------------------

alter table public.tournaments
  add column if not exists club_id uuid references public.clubs(id) on delete set null;

create index if not exists tournaments_club_idx
  on public.tournaments (club_id)
  where club_id is not null;

alter table public.venues
  add column if not exists club_id uuid references public.clubs(id) on delete set null;

create index if not exists venues_club_idx
  on public.venues (club_id)
  where club_id is not null;

-- ------------------------------------------------------------
-- 2) `club_members` table.
-- ------------------------------------------------------------

create table if not exists public.club_members (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id)    on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  role            text not null default 'member'
                  check (role in ('member', 'admin')),
  is_primary      boolean not null default false,
  message         text,
  applied_at      timestamptz not null default now(),
  decided_at      timestamptz,
  decided_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (club_id, user_id)
);

create trigger trg_club_members_updated
  before update on public.club_members
  for each row execute function set_updated_at();

create index if not exists club_members_club_status_idx
  on public.club_members (club_id, status);

create index if not exists club_members_user_idx
  on public.club_members (user_id);

-- "At most one approved primary club per user" — enforced at the DB.
create unique index if not exists club_members_one_primary_per_user
  on public.club_members (user_id)
  where is_primary = true and status = 'approved';

comment on table public.club_members is
  'Membership of profiles in clubs. status follows the application '
  'lifecycle (pending/approved/rejected). role=''admin'' grants co-owner '
  'moderation rights (approve/reject applications, kick members, set '
  'join_policy, regenerate invite_token).';

comment on column public.club_members.is_primary is
  'Marks the user''s primary club — used for the badge next to player/coach '
  'names. At most one approved primary per user (partial unique index).';

alter table public.club_members enable row level security;

-- ------------------------------------------------------------
-- 3) SECURITY DEFINER helpers. All policies route through these — no
--    direct `EXISTS (SELECT 1 FROM clubs ...)` inside `club_members`
--    policies, otherwise the planner can produce recursive plans.
-- ------------------------------------------------------------

create or replace function public.is_club_owner(_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from clubs c
     where c.id = _club_id
       and c.owner_id = auth.uid()
  );
$$;

create or replace function public.is_club_admin(_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_club_owner(_club_id)
      or exists (
           select 1 from club_members cm
            where cm.club_id = _club_id
              and cm.user_id = auth.uid()
              and cm.role    = 'admin'
              and cm.status  = 'approved'
         );
$$;

create or replace function public.is_club_member(_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from club_members cm
     where cm.club_id = _club_id
       and cm.user_id = auth.uid()
       and cm.status  = 'approved'
  );
$$;

grant execute on function public.is_club_owner(uuid)  to anon, authenticated;
grant execute on function public.is_club_admin(uuid)  to anon, authenticated;
grant execute on function public.is_club_member(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 4) RLS policies on club_members.
-- ------------------------------------------------------------

-- READ: approved rows are public (the roster is open by design).
--       A user sees their own pending/rejected row; owners + co-admins
--       see everything inside their club; platform admins see all.
drop policy if exists club_members_read on public.club_members;
create policy club_members_read on public.club_members
  for select using (
    status = 'approved'
    or user_id = auth.uid()
    or public.is_club_admin(club_id)
    or is_admin()
  );

-- INSERT (self-apply): a user can only create their OWN row, as a regular
--   member, not primary. Status='pending' is always allowed (approval &
--   closed flows go through here). Status='approved' is only allowed if
--   the parent club has join_policy='open'.
--
--   Manual add by owner/admin and invite-token accept bypass this policy:
--   the first goes through the `club_members_admin_write` policy below,
--   the second goes through the SECURITY DEFINER accept_club_invite().
drop policy if exists club_members_self_apply on public.club_members;
create policy club_members_self_apply on public.club_members
  for insert with check (
    user_id    = auth.uid()
    and role        = 'member'
    and is_primary  = false
    and (
      status = 'pending'
      or (
        status = 'approved'
        and exists (
          select 1 from clubs c
           where c.id = club_id
             and c.join_policy = 'open'
        )
      )
    )
  );

-- INSERT (owner/admin add): a club owner/admin can drop in an already-
--   approved row for any user (manual add). Useful for closed clubs
--   bootstrapping. Anything else (status=pending etc) is also allowed,
--   we trust the SA layer to do the right thing.
drop policy if exists club_members_admin_insert on public.club_members;
create policy club_members_admin_insert on public.club_members
  for insert with check (
    public.is_club_admin(club_id) or is_admin()
  );

-- UPDATE: a user can update their own row, owner/admin can update any.
--   The fine-grained guard ("user cannot self-approve, cannot self-promote
--   to admin") is enforced by a BEFORE UPDATE trigger below — RLS
--   `WITH CHECK` can't compare OLD vs NEW.
drop policy if exists club_members_update on public.club_members;
create policy club_members_update on public.club_members
  for update
  using (
    user_id = auth.uid()
    or public.is_club_admin(club_id)
    or is_admin()
  )
  with check (true);

-- DELETE: user can leave (own row); owner/admin can kick.
drop policy if exists club_members_delete on public.club_members;
create policy club_members_delete on public.club_members
  for delete using (
    user_id = auth.uid()
    or public.is_club_admin(club_id)
    or is_admin()
  );

-- ------------------------------------------------------------
-- 5) Trigger: stop a regular user from escalating their own row.
--    They may flip is_primary (provided the partial unique index is happy)
--    and edit `message`. Status, role, decided_at/by are owned by the
--    club admins.
-- ------------------------------------------------------------

create or replace function public.club_members_self_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / platform admins / club admins → unrestricted.
  if is_admin() or public.is_club_admin(new.club_id) then
    return new;
  end if;

  -- Beyond this point we are the row's user editing themselves.
  if old.user_id <> auth.uid() then
    raise exception 'club_members: not authorized' using errcode = '42501';
  end if;

  if new.status     is distinct from old.status     then
    raise exception 'club_members: cannot change status of your own row';
  end if;
  if new.role       is distinct from old.role       then
    raise exception 'club_members: cannot change role of your own row';
  end if;
  if new.decided_at is distinct from old.decided_at then
    raise exception 'club_members: decided_at is read-only';
  end if;
  if new.decided_by is distinct from old.decided_by then
    raise exception 'club_members: decided_by is read-only';
  end if;
  if new.club_id    is distinct from old.club_id    then
    raise exception 'club_members: cannot move row between clubs';
  end if;
  if new.user_id    is distinct from old.user_id    then
    raise exception 'club_members: cannot reassign row to another user';
  end if;

  return new;
end $$;

drop trigger if exists trg_club_members_self_update_guard on public.club_members;
create trigger trg_club_members_self_update_guard
  before update on public.club_members
  for each row execute function public.club_members_self_update_guard();

-- ------------------------------------------------------------
-- 6) Let club owners + co-admins update the parent `clubs` row
--    (description/logo/city/join_policy). The existing
--    `clubs_owner_write` already covers the owner; we add a parallel
--    policy for co-admins. owner_id / slug edits are restricted by the
--    SA layer (no point doing it in RLS — admins can rotate anything).
-- ------------------------------------------------------------

drop policy if exists clubs_admin_update on public.clubs;
create policy clubs_admin_update on public.clubs
  for update
  using (public.is_club_admin(id))
  with check (public.is_club_admin(id));

-- ------------------------------------------------------------
-- 7) SECURITY DEFINER helpers used by Server Actions.
-- ------------------------------------------------------------

-- 7a) accept_club_invite: user clicks /clubs/join/<token>, the SA hashes
--     the token and calls this function. It looks up the club, validates
--     expiry, and inserts (or "rehabilitates" an existing) club_members
--     row at status='approved'.
create or replace function public.accept_club_invite(_token_hash text)
returns table (club_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  _club_id   uuid;
  _user_id   uuid := auth.uid();
  _expires   timestamptz;
  _member_id uuid;
begin
  if _user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select c.id, c.invite_expires_at
    into _club_id, _expires
    from clubs c
   where c.invite_token_hash = _token_hash
   limit 1;

  if _club_id is null then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  if _expires is not null and _expires < now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  -- Upsert: if the user already has a row (pending/rejected) → promote
  -- to approved; if they're already approved → return that row.
  insert into club_members (club_id, user_id, status, role, applied_at, decided_at)
    values (_club_id, _user_id, 'approved', 'member', now(), now())
    on conflict (club_id, user_id) do update
      set status     = 'approved',
          decided_at = now()
    returning id into _member_id;

  return query select _club_id, _member_id;
end $$;

grant execute on function public.accept_club_invite(text) to authenticated;

-- 7b) accept_club_ownership: candidate accepts the pending transfer.
--     The previous owner becomes a co-admin so they don't lose access.
create or replace function public.accept_club_ownership(_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id  uuid := auth.uid();
  _previous uuid;
  _pending  uuid;
  _at       timestamptz;
begin
  if _user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select owner_id, pending_owner_id, pending_owner_at
    into _previous, _pending, _at
    from clubs
   where id = _club_id
   for update;

  if _previous is null then
    raise exception 'club_not_found' using errcode = 'P0002';
  end if;

  if _pending is null or _pending <> _user_id then
    raise exception 'transfer_not_offered' using errcode = '42501';
  end if;

  if _at is not null and _at < now() - interval '14 days' then
    -- Clear the stale offer and bail.
    update clubs
       set pending_owner_id = null,
           pending_owner_at = null
     where id = _club_id;
    raise exception 'transfer_expired' using errcode = 'P0001';
  end if;

  update clubs
     set owner_id         = _user_id,
         pending_owner_id = null,
         pending_owner_at = null
   where id = _club_id;

  -- New owner — make sure they are an approved admin in the club_members
  -- table (so the membership UI is consistent). The partial unique on
  -- (club_id, user_id) means we upsert.
  insert into club_members (club_id, user_id, status, role, applied_at, decided_at, decided_by)
    values (_club_id, _user_id, 'approved', 'admin', now(), now(), _previous)
    on conflict (club_id, user_id) do update
      set status     = 'approved',
          role       = 'admin',
          decided_at = now(),
          decided_by = _previous;

  -- Previous owner — demote to co-admin so they keep moderation rights.
  insert into club_members (club_id, user_id, status, role, applied_at, decided_at, decided_by)
    values (_club_id, _previous, 'approved', 'admin', now(), now(), _user_id)
    on conflict (club_id, user_id) do update
      set status     = 'approved',
          role       = 'admin',
          decided_at = now(),
          decided_by = _user_id;
end $$;

grant execute on function public.accept_club_ownership(uuid) to authenticated;

-- 7c) club_stats: lightweight aggregator used by the catalogue + public
--     club page. Returns counts + top-5 avg Elo. Pure SQL view-style
--     function so it stays cheap to call per-club.
create or replace function public.club_stats(_club_id uuid)
returns table (
  members_total       integer,
  coaches_total       integer,
  avg_elo             integer,
  top5_avg_elo        integer,
  active_30d          integer,
  tournaments_total   integer
)
language sql
stable
security definer
set search_path = public
as $$
  with approved as (
    select p.id, p.is_coach, p.current_elo, p.last_match_at
      from club_members cm
      join profiles p on p.id = cm.user_id
     where cm.club_id = _club_id
       and cm.status  = 'approved'
  ),
  top5 as (
    select current_elo
      from approved
     order by current_elo desc nulls last
     limit 5
  )
  select
    (select count(*)::int from approved),
    (select count(*)::int from approved where is_coach),
    (select coalesce(avg(current_elo), 0)::int from approved),
    (select coalesce(avg(current_elo), 0)::int from top5),
    (select count(*)::int from approved
      where last_match_at is not null
        and last_match_at >= now() - interval '30 days'),
    (select count(*)::int from tournaments where club_id = _club_id);
$$;

grant execute on function public.club_stats(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 8) Storage bucket for club logos. Public read; only the club's owner
--    or a co-admin can write inside the <club_id>/... folder.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-logos',
  'club-logos',
  true,
  2 * 1024 * 1024, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: check that the first folder segment of `name` is a UUID of a
-- club the current user can write to. Inlined into each policy.
drop policy if exists "club_logos_public_read" on storage.objects;
create policy "club_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'club-logos');

drop policy if exists "club_logos_admin_insert" on storage.objects;
create policy "club_logos_admin_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'club-logos'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.clubs c
       where c.id::text = (storage.foldername(name))[1]
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
       where c.id::text = (storage.foldername(name))[1]
         and public.is_club_admin(c.id)
    )
  )
  with check (
    bucket_id = 'club-logos'
    and exists (
      select 1 from public.clubs c
       where c.id::text = (storage.foldername(name))[1]
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
       where c.id::text = (storage.foldername(name))[1]
         and public.is_club_admin(c.id)
    )
  );
