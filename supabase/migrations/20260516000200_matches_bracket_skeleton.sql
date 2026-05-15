-- ============================================================
-- Allow `matches.p1_id` to be NULL so we can pre-create the full
-- single-elimination / playoff skeleton at draw-time. Earlier the
-- column was NOT NULL → the closeGroupsAndStartPlayoff and
-- generateBracket SAs silently dropped every round-2+ match
-- (both sides TBD), so the final never appeared in the UI.
--
-- The `_active_proposal` partial-unique index uses LEAST/GREATEST
-- but is already scoped to `tournament_id IS NULL AND outcome =
-- 'proposed'`, so null bracket placeholders don't collide.
-- ============================================================

alter table public.matches alter column p1_id drop not null;

comment on column public.matches.p1_id is
  'P1 side of the match. Nullable to support unfilled bracket slots '
  '(both sides TBD until winners of the previous round are decided).';
