-- ============================================================
-- Venues become an admin-curated directory
--
-- Coaches no longer create or own venues. Instead, an administrator
-- maintains a club-wide directory of venues + courts; coaches just
-- pick a court when creating a slot. This:
--
--   1. Eliminates duplicate venue entries from competing coaches.
--   2. Lets us reliably deduplicate Google/OSM venue data going forward.
--   3. Makes venue/court CRUD a privileged operation behind admin RLS.
--
-- Migration steps:
--   * Wipe existing venues + courts (cascades into slot_templates,
--     slots, bookings, matches.court_id reference).
--   * Drop venues.owner_id (no longer meaningful — admin owns them all).
--   * Replace owner-based RLS with admin-only writes; SELECT remains
--     open for any authenticated user (and public, like before).
-- ============================================================

-- Defensive: stop any leftover slots from blocking the cascade if a
-- column-level trigger objects to bulk delete. CASCADE on FKs handles
-- the actual chain (slots.court_id, bookings.slot_id, ...).
delete from courts;
delete from venues;

-- Drop the obsolete owner_id column. Need to drop dependent policies
-- first (Postgres will error otherwise).
drop policy if exists venues_owner_write on venues;
drop policy if exists courts_owner_write on courts;

alter table venues drop column if exists owner_id;

-- New write policies — admin only.
drop policy if exists venues_admin_write on venues;
create policy venues_admin_write on venues for all
  using (is_admin()) with check (is_admin());

drop policy if exists courts_admin_write on courts;
create policy courts_admin_write on courts for all
  using (is_admin()) with check (is_admin());
