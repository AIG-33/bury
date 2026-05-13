-- ============================================================
-- Merge "KORT" + "Теннисные Корты «Аква-Минск»" into the canonical
-- "Теннисный центр «Аква-Минск»" venue.
--
-- Why this migration.
-- The 2026-05-12 Minsk top-20 seed treated three nearby/related listings
-- as separate venues:
--
--   1. "Теннисный центр «Аква-Минск»"   просп. Рокоссовского, 44 корп. 2  — 3 indoor hard
--   2. "Теннисные Корты «Аква-Минск»"   ул. Карла Маркса, 43               — 4 outdoor clay
--   3. "KORT"                            пр. Рокоссовского, 44              — 4 indoor hard
--
-- In reality these are one facility on просп. Рокоссовского, 44 in
-- Минск · Партизанский. The K. Marksa entry was a stale registration of
-- the same operator, and "KORT" is the relax.by listing for the indoor
-- hall inside the same complex. Per the operator: 13 hard + 4 clay
-- courts in total.
--
-- This migration:
--   1. Deletes any tournament_venues rows pointing at the two
--      to-be-merged venues (their FK is ON DELETE RESTRICT).
--   2. Deletes the two non-canonical venues. Their courts cascade away
--      through ON DELETE CASCADE on courts.venue_id; matches.court_id
--      is ON DELETE SET NULL so historical matches (none yet on a fresh
--      launch) survive.
--   3. Normalises the canonical venue's address to just "просп.
--      Рокоссовского, 44" (drops the "корп. 2" distinction now that it
--      represents the whole complex).
--   4. Ensures the canonical venue ends with exactly 13 hard
--      (numbers 1..13) and 4 clay (numbers 14..17) courts. The seed
--      already created courts 1..3 as hard; the INSERT below uses a
--      NOT EXISTS guard so existing rows survive and only the missing
--      ones are added — making the migration safe to re-run.
--
-- Forward-only. Earlier seed migrations stay untouched.
-- ============================================================

begin;

-- 1. Detach tournament_venues for the two venues being deleted.
--    No live tournaments at launch, but we run this for safety.
delete from public.tournament_venues
where venue_id in (
  select id from public.venues
  where city = 'Минск' and country = 'BY'
    and name in ('KORT', 'Теннисные Корты «Аква-Минск»')
);

-- 2. Drop the two non-canonical venues. Courts cascade.
delete from public.venues
where city = 'Минск' and country = 'BY'
  and name in ('KORT', 'Теннисные Корты «Аква-Минск»');

-- 3. Normalise the canonical address.
update public.venues
set address = 'просп. Рокоссовского, 44'
where city = 'Минск' and country = 'BY'
  and name = 'Теннисный центр «Аква-Минск»';

-- 4. Top up courts to reach 13 hard + 4 clay (17 total).
--    Existing courts 1..3 (hard) at the canonical venue are preserved
--    via the NOT EXISTS guard.
with target as (
  select id from public.venues
  where city = 'Минск' and country = 'BY'
    and name = 'Теннисный центр «Аква-Минск»'
)
insert into public.courts (venue_id, number, surface, status)
select t.id, c.n, c.s, 'active'
from target t
cross join (values
  (1::int,  'hard'::text),
  (2,       'hard'),
  (3,       'hard'),
  (4,       'hard'),
  (5,       'hard'),
  (6,       'hard'),
  (7,       'hard'),
  (8,       'hard'),
  (9,       'hard'),
  (10,      'hard'),
  (11,      'hard'),
  (12,      'hard'),
  (13,      'hard'),
  (14,      'clay'),
  (15,      'clay'),
  (16,      'clay'),
  (17,      'clay')
) as c(n, s)
where not exists (
  select 1 from public.courts cc
  where cc.venue_id = t.id and cc.number = c.n
);

commit;
