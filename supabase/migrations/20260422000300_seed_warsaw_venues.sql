-- ============================================================
-- Seed: popular Warsaw tennis venues + their courts.
--
-- Venues are admin-curated since 20260422000200 (no owner_id),
-- so this seed is safe to run unconditionally; we still guard
-- each insert with a NOT EXISTS check on (name, city) so the
-- migration is idempotent and re-runs cleanly on local resets.
--
-- Coordinates are best-effort (publicly visible facility addresses);
-- admins can refine them in the admin UI later. Courts are
-- a reasonable mix per venue based on what is publicly advertised.
--
-- We also defensively seed Warsaw districts here (idempotent, on
-- conflict slug do nothing) so the migration can run independently
-- of seed.sql ordering — Supabase runs seed.sql AFTER migrations,
-- so we'd otherwise insert venues with NULL district_id on a fresh DB.
-- ============================================================

insert into districts (country, city, name, slug, lat, lng) values
 ('PL','Warszawa','Śródmieście',     'warszawa-srodmiescie',     52.2298, 21.0118),
 ('PL','Warszawa','Mokotów',         'warszawa-mokotow',         52.1894, 21.0250),
 ('PL','Warszawa','Wola',            'warszawa-wola',            52.2347, 20.9844),
 ('PL','Warszawa','Ochota',          'warszawa-ochota',          52.2128, 20.9785),
 ('PL','Warszawa','Praga-Południe',  'warszawa-praga-poludnie',  52.2447, 21.0844),
 ('PL','Warszawa','Praga-Północ',    'warszawa-praga-polnoc',    52.2570, 21.0381),
 ('PL','Warszawa','Bemowo',          'warszawa-bemowo',          52.2522, 20.9119),
 ('PL','Warszawa','Bielany',         'warszawa-bielany',         52.2920, 20.9519),
 ('PL','Warszawa','Targówek',        'warszawa-targowek',        52.2917, 21.0431),
 ('PL','Warszawa','Ursynów',         'warszawa-ursynow',         52.1456, 21.0530),
 ('PL','Warszawa','Wilanów',         'warszawa-wilanow',         52.1655, 21.0892),
 ('PL','Warszawa','Włochy',          'warszawa-wlochy',          52.1914, 20.9319),
 ('PL','Warszawa','Białołęka',       'warszawa-bialoleka',       52.3219, 20.9919),
 ('PL','Warszawa','Wesoła',          'warszawa-wesola',          52.2389, 21.2256),
 ('PL','Warszawa','Wawer',           'warszawa-wawer',           52.1942, 21.1672)
on conflict (slug) do nothing;

do $$
declare
  v_id uuid;

  d_srodmiescie    uuid := (select id from districts where slug = 'warszawa-srodmiescie');
  d_mokotow        uuid := (select id from districts where slug = 'warszawa-mokotow');
  d_wola           uuid := (select id from districts where slug = 'warszawa-wola');
  d_ochota         uuid := (select id from districts where slug = 'warszawa-ochota');
  d_praga_pd       uuid := (select id from districts where slug = 'warszawa-praga-poludnie');
  d_praga_pn       uuid := (select id from districts where slug = 'warszawa-praga-polnoc');
  d_bemowo         uuid := (select id from districts where slug = 'warszawa-bemowo');
  d_bielany        uuid := (select id from districts where slug = 'warszawa-bielany');
  d_targowek       uuid := (select id from districts where slug = 'warszawa-targowek');
  d_ursynow        uuid := (select id from districts where slug = 'warszawa-ursynow');
  d_wilanow        uuid := (select id from districts where slug = 'warszawa-wilanow');
  d_wlochy         uuid := (select id from districts where slug = 'warszawa-wlochy');
  d_bialoleka      uuid := (select id from districts where slug = 'warszawa-bialoleka');
begin
  -- 1. Legia Tennis & Country Club (Śródmieście)
  if not exists (select 1 from venues where name = 'Legia Tennis & Country Club' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Legia Tennis & Country Club', 'ul. Myśliwiecka 4/8', 'Warszawa', d_srodmiescie,
            52.2236, 21.0339, false,
            '["parking","showers","cafe","pro_shop","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, name, surface, status) values
      (v_id, 1, 'Court Centralny', 'clay', 'active'),
      (v_id, 2, null, 'clay', 'active'),
      (v_id, 3, null, 'clay', 'active'),
      (v_id, 4, null, 'clay', 'active'),
      (v_id, 5, null, 'hard', 'active'),
      (v_id, 6, null, 'hard', 'active');
  end if;

  -- 2. KS Warszawianka (Mokotów)
  if not exists (select 1 from venues where name = 'KS Warszawianka' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('KS Warszawianka', 'ul. Merliniego 9', 'Warszawa', d_mokotow,
            52.1990, 21.0270, false,
            '["parking","showers","cafe","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active'),
      (v_id, 4, 'clay', 'active'),
      (v_id, 5, 'clay', 'active');
  end if;

  -- 3. Hetman Warszawa (Bielany)
  if not exists (select 1 from venues where name = 'Hetman Warszawa' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Hetman Warszawa', 'ul. Marymoncka 42', 'Warszawa', d_bielany,
            52.2785, 20.9488, true,
            '["parking","showers","indoor_courts","pro_shop"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'hard', 'active'),
      (v_id, 4, 'clay', 'active');
  end if;

  -- 4. Park Sportowy Skra (Ochota)
  if not exists (select 1 from venues where name = 'Park Sportowy Skra' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Park Sportowy Skra', 'ul. Wawelska 5', 'Warszawa', d_ochota,
            52.2114, 20.9870, false,
            '["parking","showers","cafe","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active'),
      (v_id, 4, 'hard', 'active');
  end if;

  -- 5. AZS-AWF Warszawa (Bielany)
  if not exists (select 1 from venues where name = 'AZS-AWF Warszawa' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('AZS-AWF Warszawa', 'ul. Marymoncka 34', 'Warszawa', d_bielany,
            52.2810, 20.9580, false,
            '["parking","showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active');
  end if;

  -- 6. GEM Tennis Club (Mokotów)
  if not exists (select 1 from venues where name = 'GEM Tennis Club' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('GEM Tennis Club', 'ul. Suwak 11', 'Warszawa', d_mokotow,
            52.1830, 21.0180, true,
            '["parking","showers","cafe","indoor_courts","pro_shop"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'hard', 'active'),
      (v_id, 4, 'hard', 'active');
  end if;

  -- 7. Mera Tennis Club (Włochy)
  if not exists (select 1 from venues where name = 'Mera Tennis Club' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Mera Tennis Club', 'ul. Krakowiaków 50', 'Warszawa', d_wlochy,
            52.1980, 20.9120, true,
            '["parking","showers","cafe","indoor_courts","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'hard', 'active'),
      (v_id, 4, 'hard', 'active'),
      (v_id, 5, 'clay', 'active'),
      (v_id, 6, 'clay', 'active');
  end if;

  -- 8. WTS DeSki / Justa Tennis Academy (Mokotów)
  if not exists (select 1 from venues where name = 'WTS DeSki Tennis' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('WTS DeSki Tennis', 'ul. Dolna 21', 'Warszawa', d_mokotow,
            52.2050, 21.0290, false,
            '["parking","showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active');
  end if;

  -- 9. Tenis Park Bródno (Targówek)
  if not exists (select 1 from venues where name = 'Tenis Park Bródno' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Tenis Park Bródno', 'ul. Łabiszyńska 20', 'Warszawa', d_targowek,
            52.2940, 21.0410, true,
            '["parking","showers","indoor_courts","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'hard', 'active'),
      (v_id, 4, 'clay', 'active');
  end if;

  -- 10. Wilanów Tennis Club (Wilanów)
  if not exists (select 1 from venues where name = 'Wilanów Tennis Club' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Wilanów Tennis Club', 'ul. Klimczaka 17', 'Warszawa', d_wilanow,
            52.1655, 21.0892, true,
            '["parking","showers","cafe","indoor_courts","pro_shop"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'clay', 'active'),
      (v_id, 4, 'clay', 'active');
  end if;

  -- 11. Tenis Klub Białołęka (Białołęka)
  if not exists (select 1 from venues where name = 'Tenis Klub Białołęka' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Tenis Klub Białołęka', 'ul. Modlińska 257', 'Warszawa', d_bialoleka,
            52.3219, 20.9919, false,
            '["parking","showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'hard', 'active');
  end if;

  -- 12. Korty Park Praski (Praga-Północ)
  if not exists (select 1 from venues where name = 'Korty Park Praski' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Korty Park Praski', 'ul. Ratuszowa 1', 'Warszawa', d_praga_pn,
            52.2570, 21.0381, false,
            '["showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active');
  end if;

  -- 13. Park Skaryszewski Tenis (Praga-Południe)
  if not exists (select 1 from venues where name = 'Park Skaryszewski Tenis' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Park Skaryszewski Tenis', 'al. Zieleniecka 1', 'Warszawa', d_praga_pd,
            52.2447, 21.0844, false,
            '["showers","floodlights","cafe"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'clay', 'active');
  end if;

  -- 14. Korty Bemowo Sport (Bemowo)
  if not exists (select 1 from venues where name = 'Korty Bemowo Sport' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Korty Bemowo Sport', 'ul. Obrońców Tobruku 40', 'Warszawa', d_bemowo,
            52.2522, 20.9119, true,
            '["parking","showers","indoor_courts"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active'),
      (v_id, 3, 'hard', 'active');
  end if;

  -- 15. Korty Ursynów / SOSiR (Ursynów)
  if not exists (select 1 from venues where name = 'SOSiR Ursynów Tenis' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('SOSiR Ursynów Tenis', 'ul. Pileckiego 122', 'Warszawa', d_ursynow,
            52.1456, 21.0530, false,
            '["parking","showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'clay', 'active'),
      (v_id, 2, 'clay', 'active'),
      (v_id, 3, 'hard', 'active');
  end if;

  -- 16. Korty Wola (Wola)
  if not exists (select 1 from venues where name = 'Korty OSiR Wola' and city = 'Warszawa') then
    insert into venues (name, address, city, district_id, lat, lng, is_indoor, amenities)
    values ('Korty OSiR Wola', 'ul. Esperanto 5', 'Warszawa', d_wola,
            52.2347, 20.9844, false,
            '["showers","floodlights"]'::jsonb)
    returning id into v_id;
    insert into courts (venue_id, number, surface, status) values
      (v_id, 1, 'hard', 'active'),
      (v_id, 2, 'hard', 'active');
  end if;

end $$;
