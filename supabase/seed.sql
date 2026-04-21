-- ============================================================
-- Seed: districts (Warsaw), default rating algorithm, default quiz
-- ============================================================

-- ---- Warsaw districts ----
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

-- ---- Rating algorithm: default v1 (active) ----
insert into rating_algorithm_config (version, is_active, config, notes)
values (1, true,
  jsonb_build_object(
    'start_elo', jsonb_build_object('base', 1000, 'clamp', jsonb_build_array(800, 2200), 'experience_per_year', 20, 'tournaments_bonus_per_5', 50),
    'k_factors', jsonb_build_object('provisional', 60, 'intermediate', 32, 'established', 20, 'provisional_until_n_matches', 10, 'intermediate_until_n_matches', 30),
    'multipliers', jsonb_build_object('friendly', 0.5, 'tournament', 1.0, 'tournament_final', 1.25),
    'season', jsonb_build_object('default_length_days', 182, 'scoring', jsonb_build_object('match_win', 10, 'match_loss', 1, 'tournament_win', 50, 'tournament_final', 30, 'tournament_semifinal', 15), 'top_n_for_prizes', 3),
    'margin_of_victory_enabled', false
  ),
  'Default v1 — created at seed.'
)
on conflict (version) do nothing;

-- ---- Onboarding quiz: default v1 (active) with 10 questions ----
do $$
declare v_id uuid;
begin
  if not exists (select 1 from quiz_versions where version = 1) then
    insert into quiz_versions (version, is_active, notes) values (1, true, 'Default v1 — 10 questions, 800–2200 range.') returning id into v_id;

    insert into quiz_questions (version_id, position, code, type, question, options, weight_formula, required) values
    (v_id, 1, 'years_played', 'number',
     jsonb_build_object('pl','Ile lat regularnie grasz w tenisa?','en','How many years have you been playing tennis regularly?','ru','Сколько лет ты регулярно играешь в теннис?'),
     null,
     jsonb_build_object('kind','linear','coef_field','start_elo.experience_per_year'),
     true),
    (v_id, 2, 'frequency_per_week', 'single_choice',
     jsonb_build_object('pl','Jak często grasz w tygodniu?','en','How often do you play per week?','ru','Как часто играешь в неделю?'),
     jsonb_build_array(
       jsonb_build_object('value','rare','label',jsonb_build_object('pl','Rzadko (<1)','en','Rarely (<1)','ru','Редко (<1)'),'weight',0),
       jsonb_build_object('value','1_2','label',jsonb_build_object('pl','1–2 razy','en','1–2 times','ru','1–2 раза'),'weight',30),
       jsonb_build_object('value','3_plus','label',jsonb_build_object('pl','3+ razy','en','3+ times','ru','3+ раза'),'weight',80)
     ), null, true),
    (v_id, 3, 'had_coach', 'single_choice',
     jsonb_build_object('pl','Czy miałeś trenera?','en','Did you have a coach?','ru','Был ли у тебя тренер?'),
     jsonb_build_array(
       jsonb_build_object('value','no','label',jsonb_build_object('pl','Nie','en','No','ru','Нет'),'weight',0),
       jsonb_build_object('value','amateur','label',jsonb_build_object('pl','Tak, amator','en','Yes, amateur','ru','Да, любитель'),'weight',30),
       jsonb_build_object('value','pro','label',jsonb_build_object('pl','Tak, profesjonalista','en','Yes, professional','ru','Да, профессионал'),'weight',120)
     ), null, true),
    (v_id, 4, 'tournaments_played', 'number',
     jsonb_build_object('pl','Ile turniejów zagrałeś łącznie?','en','How many tournaments have you played in total?','ru','Сколько турниров ты сыграл всего?'),
     null,
     jsonb_build_object('kind','step_per','step',5,'coef_field','start_elo.tournaments_bonus_per_5'),
     true),
    (v_id, 5, 'best_result', 'single_choice',
     jsonb_build_object('pl','Najlepszy wynik turniejowy','en','Best tournament result','ru','Лучший результат на турнире'),
     jsonb_build_array(
       jsonb_build_object('value','none','label',jsonb_build_object('pl','Brak','en','None','ru','Нет'),'weight',0),
       jsonb_build_object('value','club_top8','label',jsonb_build_object('pl','Top 8 klubu','en','Club top 8','ru','Топ-8 клуба'),'weight',50),
       jsonb_build_object('value','club_winner','label',jsonb_build_object('pl','Zwycięstwo w klubie','en','Club winner','ru','Победитель клубного турнира'),'weight',120),
       jsonb_build_object('value','regional','label',jsonb_build_object('pl','Medal regionalny','en','Regional medal','ru','Медаль на регионе'),'weight',200),
       jsonb_build_object('value','national','label',jsonb_build_object('pl','Krajowy','en','National','ru','Национальный'),'weight',350)
     ), null, true),
    (v_id, 6, 'serve_self_eval', 'scale',
     jsonb_build_object('pl','Oceń swój serw (1–10)','en','Rate your serve (1–10)','ru','Оцени свой подачу (1–10)'),
     jsonb_build_object('min',1,'max',10),
     jsonb_build_object('kind','offset_linear','center',5,'coef',15),
     true),
    (v_id, 7, 'forehand_self_eval', 'scale',
     jsonb_build_object('pl','Oceń swój forhand (1–10)','en','Rate your forehand (1–10)','ru','Оцени свой форхенд (1–10)'),
     jsonb_build_object('min',1,'max',10),
     jsonb_build_object('kind','offset_linear','center',5,'coef',12),
     true),
    (v_id, 8, 'backhand_self_eval', 'scale',
     jsonb_build_object('pl','Oceń swój bekhend (1–10)','en','Rate your backhand (1–10)','ru','Оцени свой бэкхенд (1–10)'),
     jsonb_build_object('min',1,'max',10),
     jsonb_build_object('kind','offset_linear','center',5,'coef',12),
     true),
    (v_id, 9, 'movement_self_eval', 'scale',
     jsonb_build_object('pl','Oceń swój ruch po korcie (1–10)','en','Rate your court movement (1–10)','ru','Оцени своё перемещение по корту (1–10)'),
     jsonb_build_object('min',1,'max',10),
     jsonb_build_object('kind','offset_linear','center',5,'coef',10),
     true),
    (v_id,10, 'current_self_estimate', 'single_choice',
     jsonb_build_object('pl','Twój obecny poziom','en','Your current level','ru','Твой текущий уровень'),
     jsonb_build_array(
       jsonb_build_object('value','beginner','label',jsonb_build_object('pl','Początkujący','en','Beginner','ru','Начинающий'),'weight',-100),
       jsonb_build_object('value','intermediate','label',jsonb_build_object('pl','Średnio zaawansowany','en','Intermediate','ru','Средний'),'weight',0),
       jsonb_build_object('value','advanced','label',jsonb_build_object('pl','Zaawansowany','en','Advanced','ru','Продвинутый'),'weight',200),
       jsonb_build_object('value','expert','label',jsonb_build_object('pl','Ekspert','en','Expert','ru','Эксперт'),'weight',400)
     ), null, true);
  end if;
end $$;

-- ---- Active season (current 6 months) ----
insert into seasons (name, starts_on, ends_on, scoring, top_n_for_prizes, prizes_description, status)
select
  'Spring/Summer 2026',
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '6 months' - interval '1 day')::date,
  jsonb_build_object('match_win',10,'match_loss',1,'tournament_win',50,'tournament_final',30,'tournament_semifinal',15),
  3,
  'Top-3 receive a coaching session with Aliaksandr Bury and a custom Bury Tennis racket cover.',
  'active'
where not exists (select 1 from seasons where status = 'active');
