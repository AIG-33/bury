-- ============================================================
-- Domain functions: invitation accept, match elo recompute
-- ============================================================

-- Accept invitation by token_hash. Called server-side after auth.
-- Marks invitation accepted, links accepted_by to profile.
create or replace function accept_invitation(p_token_hash text, p_user_id uuid)
returns table (coach_id uuid, invitation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
begin
  select * into v_inv from invitations
   where token_hash = p_token_hash
     and status = 'pending'
     and expires_at > now()
   for update;

  if not found then
    raise exception 'invitation_invalid_or_expired';
  end if;

  update invitations
     set status = 'accepted',
         accepted_by = p_user_id,
         accepted_at = now(),
         updated_at = now()
   where id = v_inv.id;

  return query select v_inv.coach_id, v_inv.id;
end;
$$;

revoke all on function accept_invitation(text, uuid) from public;
grant execute on function accept_invitation(text, uuid) to authenticated, anon;

-- ----------------------------------------------------------------
-- recalc_match_elo(match_id): standard Elo with provisional K + multiplier
-- See docs/rating-algorithm.md for the math.
-- ----------------------------------------------------------------
create or replace function recalc_match_elo(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  algo jsonb;
  k_p1 int; k_p2 int;
  mult numeric;
  ea numeric;
  delta_p1 int; delta_p2 int;
  old_p1 int; old_p2 int;
  rmc_p1 int; rmc_p2 int;
  prov_n int; inter_n int;
  k_prov int; k_inter int; k_est int;
  mult_friendly numeric; mult_tour numeric; mult_final numeric;
begin
  select * into m from matches where id = p_match_id and outcome='completed' for update;
  if not found then raise exception 'match_not_completed'; end if;
  if m.winner_side is null then raise exception 'winner_not_set'; end if;

  select config into algo from rating_algorithm_config where is_active=true order by version desc limit 1;
  if algo is null then raise exception 'no_active_algorithm_config'; end if;

  prov_n := (algo->'k_factors'->>'provisional_until_n_matches')::int;
  inter_n := (algo->'k_factors'->>'intermediate_until_n_matches')::int;
  k_prov := (algo->'k_factors'->>'provisional')::int;
  k_inter := (algo->'k_factors'->>'intermediate')::int;
  k_est := (algo->'k_factors'->>'established')::int;
  mult_friendly := (algo->'multipliers'->>'friendly')::numeric;
  mult_tour := (algo->'multipliers'->>'tournament')::numeric;
  mult_final := (algo->'multipliers'->>'tournament_final')::numeric;

  if m.tournament_id is null then
    mult := mult_friendly;
  elsif m.round is not null and m.round = (
      select max(round) from matches where tournament_id = m.tournament_id) then
    mult := mult_final;
  else
    mult := mult_tour;
  end if;
  -- explicit override on the match
  if m.multiplier is not null and m.multiplier <> 1.0 then
    mult := m.multiplier;
  end if;

  -- lock both profiles (deterministic order to avoid deadlock)
  perform 1 from profiles where id in (m.p1_id, m.p2_id) order by id for update;

  select current_elo, rated_matches_count into old_p1, rmc_p1 from profiles where id = m.p1_id;
  select current_elo, rated_matches_count into old_p2, rmc_p2 from profiles where id = m.p2_id;

  k_p1 := case when rmc_p1 < prov_n then k_prov when rmc_p1 < inter_n then k_inter else k_est end;
  k_p2 := case when rmc_p2 < prov_n then k_prov when rmc_p2 < inter_n then k_inter else k_est end;

  ea := 1.0 / (1.0 + power(10.0, (old_p2 - old_p1)::numeric / 400.0));

  if m.winner_side = 'p1' then
    delta_p1 := round(k_p1 * mult * (1 - ea));
    delta_p2 := round(k_p2 * mult * (0 - (1 - ea)));
  else
    delta_p1 := round(k_p1 * mult * (0 - ea));
    delta_p2 := round(k_p2 * mult * (1 - (1 - ea)));
  end if;

  update profiles
     set current_elo = old_p1 + delta_p1,
         rated_matches_count = rmc_p1 + 1,
         elo_status = case when rmc_p1 + 1 >= prov_n then 'established' else 'provisional' end,
         updated_at = now()
   where id = m.p1_id;

  update profiles
     set current_elo = old_p2 + delta_p2,
         rated_matches_count = rmc_p2 + 1,
         elo_status = case when rmc_p2 + 1 >= prov_n then 'established' else 'provisional' end,
         updated_at = now()
   where id = m.p2_id;

  insert into rating_history (player_id, match_id, old_elo, new_elo, k_factor, multiplier, reason)
  values (m.p1_id, m.id, old_p1, old_p1 + delta_p1, k_p1, mult, 'match'),
         (m.p2_id, m.id, old_p2, old_p2 + delta_p2, k_p2, mult, 'match');
end;
$$;

revoke all on function recalc_match_elo(uuid) from public;
grant execute on function recalc_match_elo(uuid) to authenticated, service_role;
