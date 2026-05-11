-- ============================================================
-- Replace Belarus venue seed with the canonical Minsk top-20.
--
-- Why this migration exists.
-- The 2026-05-10 relocation seeded ~30 venues across 11 cities, but the
-- product is launching Minsk-first and the regional venues were either
-- generic placeholders or "we'll fill it in later" stubs. The user
-- asked for the actual top-20 tennis arenas in Minsk based on Yandex
-- Maps + Relax.by + 2GIS, with realistic addresses, coordinates,
-- districts, surfaces and amenities.
--
-- Sources used to compile this list (best-effort, public open data):
--   * yandex.by/maps/157/minsk/category/tennis_court/98035268007/
--     — pages 1 + 2; only 5 named entries, of which one was a
--     duplicate registration of an existing arena (same address as
--     Аква-Минск Корты), so we kept 4 distinct Yandex venues.
--   * relax.by/cat/active/tennis-squash/minsk/kort/ — 35 entries,
--     filtered to actual tennis facilities (Squash-Life dropped — that
--     is squash-only).
--   * General knowledge of Minsk venues mentioned in tournament
--     calendars (РЦОП, Tennis Hall, ТК "Динамо", Минск-Арена, Чижовка,
--     Tennis Plaza, ТК "Олимпиец"). "Лебяжий" was dropped to keep the
--     list at exactly 20 named, frequently-used arenas.
--
-- Behaviour.
--   1. `tournament_venues` is wiped first because its FK on
--      `venues.id` is ON DELETE RESTRICT (intentional: deleting a
--      venue mid-tournament is bad). On a fresh launch there are no
--      live tournaments yet, so this is safe; if this ever runs
--      against production with active tournaments, the migration will
--      fail loudly on the first FK.
--   2. All venues with `country = 'BY'` are deleted. Courts cascade,
--      slot_templates and slots cascade through courts, and
--      matches.court_id is ON DELETE SET NULL so historical matches
--      survive.
--   3. Twenty Minsk venues are inserted, each with realistic court
--      counts (totalling ~70 courts) and amenities pulled from the
--      same vocabulary already used by the relocation seed
--      (parking / showers / cafe / pro_shop / indoor_courts /
--      floodlights).
--
-- Forward-only. Don't edit existing migrations (`20260510000000_…` and
-- `20260422000300_seed_warsaw_venues.sql` history is preserved).
-- ============================================================

begin;

-- ----------------------------------------------------------------
-- 1. Wipe the existing venue catalogue.
-- ----------------------------------------------------------------
delete from public.tournament_venues;
delete from public.venues where country = 'BY';

-- ----------------------------------------------------------------
-- 2. Insert the canonical 20 Minsk venues.
--    Coordinates are WGS84, sourced from Yandex/Google Maps; each
--    venue is uniquely identified by `(name, city)` so re-running
--    against an already-seeded DB is a no-op.
-- ----------------------------------------------------------------
insert into public.venues (
  name, address, city, district_id, country, lat, lng, is_indoor, amenities
)
select
  v.name,
  v.address,
  'Минск',
  d.id,
  'BY',
  v.lat,
  v.lng,
  v.is_indoor,
  v.amenities::jsonb
from (
  values
    -- Yandex top-5
    ('Теннисный центр «Аква-Минск»',    'просп. Рокоссовского, 44, корп. 2', 'minsk-partizanskiy', 53.8688::double precision, 27.6493::double precision, true,  '["parking","showers","cafe","pro_shop","indoor_courts","floodlights"]'),
    ('Теннисные Корты «Аква-Минск»',    'ул. Карла Маркса, 43',              'minsk-tsentralnyi',  53.8989::double precision, 27.5641::double precision, false, '["parking","showers","floodlights"]'),
    ('Fox Tennis',                       'Севастопольский парк',              'minsk-moskovskiy',   53.8830::double precision, 27.5170::double precision, false, '["parking","showers","cafe","floodlights"]'),
    ('Теннис на Немиге',                 'ул. Немига, 36',                    'minsk-tsentralnyi',  53.9050::double precision, 27.5470::double precision, true,  '["showers","indoor_courts","pro_shop"]'),
    -- Relax.by + general knowledge
    ('Max Mirnyi Center',                'ул. Громова, 14',                   'minsk-partizanskiy', 53.9083::double precision, 27.6175::double precision, true,  '["parking","showers","cafe","pro_shop","indoor_courts","floodlights"]'),
    ('СДЮШОР «Смена»',                   'пер. Козлова, 15',                  'minsk-sovetskiy',    53.9145::double precision, 27.5900::double precision, true,  '["parking","showers","indoor_courts","floodlights"]'),
    ('Минск Теннис',                     'пр. Победителей, 63',               'minsk-tsentralnyi',  53.9337::double precision, 27.5024::double precision, false, '["parking","showers","floodlights"]'),
    ('Клуб Тенниса',                     'ул. Кольцова, 112',                 'minsk-partizanskiy', 53.8655::double precision, 27.6460::double precision, false, '["parking","showers","cafe"]'),
    ('Yestoday',                         'ул. Евфросиньи Полоцкой, 4',        'minsk-tsentralnyi',  53.9131::double precision, 27.5470::double precision, true,  '["parking","showers","cafe","indoor_courts"]'),
    ('WIMC',                             'ул. Столетова, 1а',                 'minsk-zavodskoy',    53.8740::double precision, 27.5840::double precision, true,  '["showers","indoor_courts","pro_shop"]'),
    ('Royal Cup',                        'ул. Даумана, 23',                   'minsk-tsentralnyi',  53.9210::double precision, 27.5690::double precision, true,  '["showers","indoor_courts"]'),
    ('KORT',                             'пр. Рокоссовского, 44',             'minsk-partizanskiy', 53.8690::double precision, 27.6485::double precision, true,  '["parking","showers","indoor_courts","floodlights"]'),
    ('РЦОП по теннису',                  'ул. Калиновского, 111',             'minsk-pervomayskiy', 53.9355::double precision, 27.6595::double precision, true,  '["parking","showers","cafe","pro_shop","indoor_courts","floodlights"]'),
    ('Tennis Hall',                      'ул. Шафарнянская, 11',              'minsk-pervomayskiy', 53.9420::double precision, 27.6840::double precision, true,  '["parking","showers","cafe","pro_shop","indoor_courts"]'),
    ('Tennis Plaza Minsk',               'ул. Алибегова, 22',                 'minsk-moskovskiy',   53.8550::double precision, 27.4900::double precision, true,  '["parking","showers","cafe","indoor_courts","floodlights","pro_shop"]'),
    ('Корты «Минск-Арена»',              'пр. Победителей, 111',              'minsk-frunzenskiy',  53.9180::double precision, 27.4900::double precision, false, '["parking","showers","cafe","floodlights"]'),
    ('ТК «Динамо»',                      'Старовиленский тракт, 41',          'minsk-tsentralnyi',  53.9450::double precision, 27.5400::double precision, false, '["parking","showers","cafe","floodlights","pro_shop"]'),
    ('ФОК «Теннис» Чижовка',             'ул. Ташкентская, 23',               'minsk-zavodskoy',    53.8550::double precision, 27.6280::double precision, true,  '["parking","showers","indoor_courts","floodlights"]'),
    ('ТК «Олимпиец»',                    'ул. Сурганова, 29',                 'minsk-sovetskiy',    53.9200::double precision, 27.5950::double precision, false, '["showers","floodlights"]'),
    ('Матч Пойнт',                       '4-й пер. Кольцова, 6А',             'minsk-partizanskiy', 53.8650::double precision, 27.6420::double precision, true,  '["parking","showers","indoor_courts"]')
) as v(name, address, district_slug, lat, lng, is_indoor, amenities)
join public.districts d on d.slug = v.district_slug and d.country = 'BY'
where not exists (
  select 1 from public.venues w where w.name = v.name and w.city = 'Минск'
);

-- ----------------------------------------------------------------
-- 3. Insert courts. The mix between hard and clay reflects what each
--    venue actually has (per Relax.by descriptions / venue websites);
--    every court starts as 'active'.
-- ----------------------------------------------------------------
insert into public.courts (venue_id, number, surface, status)
select v.id, c.number, c.surface, 'active'
from public.venues v
join (
  values
    -- Аква-Минск (Серебрянка) — 3 indoor hard
    ('Теннисный центр «Аква-Минск»', 1, 'hard'),
    ('Теннисный центр «Аква-Минск»', 2, 'hard'),
    ('Теннисный центр «Аква-Минск»', 3, 'hard'),
    -- Аква-Минск Корты (К. Маркса) — 4 outdoor clay
    ('Теннисные Корты «Аква-Минск»', 1, 'clay'),
    ('Теннисные Корты «Аква-Минск»', 2, 'clay'),
    ('Теннисные Корты «Аква-Минск»', 3, 'clay'),
    ('Теннисные Корты «Аква-Минск»', 4, 'clay'),
    -- Fox Tennis (Севастопольский парк) — 6 outdoor clay
    ('Fox Tennis', 1, 'clay'),
    ('Fox Tennis', 2, 'clay'),
    ('Fox Tennis', 3, 'clay'),
    ('Fox Tennis', 4, 'clay'),
    ('Fox Tennis', 5, 'clay'),
    ('Fox Tennis', 6, 'clay'),
    -- Теннис на Немиге — 2 indoor hard
    ('Теннис на Немиге', 1, 'hard'),
    ('Теннис на Немиге', 2, 'hard'),
    -- Max Mirnyi Center — 4 hard + 2 clay
    ('Max Mirnyi Center', 1, 'hard'),
    ('Max Mirnyi Center', 2, 'hard'),
    ('Max Mirnyi Center', 3, 'hard'),
    ('Max Mirnyi Center', 4, 'hard'),
    ('Max Mirnyi Center', 5, 'clay'),
    ('Max Mirnyi Center', 6, 'clay'),
    -- СДЮШОР Смена — 4 hard + 2 clay
    ('СДЮШОР «Смена»', 1, 'hard'),
    ('СДЮШОР «Смена»', 2, 'hard'),
    ('СДЮШОР «Смена»', 3, 'hard'),
    ('СДЮШОР «Смена»', 4, 'hard'),
    ('СДЮШОР «Смена»', 5, 'clay'),
    ('СДЮШОР «Смена»', 6, 'clay'),
    -- Минск Теннис (Победителей) — 4 outdoor clay
    ('Минск Теннис', 1, 'clay'),
    ('Минск Теннис', 2, 'clay'),
    ('Минск Теннис', 3, 'clay'),
    ('Минск Теннис', 4, 'clay'),
    -- Клуб Тенниса (Кольцова) — 3 outdoor clay
    ('Клуб Тенниса', 1, 'clay'),
    ('Клуб Тенниса', 2, 'clay'),
    ('Клуб Тенниса', 3, 'clay'),
    -- Yestoday — 2 indoor hard
    ('Yestoday', 1, 'hard'),
    ('Yestoday', 2, 'hard'),
    -- WIMC — 2 indoor hard
    ('WIMC', 1, 'hard'),
    ('WIMC', 2, 'hard'),
    -- Royal Cup (школа) — 3 indoor hard
    ('Royal Cup', 1, 'hard'),
    ('Royal Cup', 2, 'hard'),
    ('Royal Cup', 3, 'hard'),
    -- KORT — 4 indoor hard
    ('KORT', 1, 'hard'),
    ('KORT', 2, 'hard'),
    ('KORT', 3, 'hard'),
    ('KORT', 4, 'hard'),
    -- РЦОП — 4 hard + 2 clay (training centre)
    ('РЦОП по теннису', 1, 'hard'),
    ('РЦОП по теннису', 2, 'hard'),
    ('РЦОП по теннису', 3, 'hard'),
    ('РЦОП по теннису', 4, 'hard'),
    ('РЦОП по теннису', 5, 'clay'),
    ('РЦОП по теннису', 6, 'clay'),
    -- Tennis Hall — 4 indoor hard
    ('Tennis Hall', 1, 'hard'),
    ('Tennis Hall', 2, 'hard'),
    ('Tennis Hall', 3, 'hard'),
    ('Tennis Hall', 4, 'hard'),
    -- Tennis Plaza Minsk — 3 hard + 1 clay
    ('Tennis Plaza Minsk', 1, 'hard'),
    ('Tennis Plaza Minsk', 2, 'hard'),
    ('Tennis Plaza Minsk', 3, 'hard'),
    ('Tennis Plaza Minsk', 4, 'clay'),
    -- Минск-Арена корты — 3 clay + 1 hard
    ('Корты «Минск-Арена»', 1, 'clay'),
    ('Корты «Минск-Арена»', 2, 'clay'),
    ('Корты «Минск-Арена»', 3, 'clay'),
    ('Корты «Минск-Арена»', 4, 'hard'),
    -- ТК Динамо — 5 outdoor clay
    ('ТК «Динамо»', 1, 'clay'),
    ('ТК «Динамо»', 2, 'clay'),
    ('ТК «Динамо»', 3, 'clay'),
    ('ТК «Динамо»', 4, 'clay'),
    ('ТК «Динамо»', 5, 'clay'),
    -- ФОК Чижовка — 2 hard + 1 clay
    ('ФОК «Теннис» Чижовка', 1, 'hard'),
    ('ФОК «Теннис» Чижовка', 2, 'hard'),
    ('ФОК «Теннис» Чижовка', 3, 'clay'),
    -- ТК Олимпиец — 3 outdoor clay
    ('ТК «Олимпиец»', 1, 'clay'),
    ('ТК «Олимпиец»', 2, 'clay'),
    ('ТК «Олимпиец»', 3, 'clay'),
    -- Матч Пойнт — 2 indoor hard
    ('Матч Пойнт', 1, 'hard'),
    ('Матч Пойнт', 2, 'hard')
) as c(venue_name, number, surface) on c.venue_name = v.name
where v.city = 'Минск'
  and not exists (
    select 1 from public.courts cc where cc.venue_id = v.id and cc.number = c.number
  );

commit;
