-- =============================================================================
-- Iteration 15 — Coach map: per-coach geolocation + map opt-in.
--
-- We deliberately stay schema-light: lat/lng are plain numerics rather than
-- PostGIS geography, since for an MVP map we only need point markers + simple
-- bounding-box filters. PostGIS can be layered on later without breaking data.
--
-- coach_show_on_map defaults to true so coaches who fill in coordinates appear
-- on the public map automatically.
-- =============================================================================

alter table profiles
  add column if not exists coach_lat numeric(9, 6),
  add column if not exists coach_lng numeric(9, 6),
  add column if not exists coach_show_on_map boolean not null default true;

-- Sanity: keep coordinates inside reasonable bounds so a typo doesn't put a
-- coach in low orbit.
alter table profiles
  drop constraint if exists profiles_coach_latlng_range_check;
alter table profiles
  add constraint profiles_coach_latlng_range_check
  check (
    (coach_lat is null and coach_lng is null)
    or (coach_lat between -90 and 90 and coach_lng between -180 and 180)
  );

-- Both coords must be set together; can't have just one.
alter table profiles
  drop constraint if exists profiles_coach_latlng_paired_check;
alter table profiles
  add constraint profiles_coach_latlng_paired_check
  check ((coach_lat is null) = (coach_lng is null));

-- Partial index for the public map query: only coaches who opted in and have
-- coordinates.
create index if not exists profiles_coach_map_idx
  on profiles (coach_lat, coach_lng)
  where is_coach = true and coach_show_on_map = true and coach_lat is not null;

comment on column profiles.coach_lat is 'Coach pin latitude (decimal degrees). Together with coach_lng marks the coach on the public map.';
comment on column profiles.coach_lng is 'Coach pin longitude (decimal degrees). Together with coach_lat marks the coach on the public map.';
comment on column profiles.coach_show_on_map is 'When true and coordinates are present, the coach appears on /coaches/map.';
