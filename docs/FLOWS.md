# FLOWS — что уже реализовано

Краткая карта живых пользовательских и системных потоков (на дату документа).
Источник истины — код в `app/[locale]/**/actions.ts`, `app/api/**`, `supabase/migrations/**`.
Спецификация и плановые сценарии — в [TZ.md](TZ.md), [AI_BUILD_PLAN.md](AI_BUILD_PLAN.md), [diagrams/user-flows.md](diagrams/user-flows.md).

Условные обозначения:

- **SA** — Server Action (`"use server"`), путь относительно репо.
- **DB** — таблица/вью/функция Postgres.
- **→ FX-N** — ссылка на блок ниже (чтобы не повторяться).

---

## 0. Общие строительные блоки (FX)

Эти куски встроены почти в каждый флоу — описаны один раз, дальше только ссылка.

### FX-1. Авторизация и сессия

- `app/api/auth/callback/route.ts` — обмен кода Supabase OAuth/magic-link на сессию.
- `app/api/auth/post-login/route.ts` — пост-логин редирект по роли (`admin → /admin`, `coach → /coach/dashboard`, иначе `/me/...`).
- `app/api/auth/signout/route.ts` — выход.
- `app/[locale]/(auth)/login/*` — magic-link + Google OAuth.
- `app/[locale]/(auth)/auth/update-password/*` — смена пароля после reset.
- DB-триггер `handle_new_user` (миграция `..._init.sql`) создаёт строку в `profiles` при регистрации; локаль берётся из `raw_user_meta`.

### FX-2. RLS и сервисная роль

- Все таблицы — RLS ON. Полный набор политик: `..._init.sql`,
  `..._admin_full_crud_policies.sql`, фиксы рекурсии:
  `..._admin_rls_recursion_fix.sql`, `..._tournaments_rls_recursion_fix.sql`.
- Чтения через `lib/supabase/server.ts` (anon + cookies).
- Привилегированные операции (recalc Elo, агрегаты, админ-CRUD) — через `lib/supabase/service.ts` (service role) внутри SA, никогда не из браузера.

### FX-3. i18n

- `pl` (default), `en`, `ru` — `next-intl`, ключи в `messages/{locale}/{app,help}.json`.
- Все user-facing строки — через `useTranslations()` / `getTranslations()`.

### FX-4. Help-контент

- `components/help/{HelpPanel,HelpTooltip,FlowDiagram,EmptyState}.tsx`.
- Демо/референс — `app/[locale]/(public)/help-demo/page.tsx`.
- Правила — `AGENTS.md` §3, §8 + skill `.cursor/skills/help-demo/SKILL.md`.

### FX-5. Notifications outbox + cron

- `lib/notifications/outbox.ts`, `lib/notifications/templates.ts`.
- `lib/email/send.ts` (Resend, в dev — `console.log`-fallback) +
  шаблоны `lib/email/templates/{invitation,match-proposal}.ts`.
- `app/api/cron/reminders/route.ts` (Vercel Cron) — забирает `notifications_outbox`, рендерит, отправляет, помечает delivered/failed/retry.
- Каналы: **email** (primary автоматический), **wa.me** click-to-chat (`lib/contact/whatsapp.ts`, primary user-инициированный), Telegram/WA Business — задел в схеме, не подключены.

### FX-6. Elo recompute

- Источник правды — конфиг `rating_algorithm_config` (активная версия).
- Стартовый Elo — `lib/rating/start-elo.ts` (по результатам квиза, 800–2200, `elo_provisional_until_match_n=10`).
- Подтверждение матча → пересчёт обоих игроков с учётом provisional-K и множителя (friendly = 0.5, турнирные = 1.0). Реализация: SA `me/matches/actions.ts::confirmFriendlyResult` и `coach/tournaments/actions.ts::setMatchScore`, обе пишут в `rating_history` и обновляют `profiles.current_elo`, `profiles.last_match_at`.
- Симулятор — `admin/rating/actions.ts::simulateMatch`.

### FX-7. Публичные view (для гостей и кросс-ролей)

Заменяют запросы в `profiles`/`matches`, обходя RLS-рекурсию:

- `public_profile_basic` (`..._public_player_basic_view.sql`, `..._public_profile_views.sql`) — карточка игрока для всех.
- `public_matches_feed` (+ `_normalize_sets`, `_with_venue` миграции) — лента матчей с площадкой.

---

## 1. Гость / публичный сайт

| Флоу | Страница / SA | Что делает | Связи |
|---|---|---|---|
| Landing | `app/[locale]/page.tsx` | Hero + features + переключатель языка. | FX-3 |
| Список тренеров | `app/[locale]/coaches/page.tsx` + `coaches/actions.ts::loadCoaches`, `loadVenueOptions`, `loadDistrictOptionsForCoaches` | Фильтр по району/площадке/спецификации, сортировка по рейтингу/отзывам. | FX-7, → 4.5 |
| Карта тренеров | `coaches/map/page.tsx` + `coaches/actions.ts::loadCoachMapPins` | MapLibre + OSM, пины с привязкой к площадкам. | — |
| Профиль тренера | `coaches/[id]/page.tsx` + `loadCoachProfile`, `loadCoachUpcomingSlots` + `coach-slots.tsx` + `review-form-card.tsx` | Био, площадки, отзывы, ближайшие свободные слоты, форма отзыва. | → 4.5, → 3.5 |
| Список турниров | `app/[locale]/tournaments/page.tsx` + `tournaments/actions.ts::loadPublicTournaments` | Только public-турниры. | → 4.4 |
| Страница турнира | `tournaments/[id]/page.tsx` + `loadPublicTournamentDetail` | Сетка/таблица, участники. | → 4.4 |
| Лента матчей | `app/[locale]/matches/page.tsx` (читает `public_matches_feed`) | Последние подтверждённые матчи. | FX-7 |
| Площадки | `app/[locale]/venues/page.tsx` | Каталог из `venues`. | → 5.4 |
| Help / glossary | `app/[locale]/help/page.tsx`, `(public)/help-demo/page.tsx` | Глоссарий и демо help-компонентов. | FX-4 |

---

## 2. Онбординг

### 2.1 Приглашение игрока тренером

`coach/players/page.tsx` + `coach/players/actions.ts::createInvitation` → `invitations` (хэш токена) → `lib/email/send.ts` (шаблон invitation) → ссылка `/invite/<token>`.

`invite/[token]/page.tsx` + `invite/[token]/actions.ts::acceptInvitationAction` валидирует токен, использует FX-1 для логина, проставляет `invitations.accepted_*`, привязывает игрока к тренеру (`coach_players`), редиректит в квиз.

→ FX-5 (email), → 2.2.

### 2.2 Онбординг-квиз

`onboarding/quiz/page.tsx` + `quiz-client.tsx` + `onboarding/quiz/actions.ts::loadActiveQuiz` / `submitQuiz`.

Берёт активную `quiz_versions` (см. 5.1), сохраняет `quiz_answers`, считает старт-Elo через `lib/rating/start-elo.ts` (FX-6), пишет `profiles.current_elo`, `elo_status='provisional'`, `elo_provisional_until_match_n=10`, добавляет запись `rating_history(reason='onboarding')`. Редиректит в `/me/rating`.

### 2.3 Заявка стать тренером

`me/become-coach/page.tsx` + `form.tsx` + `me/become-coach/actions.ts::loadMyCoachApplications`, `submitCoachApplication`.

Создаёт строку в `coach_applications` + аплоад файлов (Supabase Storage). Дальше — модерация → 5.5.

---

## 3. Игрок (`/me/*`)

### 3.1 Профиль

`me/profile/page.tsx` + `profile-form.tsx` + `me/profile/actions.ts::loadMyProfile`, `updateMyProfile`, `uploadMyAvatar`, `removeMyAvatar`. Контролирует поля профиля, район, доступность, приватность, соцсети, аватар (Storage-bucket `avatars`). Используется FX-2 для записи.

### 3.2 Рейтинг

`me/rating/page.tsx` + `elo-chart.tsx`. Читает текущий Elo из `profiles` и историю из `rating_history` (см. `lib/rating/history.ts`). График Recharts.

### 3.3 Find a Player

- `me/find/page.tsx` + `find-client.tsx`.
- `me/find/actions.ts::loadDistrictOptions`, `loadMyAvailability`, `updateMyAvailability`, `searchOpponents` — фильтр (район, Elo±, доступность) через `lib/matching/find-player.ts`.
- `proposeMatch` → строка в `matches(status='proposed')` + строка в `match_proposals` (см. миграцию `..._match_proposals.sql`) + outbox (FX-5, шаблон `match-proposal`).
- `me/find/proposals/page.tsx` + `proposal-card.tsx` + `respondToProposal` (accept/decline) → `matches.status='scheduled'` или отказ; outbox.
- `loadMyProposals` — входящие/исходящие.

→ 3.4.

### 3.4 Матчи и результаты

`me/matches/page.tsx` + `match-card.tsx` + `quick-register-button.tsx` + `quick-register-dialog.tsx` + `me/matches/actions.ts`:

| SA | Назначение |
|---|---|
| `loadMyMatches` | агрегированная лента игрока. |
| `loadOpponentOptions` | поиск соперника по строке. |
| `quickRegisterMatch` | разовый офлайн-матч без предварительного proposal — сразу в `proposed` от лица первого игрока. |
| `reportFriendlyResult` | первый игрок вводит счёт → `matches.sets`, `confirmed_by_p1=true`, outbox второму игроку. |
| `confirmFriendlyResult` | второй игрок подтверждает → `outcome='completed'`, `confirmed_by_p2=true` → FX-6 пересчитывает Elo обоих, outbox `elo_changed`. |
| `disputeFriendlyResult` | помечает диспут, обнуляет подтверждение. |
| `cancelScheduledMatch` | отмена до результата. |

`lib/matches/score.ts` валидирует наборы сетов; `..._public_matches_feed*.sql` нормализует их в публичную ленту.

### 3.5 Бронирование кортов и тренеров

`me/bookings/page.tsx` + `bookings-client.tsx` + `me/bookings/actions.ts`:

- `searchAvailableSlots` — `slots` ⊕ `bookings` фильтр по району/тренеру/дате.
- `loadDistrictsForBooking` — выбор района.
- `bookSlot` → строка в `bookings`, конфликт-чек, outbox обоим (игрок + тренер).
- `cancelMyBooking`.
- `loadMyBookings` — мои брони.

→ 4.3 (тренер видит ту же бронь).

### 3.6 Мои тренеры

`me/coaches/page.tsx` (читает `coaches/actions.ts::loadMyCoaches`) — связи через `coach_players` + последние брони/матчи.

### 3.7 Мои турниры

`me/tournaments/page.tsx` + `tournaments-client.tsx` + `me/tournaments/actions.ts`:

- `loadOpenTournaments` — открытые для регистрации.
- `loadMyTournaments` — мои.
- `registerForTournament` / `withdrawFromTournament` — `tournament_participants`.

→ 4.4 (детальная сетка / счёт ведёт тренер).

### 3.8 Отзыв на тренера

`coaches/[id]/review-form-card.tsx` + `coaches/actions.ts::submitReview`. Antifraud — `lib/reviews/eligibility.ts` + миграция `..._open_coach_reviews.sql`: разрешено только если в последние 90 дней есть booking/match с этим тренером (см. также `..._coach_reviews_tournament.sql`). Триггер пересчитывает `profiles.coach_avg_rating`, `coach_reviews_count`.

---

## 4. Тренер (`/coach/*`)

### 4.1 Дашборд

`coach/dashboard/page.tsx` + `coach/dashboard/actions.ts::loadCoachDashboard` — агрегаты: ближайшие слоты, неподтверждённые матчи, новые игроки, отзывы.

### 4.2 Профиль тренера

`coach/profile/page.tsx` + `coach-profile-form.tsx` + `coach/profile/actions.ts::loadMyCoachProfile`, `saveMyCoachProfile` — био, специализация, привязка к площадкам, цены, видимость на карте.

### 4.3 Игроки и слоты

- Игроки: `coach/players/page.tsx` + `invite-form.tsx` (→ 2.1), `coach/players/[playerId]/page.tsx` (детали игрока).
- Слоты: `coach/slots/page.tsx` + `slots-client.tsx` + `slot-form-dialog.tsx` + `coach/slots/actions.ts::loadCoachSlots`, `createSlots`, `cancelSlot`. Шаблоны/расширение — `lib/slots/expand.ts` (RRULE-генерация в `slots`); схема `lib/slots/schema.ts`.
- Площадки тренера: `coach/venues/page.tsx` (read-only список из `venues` + `coach_venues`).

→ 3.5 (бронь игрока), → 5.4 (CRUD площадок — у админа).

### 4.4 Турниры тренера

`coach/tournaments/page.tsx` + `tournaments-client.tsx` + `tournament-form-dialog.tsx`; деталь — `coach/tournaments/[id]/page.tsx` + `bracket-section.tsx`, `participants-section.tsx`, `standings-section.tsx`, `privacy-control.tsx`.

`coach/tournaments/actions.ts`:

| SA | Назначение |
|---|---|
| `loadCoachTournaments`, `loadVenueOptions`, `loadTournamentDetail` | чтение. |
| `createTournament`, `updateTournament`, `deleteTournament` | CRUD. |
| `setTournamentStatus`, `setTournamentPrivacy` | состояние/видимость. |
| `addParticipant`, `removeParticipant` | состав. |
| `generateBracket` | `lib/tournaments/draw.ts` — Single Elimination + Round Robin, snake-seeding по Elo. |
| `setMatchScore` | счёт + автопродвижение победителя в SE; FX-6 пересчитывает Elo (multiplier=1.0). |
| `loadRoundRobinStandings` | таблица RR. |

Миграция `..._tournament_extras.sql` — поля приватности, multiplier-overrides и т.п.

### 4.5 Лидерборд тренеров

`coach/leaderboard/page.tsx` + `leaderboard-tabs.tsx` + `coach/leaderboard/actions.ts::loadCoachLeaderboard` (исп. `lib/coaches/leaderboard.ts`). Сортировки/фильтры по сезону.

---

## 5. Админ (`/admin/*`)

Все страницы оборачивают `<HelpPanel>` (FX-4); destructive-операции — через confirm с перечислением последствий.

### 5.1 Квиз

`admin/quiz/page.tsx` + `quiz-versions-client.tsx`; деталь — `admin/quiz/[id]/page.tsx` + `questions-client.tsx` + `question-form-dialog.tsx`.

`admin/quiz/actions.ts`: `loadQuizVersions`, `createQuizVersion`, `activateQuizVersion`, `deleteQuizVersion`, `loadQuizVersionDetail`, `upsertQuestion`, `deleteQuestion`, `moveQuestion`, `previewQuiz`. Активация = новая `quiz_versions(is_active=true)`, остальные деактивируются. Используется в 2.2.

### 5.2 Алгоритм рейтинга

`admin/rating/page.tsx` + `rating-list-client.tsx`; деталь — `admin/rating/[id]/page.tsx` + `rating-editor.tsx`.

`admin/rating/actions.ts`: `loadRatingConfigs`, `loadRatingConfigDetail`, `createRatingConfig`, `updateRatingConfig`, `activateRatingConfig`, `deleteRatingConfig`, `simulateMatch` (предпросмотр FX-6 на тестовых Elo).

### 5.3 Заявки в тренеры

`admin/coach-applications/page.tsx` + `client.tsx` + `admin/coach-applications/actions.ts`: `loadAdminCoachApplications`, `getApplicationAttachmentUrls` (signed URL из Storage), `decideCoachApplication` (approve → выдаёт роль `coach`, создаёт `coach_profiles`; reject → причина). Парная сторона — 2.3.

### 5.4 Площадки и корты

`admin/venues/page.tsx` + `venues-client.tsx` + `venue-form-dialog.tsx`; деталь — `admin/venues/[id]/page.tsx` + `courts-manager.tsx`.

`admin/venues/actions.ts`: `loadAdminVenues`, `loadVenueDetail`, `createVenue`, `updateVenue`, `deleteVenue`, `createCourt`, `updateCourt`, `deleteCourt`. Миграции: `..._venues_admin_directory.sql`, `..._coach_map.sql`, `..._seed_warsaw_venues.sql` (стартовый сид Варшавы).

### 5.5 Модерация отзывов

`admin/reviews/page.tsx` + `reviews-client.tsx` + `coaches/actions.ts::loadAdminReviews`, `moderateReview` (hide / restore / flag-resolve).

### 5.6 Универсальный DB-браузер

`admin/db/page.tsx` + `[table]/page.tsx` + `table-client.tsx` + `[id]/page.tsx` + `new/page.tsx` + `row-form.tsx`.

`admin/db/actions.ts`: `listRows`, `getRow`, `createRow`, `updateRow`, `deleteRow` — generic CRUD по whitelist таблиц из `lib/admin/tables.ts`. Service-role, под жёстким `is_admin()`-чеком.

---

## 6. Системные / фоновые

| Что | Где | Назначение |
|---|---|---|
| Cron напоминаний | `app/api/cron/reminders/route.ts` | FX-5: разбор outbox, рассылка email, retry. |
| DB-функции | `..._functions.sql` | `is_admin()`, `handle_new_user`, recompute helpers. |
| WhatsApp click-to-chat | `lib/contact/whatsapp.ts` | формирование `wa.me`-ссылок везде, где показывается контакт; миграция `..._whatsapp_primary.sql`. |
| Last-match heuristic | `..._last_match_at.sql` | заполнение `profiles.last_match_at` для активности/eligibility отзывов. |

---

## 7. Чего ещё **нет** (важно отделить от реализованного)

Чтобы документ не вводил в заблуждение — то, что упомянуто в TZ/плане, но в коде не подключено:

- Турнирные форматы помимо SE / RR (DE, Group+PO, Swiss, Compass).
- Сезонная гонка и закрытие сезона (`/admin/seasons`, cron `seasons`).
- Telegram-бот (`grammY`) и WhatsApp Business API.
- PostHog / Sentry интеграция.
- Playwright e2e сценарии.

---

## 8. Где смотреть, если флоу выглядит нелогично

1. SA в `app/[locale]/.../actions.ts` — единственный путь записи; компоненты в БД не ходят.
2. RLS-политики в миграциях `..._init.sql` + `..._admin_full_crud_policies.sql` + `..._tournaments_rls_recursion_fix.sql`.
3. Help-копирайт — `messages/{locale}/help.json` + `docs/admin-help.md`.
4. Бизнес-формулы — `lib/rating/*`, `lib/tournaments/draw.ts`, `lib/matching/find-player.ts`, `lib/slots/expand.ts`, `lib/reviews/eligibility.ts`.
