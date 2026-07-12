-- ============================================================
-- Add the "ГЦОР по теннису г. Минска" venue (gcor-tennis.by).
--
-- Why this migration exists.
-- The Городской центр олимпийского резерва по теннису is one of the
-- largest tennis facilities in Minsk (Управление спорта и туризма
-- Мингорисполкома) and was missing from the Minsk catalogue seeded by
-- 20260512000000_minsk_top20_venues.sql. The user asked to add it from
-- the official site https://gcor-tennis.by/.
--
-- Facts used (best-effort, from gcor-tennis.by + Yandex Maps):
--   * Located in Минск · Фрунзенский, near the "60 лет Октября" park.
--   * Учебно-спортивный отдел / main entrance: ул. Матусевича, 22
--     (the complex also spans ул. Жудро, 40 / 40/2 for open courts).
--   * Built 2013–2014: 12 indoor courts with 4 surface types, plus
--     outdoor courts. Also has a pool, gym, sauna, hamam, fitness,
--     football field, table tennis and guarded parking (not modelled —
--     `venues`/`courts` only track tennis courts + amenities).
--
-- Behaviour.
--   1. One venue is inserted, uniquely identified by (name, city) so
--      re-running against an already-seeded DB is a no-op.
--   2. 16 courts are inserted: 12 indoor (numbers 1..12, spanning all
--      four surfaces to reflect "12 кортов с 4 видами покрытий") and
--      4 outdoor (numbers 13..16). `courts.is_indoor` is set per court,
--      so the trg_courts_indoor_recompute trigger derives the venue's
--      indoor_status = 'mixed' automatically.
--   3. The venue `is_indoor` mirror set below is a placeholder; it is
--      overwritten by recompute_venue_indoor_status() once courts land.
--
-- Forward-only. Earlier seed migrations stay untouched.
-- ============================================================

begin;

-- ----------------------------------------------------------------
-- 1. Insert the venue (Фрунзенский район).
-- ----------------------------------------------------------------
insert into public.venues (
  name, address, city, district_id, country, lat, lng, is_indoor, amenities
)
select
  'ГЦОР по теннису',
  'ул. Матусевича, 22',
  'Минск',
  d.id,
  'BY',
  53.9086::double precision,
  27.4626::double precision,
  true,
  '["indoor","outdoor","lights","shower","lockers","parking","bathrooms"]'::jsonb
from public.districts d
where d.slug = 'minsk-frunzenskiy'
  and d.country = 'BY'
  and not exists (
    select 1 from public.venues w
    where w.name = 'ГЦОР по теннису' and w.city = 'Минск'
  );

-- ----------------------------------------------------------------
-- 2. Insert courts: 12 indoor (1..12) across all four surfaces +
--    4 outdoor (13..16). Every court starts 'active'. is_indoor per
--    court lets the trigger derive indoor_status = 'mixed'.
-- ----------------------------------------------------------------
insert into public.courts (venue_id, number, surface, status, is_indoor)
select v.id, c.number, c.surface, 'active', c.is_indoor
from public.venues v
join (
  values
    -- Indoor hall (ул. Матусевича, 22 / ул. Жудро, 40)
    (1::int,  'hard'::text,   true),
    (2,       'hard',         true),
    (3,       'hard',         true),
    (4,       'hard',         true),
    (5,       'clay',         true),
    (6,       'clay',         true),
    (7,       'clay',         true),
    (8,       'clay',         true),
    (9,       'carpet',       true),
    (10,      'carpet',       true),
    (11,      'grass',        true),
    (12,      'grass',        true),
    -- Open courts (ул. Жудро, 40/2)
    (13,      'clay',         false),
    (14,      'clay',         false),
    (15,      'hard',         false),
    (16,      'hard',         false)
) as c(number, surface, is_indoor) on true
where v.name = 'ГЦОР по теннису'
  and v.city = 'Минск'
  and not exists (
    select 1 from public.courts cc
    where cc.venue_id = v.id and cc.number = c.number
  );

commit;
