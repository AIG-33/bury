-- ============================================================
-- Open coach reviews: any logged-in user can leave a review,
-- regardless of whether they had a booking / tournament with
-- the coach.
--
-- Rationale: previously only players with a confirmed booking
-- or tournament participation could review. The product team
-- decided to open this up — anyone signed in can rate a coach
-- (with the obvious caveat that admins can still hide spam via
-- /admin/reviews and `coach_reviews.status`).
--
-- Schema changes:
--   * extend `source_type` CHECK to include 'open'
--   * relax `source_id` CHECK so 'open' rows have NULL source_id
--   * the table-level UNIQUE (reviewer, coach, source_type,
--     source_id) does NOT prevent duplicates when source_id is
--     NULL because Postgres treats NULL as distinct. Add a
--     partial UNIQUE index so a single (reviewer, coach) pair
--     can have at most one 'open' review.
-- ============================================================

alter table public.coach_reviews
  drop constraint if exists coach_reviews_source_type_check;

alter table public.coach_reviews
  add constraint coach_reviews_source_type_check
  check (source_type in ('booking', 'tournament', 'manual', 'open'));

alter table public.coach_reviews
  drop constraint if exists coach_reviews_source_id_check;

alter table public.coach_reviews
  add constraint coach_reviews_source_id_check
  check (
    -- 'manual' (admin) and 'open' (any user) carry no source row
    (source_type in ('manual', 'open') and source_id is null)
    or (source_type in ('booking', 'tournament') and source_id is not null)
  );

-- Enforce: at most one 'open' review per (reviewer, coach) pair.
-- Partial unique works around the NULL-distinct behaviour of the
-- existing table-level UNIQUE constraint.
create unique index if not exists coach_reviews_one_open_per_pair
  on public.coach_reviews (reviewer_id, target_coach_id)
  where source_type = 'open';

comment on column public.coach_reviews.source_type is
  'What proves the interaction: booking (slot booking), tournament '
  '(tournament participation), open (any registered user, no proof '
  'required), manual (admin override).';
