-- =============================================================================
-- Iteration 14 — Coach reviews: extend source_type to include 'tournament'.
--
-- Players can prove an interaction with a coach via:
--   * booking    – at least one confirmed booking on the coach's slot
--   * tournament – participation in a tournament owned by the coach
--   * manual     – admin-created review (no source row required)
--
-- We also tighten the schema by requiring source_id to be present when the
-- source is something the player can point at (booking / tournament).
-- =============================================================================

alter table coach_reviews
  drop constraint if exists coach_reviews_source_type_check;

alter table coach_reviews
  add constraint coach_reviews_source_type_check
  check (source_type in ('booking', 'tournament', 'manual'));

alter table coach_reviews
  drop constraint if exists coach_reviews_source_id_check;

alter table coach_reviews
  add constraint coach_reviews_source_id_check
  check (
    (source_type = 'manual' and source_id is null)
    or (source_type <> 'manual' and source_id is not null)
  );

comment on column coach_reviews.source_type is
  'What proves the interaction: booking (slot booking), tournament (tournament participation), manual (admin override)';
