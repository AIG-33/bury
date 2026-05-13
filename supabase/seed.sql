-- ============================================================
-- Seed: districts (Belarus), default rating algorithm, default quiz
-- ============================================================

-- ---- Belarus districts (mirrors 20260510000000_belarus_relocation.sql) ----
insert into districts (country, city, name, slug, lat, lng) values
 -- Минск (9 районов)
 ('BY', 'Минск', 'Центральный',     'minsk-tsentralnyi',         53.9023, 27.5615),
 ('BY', 'Минск', 'Советский',        'minsk-sovetskiy',           53.9333, 27.6000),
 ('BY', 'Минск', 'Первомайский',     'minsk-pervomayskiy',        53.9090, 27.6320),
 ('BY', 'Минск', 'Партизанский',     'minsk-partizanskiy',        53.8810, 27.6480),
 ('BY', 'Минск', 'Заводской',        'minsk-zavodskoy',           53.8700, 27.6200),
 ('BY', 'Минск', 'Ленинский',        'minsk-leninskiy',           53.8650, 27.5900),
 ('BY', 'Минск', 'Октябрьский',      'minsk-oktyabrskiy',         53.8550, 27.5500),
 ('BY', 'Минск', 'Московский',       'minsk-moskovskiy',          53.8650, 27.5050),
 ('BY', 'Минск', 'Фрунзенский',      'minsk-frunzenskiy',         53.9050, 27.4800),
 -- Областные центры
 ('BY', 'Брест',   'Ленинский',      'brest-leninskiy',           52.0976, 23.7341),
 ('BY', 'Брест',   'Московский',     'brest-moskovskiy',          52.0850, 23.7100),
 ('BY', 'Гродно',  'Ленинский',      'grodno-leninskiy',          53.6778, 23.8295),
 ('BY', 'Гродно',  'Октябрьский',    'grodno-oktyabrskiy',        53.6890, 23.8400),
 ('BY', 'Гомель',  'Центральный',    'gomel-tsentralnyi',         52.4345, 30.9754),
 ('BY', 'Гомель',  'Советский',      'gomel-sovetskiy',           52.4500, 31.0100),
 ('BY', 'Гомель',  'Новобелицкий',   'gomel-novobelitskiy',       52.3900, 30.9900),
 ('BY', 'Гомель',  'Железнодорожный','gomel-zheleznodorozhnyi',   52.4250, 30.9550),
 ('BY', 'Витебск', 'Железнодорожный','vitebsk-zheleznodorozhnyi', 55.1904, 30.2049),
 ('BY', 'Витебск', 'Октябрьский',    'vitebsk-oktyabrskiy',       55.1750, 30.2300),
 ('BY', 'Витебск', 'Первомайский',   'vitebsk-pervomayskiy',      55.2050, 30.1900),
 ('BY', 'Могилёв', 'Ленинский',      'mogilev-leninskiy',         53.9006, 30.3322),
 ('BY', 'Могилёв', 'Октябрьский',    'mogilev-oktyabrskiy',       53.9100, 30.3550),
 ('BY', 'Могилёв', 'Центральный',    'mogilev-tsentralnyi',       53.8950, 30.3500),
 -- Районные центры
 ('BY', 'Барановичи', 'Город',       'baranovichi-gorod',         53.1327, 26.0139),
 ('BY', 'Бобруйск',   'Город',       'bobruisk-gorod',            53.1384, 29.2214),
 ('BY', 'Лида',       'Город',       'lida-gorod',                53.8884, 25.2989),
 ('BY', 'Пинск',      'Город',       'pinsk-gorod',               52.1229, 26.0951),
 ('BY', 'Солигорск',  'Город',       'soligorsk-gorod',           52.7878, 27.5366),
 ('BY', 'Молодечно',  'Город',       'molodechno-gorod',          54.3167, 26.8467)
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
  'Top-3 receive a complimentary coaching session with one of the platform coaches and a playtennis.by branded racket cover.',
  'active'
where not exists (select 1 from seasons where status = 'active');
