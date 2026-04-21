# Rating algorithm — Onboarding quiz + Elo + Seasonal Race

This is the canonical reference for the math. Anyone (admin or AI agent) modifying the algorithm must read it first.

## 1. Configuration source of truth

Stored in `rating_algorithm_config` (versioned). The **active** row (single, `is_active=true`) is read by:

- `lib/quiz/engine.ts` — for starting Elo
- `lib/rating/elo.ts` — for match recompute
- `lib/rating/race.ts` — for seasonal race scoring

Default JSON shape:

```json
{
  "start_elo": {
    "base": 1000,
    "clamp": [800, 2200],
    "experience_per_year": 20,
    "tournaments_bonus_per_5": 50
  },
  "k_factors": {
    "provisional": 60,
    "intermediate": 32,
    "established": 20,
    "provisional_until_n_matches": 10,
    "intermediate_until_n_matches": 30
  },
  "multipliers": {
    "friendly": 0.5,
    "tournament": 1.0,
    "tournament_final": 1.25
  },
  "season": {
    "default_length_days": 182,
    "scoring": {
      "match_win": 10,
      "match_loss": 1,
      "tournament_win": 50,
      "tournament_final": 30,
      "tournament_semifinal": 15
    },
    "top_n_for_prizes": 3
  },
  "margin_of_victory_enabled": false
}
```

## 2. Onboarding quiz

### Default question set (10 questions; admin can edit any time)

| # | code | type | options & weights |
|---|---|---|---|
| 1 | `years_played` | number | weight = `experience_per_year * value` |
| 2 | `frequency_per_week` | single_choice | rare(0): 0; 1–2(1): +30; 3+(2): +80 |
| 3 | `had_coach` | single_choice | no: 0; yes_amateur: +30; yes_pro: +120 |
| 4 | `tournaments_played` | number | weight = `tournaments_bonus_per_5 * floor(value/5)` |
| 5 | `best_result` | single_choice | none: 0; club_top8: +50; club_winner: +120; regional: +200; national: +350 |
| 6 | `serve_self_eval` | scale (1–10) | weight = `(value - 5) * 15` |
| 7 | `forehand_self_eval` | scale (1–10) | weight = `(value - 5) * 12` |
| 8 | `backhand_self_eval` | scale (1–10) | weight = `(value - 5) * 12` |
| 9 | `movement_self_eval` | scale (1–10) | weight = `(value - 5) * 10` |
| 10 | `current_self_estimate` | single_choice | beginner: -100; intermediate: 0; advanced: +200; expert: +400 |

### Algorithm

```
elo = start_elo.base
for each question:
  elo += weight(answer)
elo = clamp(elo, start_elo.clamp[0], start_elo.clamp[1])
return round(elo)
```

### Honesty correction

Players naturally over-estimate. Defense:
- First `provisional_until_n_matches` rated matches use `K = 60` (very high).
- After: `K = 32` for next `intermediate_until_n_matches − provisional_until_n_matches` matches.
- Then `K = 20`.

This means: a player who put themselves at 1800 but realistically is 1300 will lose ~30–50 Elo per loss in the first phase. After ~5 losses they'll be near their real level.

## 3. Elo formula

Standard:

```
expected(a, b) = 1 / (1 + 10^((R_b - R_a) / 400))
delta(a)       = K * multiplier * (S - expected(a, b))
```

Where:
- `K` from §2 (depends on `rated_matches_count`)
- `multiplier` from `multipliers` block (friendly/tournament/final)
- `S = 1` if A won, `0` if A lost (no draws in tennis)

### Doubles

For a doubles match, treat each pair as a single "team Elo" = average of partner Elos. Compute team delta. Apply the SAME delta to both team members. Reason: simple, fair-enough for amateur play; partner-effect modeling is Phase 3.

### Margin-of-victory (optional)

If `margin_of_victory_enabled = true`, multiply delta by:

```
mov_factor = 1 + 0.3 * (game_diff / total_games)
```

Capped to `[0.7, 1.5]`. Default OFF — keeps math intuitive.

## 4. Match recompute (server-side, Postgres function)

```sql
create or replace function recalc_match_elo(p_match_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  m record;
  algo jsonb;
  k_p1 int; k_p2 int;
  mult numeric;
  ea numeric; eb numeric;
  delta_p1 int; delta_p2 int;
  old_p1 int; old_p2 int;
begin
  select * into m from matches where id = p_match_id and outcome='completed' for update;
  if not found then raise exception 'match not completed'; end if;

  select config into algo from rating_algorithm_config where is_active=true limit 1;

  -- choose multiplier
  mult := case
    when m.tournament_id is null then (algo->'multipliers'->>'friendly')::numeric
    when (m.bracket_slot is not null and m.round = (
      select max(round) from matches where tournament_id = m.tournament_id))
      then (algo->'multipliers'->>'tournament_final')::numeric
    else (algo->'multipliers'->>'tournament')::numeric
  end;
  mult := coalesce(m.multiplier, mult);

  -- read profiles, lock both
  perform 1 from profiles where id in (m.p1_id, m.p2_id) order by id for update;
  select current_elo into old_p1 from profiles where id = m.p1_id;
  select current_elo into old_p2 from profiles where id = m.p2_id;

  -- K factors
  k_p1 := case
    when (select rated_matches_count from profiles where id=m.p1_id) < (algo->'k_factors'->>'provisional_until_n_matches')::int then (algo->'k_factors'->>'provisional')::int
    when (select rated_matches_count from profiles where id=m.p1_id) < (algo->'k_factors'->>'intermediate_until_n_matches')::int then (algo->'k_factors'->>'intermediate')::int
    else (algo->'k_factors'->>'established')::int
  end;
  k_p2 := case
    when (select rated_matches_count from profiles where id=m.p2_id) < (algo->'k_factors'->>'provisional_until_n_matches')::int then (algo->'k_factors'->>'provisional')::int
    when (select rated_matches_count from profiles where id=m.p2_id) < (algo->'k_factors'->>'intermediate_until_n_matches')::int then (algo->'k_factors'->>'intermediate')::int
    else (algo->'k_factors'->>'established')::int
  end;

  ea := 1.0 / (1.0 + power(10.0, (old_p2 - old_p1)::numeric / 400.0));
  eb := 1.0 - ea;

  if m.winner_side = 'p1' then
    delta_p1 := round(k_p1 * mult * (1 - ea));
    delta_p2 := round(k_p2 * mult * (0 - eb));
  else
    delta_p1 := round(k_p1 * mult * (0 - ea));
    delta_p2 := round(k_p2 * mult * (1 - eb));
  end if;

  update profiles set current_elo = old_p1 + delta_p1, rated_matches_count = rated_matches_count + 1, elo_status = case when rated_matches_count + 1 >= (algo->'k_factors'->>'provisional_until_n_matches')::int then 'established' else 'provisional' end where id = m.p1_id;
  update profiles set current_elo = old_p2 + delta_p2, rated_matches_count = rated_matches_count + 1, elo_status = case when rated_matches_count + 1 >= (algo->'k_factors'->>'provisional_until_n_matches')::int then 'established' else 'provisional' end where id = m.p2_id;

  insert into rating_history (player_id, match_id, old_elo, new_elo, k_factor, multiplier, reason)
  values (m.p1_id, m.id, old_p1, old_p1 + delta_p1, k_p1, mult, 'match'),
         (m.p2_id, m.id, old_p2, old_p2 + delta_p2, k_p2, mult, 'match');
end;
$$;
```

## 5. Seasonal Race

For an active season `S` with `[starts_on, ends_on]`:

```
points(player) = sum over rating_history rows in [starts_on, ends_on] where reason='match':
  if delta > 0: scoring.match_win
  else:         scoring.match_loss
+ sum over tournament finishes:
  scoring.tournament_win   if 1st
  scoring.tournament_final if finalist
  scoring.tournament_semifinal if semifinalist
```

Top-N stored in `seasons.winners` JSONB on close.

## 6. Tests (Vitest — non-negotiable)

In `lib/rating/__tests__/start-elo.test.ts` and `elo.test.ts`:

- Quiz with all-zero answers → exactly `base` (clamped if needed).
- Quiz with extreme answers → upper clamp.
- Provisional player loses 5 in a row → drops by ~30–60 each.
- Two equal Elo players, A wins → A gains exactly `K * mult` (rounded).
- Big upset (Elo diff 400) → loser drops big, winner gains big.
- Doubles average team Elo correctness.

## 7. UI for admin editor

`/admin/algorithm` page — single form with sections matching the JSON shape, each with `<HelpTooltip>` explaining the field. "Save" creates a new `rating_algorithm_config` row with `version = max+1` and `is_active=true`; previous becomes inactive (single active invariant).

`/admin/onboarding-quiz` — list of questions sortable by drag, each question editable in modal; "Publish" creates new `quiz_versions` row + copies/edits questions to it (versions are immutable after publish).
