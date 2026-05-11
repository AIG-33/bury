-- ============================================================
-- Belarus relocation: drop PL locale + Warsaw venues, switch to BYN currency,
-- seed Belarusian districts and venues across 8 cities.
--
-- Why this migration exists.
-- The platform pivoted from Warszawa/PL to Беларусь as the primary geography,
-- and the audience speaks Russian, not Polish. We therefore:
--
--   1. Rename every `_pln` money column to `_byn` (profiles, slot_templates,
--      slots, tournaments). Views that referenced these columns are rebuilt.
--      The numeric values are preserved as-is — operations should treat them
--      as Belarusian rubles going forward; if any rates were entered as PLN,
--      coaches/admins will edit them via the UI.
--   2. Drop `'pl'` from every `locale` check constraint
--      (`profiles.locale`, `notifications_outbox.locale`) and migrate any
--      existing `'pl'` rows to `'ru'`.
--   3. Switch `profiles.timezone` default to `'Europe/Minsk'` and update the
--      `handle_new_user()` trigger to default new accounts to `'ru'`.
--   4. Switch `profiles.country` default to `'BY'`.
--   5. Delete all Polish-seeded districts (`country = 'PL'`) and Warsaw venues
--      (`city = 'Warszawa'`). Player/coach profiles that pointed at those
--      districts have their `district_id` nulled by the existing FK ON DELETE
--      SET NULL. Venues cascade-delete their courts.
--   6. Insert ~30 Belarusian venues (Минск + областные + крупные районные),
--      grouped by district, with realistic surfaces and amenities.
--
-- This migration is forward-only. We never edit the original Warsaw seed
-- (`20260422000300_seed_warsaw_venues.sql`) — that history is preserved.
-- ============================================================

begin;

-- ----------------------------------------------------------------
-- 1. Drop the public coach directory view (rebuilt at the end with
--    the renamed `coach_hourly_rate_byn` column).
-- ----------------------------------------------------------------
drop view if exists public.public_coach_directory;

-- ----------------------------------------------------------------
-- 2. Rename `_pln` money columns to `_byn`.
--    Postgres updates dependent constraints (the explicit CHECK on
--    `entry_fee_pln >= 0`) automatically, but we drop+recreate the
--    constraint to use the new column name in error messages.
-- ----------------------------------------------------------------
alter table public.profiles
  rename column coach_hourly_rate_pln to coach_hourly_rate_byn;

alter table public.slot_templates
  rename column price_pln to price_byn;

alter table public.slots
  rename column price_pln to price_byn;

alter table public.tournaments
  rename column entry_fee_pln to entry_fee_byn;

-- The init migration already attached a check on tournaments.entry_fee:
--   check (entry_fee_pln is null or entry_fee_pln >= 0)
-- The constraint follows the column rename automatically; we re-create it
-- so the constraint name reflects the new currency.
alter table public.tournaments
  drop constraint if exists tournaments_entry_fee_pln_check;

alter table public.tournaments
  add constraint tournaments_entry_fee_byn_check
    check (entry_fee_byn is null or entry_fee_byn >= 0);

comment on column public.tournaments.entry_fee_byn is
  'Entry fee in BYN (Belarusian rubles). 0 or NULL = free / paid in person.';

comment on column public.profiles.coach_hourly_rate_byn is
  'Coach hourly rate in BYN (Belarusian rubles). NULL = rate varies / on request.';

-- ----------------------------------------------------------------
-- 3. profiles.locale: drop `'pl'` from the check + default to `'ru'`.
--    Migrate any existing `'pl'` rows to `'ru'` first so the new
--    constraint can apply.
-- ----------------------------------------------------------------
update public.profiles set locale = 'ru' where locale = 'pl';

alter table public.profiles
  drop constraint if exists profiles_locale_check;

alter table public.profiles
  add constraint profiles_locale_check check (locale in ('ru', 'en'));

alter table public.profiles
  alter column locale set default 'ru';

-- ----------------------------------------------------------------
-- 4. profiles.timezone: switch default to Europe/Minsk for new rows.
-- ----------------------------------------------------------------
alter table public.profiles
  alter column timezone set default 'Europe/Minsk';

-- ----------------------------------------------------------------
-- 5. profiles.country: switch default to 'BY' for new rows.
--    Existing rows keep their value; admins can fix on a per-row basis.
-- ----------------------------------------------------------------
alter table public.profiles
  alter column country set default 'BY';

alter table public.districts
  alter column country set default 'BY';

-- ----------------------------------------------------------------
-- 5b. venues.country: original `init.sql` schema didn't include a
--     country column (the project was Warszawa-only at the time). The
--     Belarusian seed below uses it, so we add it now with a 'BY'
--     default. Idempotent so re-runs in mixed environments don't fail.
-- ----------------------------------------------------------------
alter table public.venues
  add column if not exists country text not null default 'BY';

-- ----------------------------------------------------------------
-- 6. handle_new_user() trigger: default locale → 'ru' for new signups.
-- ----------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email_local, locale, first_name, last_name)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce((new.raw_user_meta_data->>'locale')::text, 'ru'),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ----------------------------------------------------------------
-- 7. notifications_outbox.locale: drop 'pl' from check + migrate rows.
-- ----------------------------------------------------------------
update public.notifications_outbox set locale = 'ru' where locale = 'pl';

alter table public.notifications_outbox
  drop constraint if exists notifications_outbox_locale_check;

alter table public.notifications_outbox
  add constraint notifications_outbox_locale_check check (locale in ('ru', 'en'));

-- ----------------------------------------------------------------
-- 8. Delete Polish-seeded districts and Warsaw venues (cascades to courts).
--    Profiles that referenced these districts get district_id = NULL via
--    the existing FK (ON DELETE SET NULL). Coaches keep their bookings.
--
--    Detach tournaments from Warszawa venues first: tournament_venues
--    has ON DELETE RESTRICT on venue_id (intentional — deletes should
--    fail loudly in normal operation, see 20260422000700_tournament_extras),
--    so during this one-off geography pivot we explicitly drop the link
--    rows. Tournaments themselves stay (m:n, a tournament without venues
--    is a valid state) and admins re-attach them to a Belarusian venue
--    via the coach UI.
-- ----------------------------------------------------------------
delete from public.tournament_venues
  where venue_id in (select id from public.venues where city = 'Warszawa');
delete from public.venues where city = 'Warszawa';
delete from public.districts where country = 'PL';

-- ----------------------------------------------------------------
-- 9. Seed Belarusian districts (idempotent on slug).
--    Coverage:
--      • Минск — 9 районов (все)
--      • Брест, Гродно, Гомель, Витебск, Могилёв — 1 «центр» каждый,
--        реальные административные районы.
--      • Барановичи, Бобруйск, Лида, Пинск — крупные районные центры,
--        административно делятся скромнее, поэтому одна запись «город» каждая.
-- ----------------------------------------------------------------
insert into public.districts (country, city, name, slug, lat, lng) values
  -- Минск (9 районов)
  ('BY', 'Минск', 'Центральный',         'minsk-tsentralnyi',         53.9023, 27.5615),
  ('BY', 'Минск', 'Советский',            'minsk-sovetskiy',           53.9333, 27.6000),
  ('BY', 'Минск', 'Первомайский',         'minsk-pervomayskiy',        53.9090, 27.6320),
  ('BY', 'Минск', 'Партизанский',         'minsk-partizanskiy',        53.8810, 27.6480),
  ('BY', 'Минск', 'Заводской',            'minsk-zavodskoy',           53.8700, 27.6200),
  ('BY', 'Минск', 'Ленинский',            'minsk-leninskiy',           53.8650, 27.5900),
  ('BY', 'Минск', 'Октябрьский',          'minsk-oktyabrskiy',         53.8550, 27.5500),
  ('BY', 'Минск', 'Московский',           'minsk-moskovskiy',          53.8650, 27.5050),
  ('BY', 'Минск', 'Фрунзенский',          'minsk-frunzenskiy',         53.9050, 27.4800),
  -- Брест (2 района)
  ('BY', 'Брест', 'Ленинский',            'brest-leninskiy',           52.0976, 23.7341),
  ('BY', 'Брест', 'Московский',           'brest-moskovskiy',          52.0850, 23.7100),
  -- Гродно (2 района)
  ('BY', 'Гродно', 'Ленинский',           'grodno-leninskiy',          53.6778, 23.8295),
  ('BY', 'Гродно', 'Октябрьский',         'grodno-oktyabrskiy',        53.6890, 23.8400),
  -- Гомель (4 района)
  ('BY', 'Гомель', 'Центральный',         'gomel-tsentralnyi',         52.4345, 30.9754),
  ('BY', 'Гомель', 'Советский',           'gomel-sovetskiy',           52.4500, 31.0100),
  ('BY', 'Гомель', 'Новобелицкий',        'gomel-novobelitskiy',       52.3900, 30.9900),
  ('BY', 'Гомель', 'Железнодорожный',     'gomel-zheleznodorozhnyi',   52.4250, 30.9550),
  -- Витебск (3 района)
  ('BY', 'Витебск', 'Железнодорожный',    'vitebsk-zheleznodorozhnyi', 55.1904, 30.2049),
  ('BY', 'Витебск', 'Октябрьский',        'vitebsk-oktyabrskiy',       55.1750, 30.2300),
  ('BY', 'Витебск', 'Первомайский',       'vitebsk-pervomayskiy',      55.2050, 30.1900),
  -- Могилёв (3 района)
  ('BY', 'Могилёв', 'Ленинский',          'mogilev-leninskiy',         53.9006, 30.3322),
  ('BY', 'Могилёв', 'Октябрьский',        'mogilev-oktyabrskiy',       53.9100, 30.3550),
  ('BY', 'Могилёв', 'Центральный',        'mogilev-tsentralnyi',       53.8950, 30.3500),
  -- Областные/районные центры (одна запись на город)
  ('BY', 'Барановичи', 'Город',           'baranovichi-gorod',         53.1327, 26.0139),
  ('BY', 'Бобруйск',   'Город',           'bobruisk-gorod',            53.1384, 29.2214),
  ('BY', 'Лида',       'Город',           'lida-gorod',                53.8884, 25.2989),
  ('BY', 'Пинск',      'Город',           'pinsk-gorod',               52.1229, 26.0951),
  ('BY', 'Солигорск',  'Город',           'soligorsk-gorod',           52.7878, 27.5366),
  ('BY', 'Молодечно',  'Город',           'molodechno-gorod',          54.3167, 26.8467)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------
-- 10. Seed Belarusian tennis venues + courts.
--     Each venue is a single INSERT guarded by a NOT EXISTS check so
--     the migration is idempotent on local resets. Courts use a mix
--     of clay (грунт) and hard (хард) — the dominant Belarus split.
-- ----------------------------------------------------------------
do $$
declare
  v_id uuid;

  -- Минск
  d_mn_centr   uuid := (select id from districts where slug = 'minsk-tsentralnyi');
  d_mn_sovet   uuid := (select id from districts where slug = 'minsk-sovetskiy');
  d_mn_pervo   uuid := (select id from districts where slug = 'minsk-pervomayskiy');
  d_mn_partiz  uuid := (select id from districts where slug = 'minsk-partizanskiy');
  d_mn_zavod   uuid := (select id from districts where slug = 'minsk-zavodskoy');
  d_mn_lenin   uuid := (select id from districts where slug = 'minsk-leninskiy');
  d_mn_oktyab  uuid := (select id from districts where slug = 'minsk-oktyabrskiy');
  d_mn_mosk    uuid := (select id from districts where slug = 'minsk-moskovskiy');
  d_mn_frunz   uuid := (select id from districts where slug = 'minsk-frunzenskiy');
  -- Областные
  d_brest_l    uuid := (select id from districts where slug = 'brest-leninskiy');
  d_grodno_l   uuid := (select id from districts where slug = 'grodno-leninskiy');
  d_gomel_c    uuid := (select id from districts where slug = 'gomel-tsentralnyi');
  d_gomel_s    uuid := (select id from districts where slug = 'gomel-sovetskiy');
  d_vitebsk_o  uuid := (select id from districts where slug = 'vitebsk-oktyabrskiy');
  d_mogilev_l  uuid := (select id from districts where slug = 'mogilev-leninskiy');
  -- Районные центры
  d_baran      uuid := (select id from districts where slug = 'baranovichi-gorod');
  d_bobr       uuid := (select id from districts where slug = 'bobruisk-gorod');
  d_lida       uuid := (select id from districts where slug = 'lida-gorod');
  d_pinsk      uuid := (select id from districts where slug = 'pinsk-gorod');
  d_solig      uuid := (select id from districts where slug = 'soligorsk-gorod');
  d_molo       uuid := (select id from districts where slug = 'molodechno-gorod');
begin
  -- ============================================================
  -- МИНСК (15 кортов)
  -- ============================================================

  -- 1. Республиканский центр олимпийской подготовки по теннису
  if not exists (select 1 from venues where name = 'РЦОП по теннису' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('РЦОП по теннису', 'ул. Калиновского 111', 'Минск', d_mn_pervo, 'BY',
            53.9355, 27.6595, true,
            '["parking","showers","cafe","pro_shop","indoor_courts","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, name, surface, status) values
      (v_id, 1, 'Центральный', 'hard', 'active'),
      (v_id, 2, null, 'hard', 'active'),
      (v_id, 3, null, 'hard', 'active'),
      (v_id, 4, null, 'hard', 'active'),
      (v_id, 5, null, 'clay', 'active'),
      (v_id, 6, null, 'clay', 'active');
  end if;

  -- 2. Tennis Hall (на Уручье)
  if not exists (select 1 from venues where name = 'Tennis Hall' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('Tennis Hall', 'ул. Шафарнянская 11', 'Минск', d_mn_pervo, 'BY',
            53.9420, 27.6840, true,
            '["parking","showers","cafe","pro_shop","indoor_courts"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'hard', 'active'),
      (v_id, 4, 'hard', 'active');
  end if;

  -- 3. ФОК «Теннис» Чижовка
  if not exists (select 1 from venues where name = 'ФОК «Теннис» Чижовка' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ФОК «Теннис» Чижовка', 'ул. Ташкентская 23', 'Минск', d_mn_zavod, 'BY',
            53.8550, 27.6280, true,
            '["parking","showers","indoor_courts","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'clay', 'active');
  end if;

  -- 4. СК «Минск-Арена» (теннисные корты)
  if not exists (select 1 from venues where name = 'Корты «Минск-Арена»' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('Корты «Минск-Арена»', 'пр. Победителей 111', 'Минск', d_mn_frunz, 'BY',
            53.9180, 27.4900, false,
            '["parking","showers","cafe","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active'),
      (v_id, 4, 'hard', 'active');
  end if;

  -- 5. ТК «Динамо» (на Дроздах)
  if not exists (select 1 from venues where name = 'ТК «Динамо»' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ТК «Динамо»', 'ул. Старовиленский тракт 41', 'Минск', d_mn_centr, 'BY',
            53.9450, 27.5400, false,
            '["parking","showers","cafe","floodlights","pro_shop"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active'),
      (v_id, 4, 'clay', 'active'),
      (v_id, 5, 'hard', 'active');
  end if;

  -- 6. Tennis Plaza Minsk (на Юго-Западе)
  if not exists (select 1 from venues where name = 'Tennis Plaza Minsk' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('Tennis Plaza Minsk', 'ул. Алибегова 22', 'Минск', d_mn_mosk, 'BY',
            53.8550, 27.4900, true,
            '["parking","showers","cafe","indoor_courts","floodlights","pro_shop"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'hard', 'active'),
      (v_id, 4, 'clay', 'active');
  end if;

  -- 7. ТК «Олимпиец»
  if not exists (select 1 from venues where name = 'ТК «Олимпиец»' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ТК «Олимпиец»', 'ул. Сурганова 29', 'Минск', d_mn_sovet, 'BY',
            53.9200, 27.5950, false,
            '["showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active');
  end if;

  -- 8. Корты «Лебяжий»
  if not exists (select 1 from venues where name = 'Корты «Лебяжий»' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('Корты «Лебяжий»', 'ул. Нарочанская 5', 'Минск', d_mn_frunz, 'BY',
            53.9300, 27.4400, false,
            '["parking","showers","cafe"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active');
  end if;

  -- 9. ТК «Чижовка-Арена»
  if not exists (select 1 from venues where name = 'ТК «Чижовка-Арена»' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ТК «Чижовка-Арена»', 'ул. Ташкентская 19', 'Минск', d_mn_zavod, 'BY',
            53.8580, 27.6340, true,
            '["parking","showers","indoor_courts"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active');
  end if;

  -- 10. Bury Tennis Centre (флагман — Партизанский)
  if not exists (select 1 from venues where name = 'Bury Tennis Centre' and city = 'Минск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('Bury Tennis Centre', 'ул. Радиальная 40', 'Минск', d_mn_partiz, 'BY',
            53.8900, 27.6650, true,
            '["parking","showers","cafe","indoor_courts","pro_shop","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, name, surface, status) values
      (v_id, 1, 'Centre', 'hard', 'active'),
      (v_id, 2, null, 'hard', 'active'),
      (v_id, 3, null, 'hard', 'active'),
      (v_id, 4, null, 'clay', 'active'),
      (v_id, 5, null, 'clay', 'active');
  end if;

  -- ============================================================
  -- БРЕСТ
  -- ============================================================

  if not exists (select 1 from venues where name = 'СК «Брестский»' and city = 'Брест') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('СК «Брестский»', 'бул. Космонавтов 60', 'Брест', d_brest_l, 'BY',
            52.0890, 23.7180, false,
            '["parking","showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'hard', 'active');
  end if;

  if not exists (select 1 from venues where name = 'ТК «Виктория»' and city = 'Брест') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ТК «Виктория»', 'ул. Луцкая 17', 'Брест', d_brest_l, 'BY',
            52.1010, 23.7270, true,
            '["showers","indoor_courts"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active');
  end if;

  -- ============================================================
  -- ГРОДНО
  -- ============================================================

  if not exists (select 1 from venues where name = 'СДЮШОР по теннису Гродно' and city = 'Гродно') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('СДЮШОР по теннису Гродно', 'ул. Парижской Коммуны 1', 'Гродно', d_grodno_l, 'BY',
            53.6810, 23.8350, false,
            '["parking","showers","floodlights","pro_shop"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active'),
      (v_id, 4, 'hard', 'active');
  end if;

  if not exists (select 1 from venues where name = 'ТК «Неман»' and city = 'Гродно') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ТК «Неман»', 'ул. Курчатова 14', 'Гродно', d_grodno_l, 'BY',
            53.6720, 23.8480, true,
            '["parking","showers","indoor_courts"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active');
  end if;

  -- ============================================================
  -- ГОМЕЛЬ
  -- ============================================================

  if not exists (select 1 from venues where name = 'СК «Локомотив» Гомель' and city = 'Гомель') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('СК «Локомотив» Гомель', 'пр. Победы 1', 'Гомель', d_gomel_c, 'BY',
            52.4360, 30.9700, false,
            '["parking","showers","floodlights","cafe"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active');
  end if;

  if not exists (select 1 from venues where name = 'Tennis Park Gomel' and city = 'Гомель') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('Tennis Park Gomel', 'ул. Барыкина 287', 'Гомель', d_gomel_s, 'BY',
            52.4500, 31.0050, true,
            '["parking","showers","indoor_courts","pro_shop"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'hard', 'active');
  end if;

  -- ============================================================
  -- ВИТЕБСК
  -- ============================================================

  if not exists (select 1 from venues where name = 'СК «Витебск»' and city = 'Витебск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('СК «Витебск»', 'ул. Чкалова 11', 'Витебск', d_vitebsk_o, 'BY',
            55.1850, 30.2200, true,
            '["parking","showers","indoor_courts","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'clay', 'active');
  end if;

  if not exists (select 1 from venues where name = 'Корты «Двина»' and city = 'Витебск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('Корты «Двина»', 'ул. Терешковой 4', 'Витебск', d_vitebsk_o, 'BY',
            55.1920, 30.2050, false,
            '["showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active');
  end if;

  -- ============================================================
  -- МОГИЛЁВ
  -- ============================================================

  if not exists (select 1 from venues where name = 'СК «Олимпиец» Могилёв' and city = 'Могилёв') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('СК «Олимпиец» Могилёв', 'ул. Якубовского 41', 'Могилёв', d_mogilev_l, 'BY',
            53.8950, 30.3450, false,
            '["parking","showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'hard', 'active');
  end if;

  if not exists (select 1 from venues where name = 'ТК «Спартак» Могилёв' and city = 'Могилёв') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ТК «Спартак» Могилёв', 'пр. Мира 13', 'Могилёв', d_mogilev_l, 'BY',
            53.9050, 30.3380, true,
            '["showers","indoor_courts"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active');
  end if;

  -- ============================================================
  -- РАЙОННЫЕ ЦЕНТРЫ
  -- ============================================================

  if not exists (select 1 from venues where name = 'ФОК «Атлант»' and city = 'Барановичи') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ФОК «Атлант»', 'ул. Тельмана 31', 'Барановичи', d_baran, 'BY',
            53.1340, 26.0250, false,
            '["showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'clay', 'active');
  end if;

  if not exists (select 1 from venues where name = 'СК «Бобруйск-Арена»' and city = 'Бобруйск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('СК «Бобруйск-Арена»', 'ул. Гагарина 2', 'Бобруйск', d_bobr, 'BY',
            53.1450, 29.2280, true,
            '["parking","showers","indoor_courts"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'clay', 'active');
  end if;

  if not exists (select 1 from venues where name = 'ТК «Лида»' and city = 'Лида') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ТК «Лида»', 'ул. Победы 37', 'Лида', d_lida, 'BY',
            53.8900, 25.3010, false,
            '["showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active');
  end if;

  if not exists (select 1 from venues where name = 'СК «Полесье»' and city = 'Пинск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('СК «Полесье»', 'ул. Брестская 47', 'Пинск', d_pinsk, 'BY',
            52.1240, 26.1000, false,
            '["showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active');
  end if;

  if not exists (select 1 from venues where name = 'СК «Шахтёр»' and city = 'Солигорск') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('СК «Шахтёр»', 'ул. Ленинского Комсомола 26', 'Солигорск', d_solig, 'BY',
            52.7900, 27.5400, true,
            '["parking","showers","indoor_courts"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active');
  end if;

  if not exists (select 1 from venues where name = 'ТК «Молодечно»' and city = 'Молодечно') then
    insert into venues (name, address, city, district_id, country, lat, lng, is_indoor, amenities)
    values ('ТК «Молодечно»', 'ул. Великий Гостинец 70', 'Молодечно', d_molo, 'BY',
            54.3180, 26.8480, false,
            '["showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'hard', 'active');
  end if;
end $$;

-- ----------------------------------------------------------------
-- 11. Recreate the public coach directory view with the renamed
--     `coach_hourly_rate_byn` column. Mirrors the original definition
--     in 20260422000400_public_profile_views.sql.
-- ----------------------------------------------------------------
create view public.public_coach_directory
  with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.avatar_url,
  p.city,
  p.district_id,
  p.coach_bio,
  p.coach_hourly_rate_byn,
  p.coach_certifications,
  p.coach_avg_rating,
  p.coach_reviews_count,
  p.coach_slug,
  p.coach_lat,
  p.coach_lng,
  p.coach_show_on_map,
  p.is_coach,
  p.created_at
from public.profiles p
where p.is_coach = true;

comment on view public.public_coach_directory is
  'Public, RLS-bypassing projection of `profiles` restricted to coaches. '
  'Exposes only fields safe for unauthenticated viewers (no phone, no whatsapp, '
  'no contact PII, no health notes). Used by the public /coaches catalogue.';

grant select on public.public_coach_directory to anon, authenticated;

commit;
