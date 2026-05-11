# External ratings — Liga Tennisa integration

Аудитория: разработчики и AI-агенты, работающие с импортом рейтингов
с внешних рейтинговых систем. Сейчас поддерживается только
[ligatennisa.com](https://www.ligatennisa.com/) — любительская теннисная
лига Беларуси с ~2700 ранжированными игроками.

> Связанные документы: [TZ.md](TZ.md), [FLOWS.md](FLOWS.md) §2.2-LT,
> [rating-algorithm.md](rating-algorithm.md).

---

## 1. Зачем нужен импорт

- В Беларуси основная масса любителей уже есть на ligatennisa.com и имеет
  накопленный Elo, тир, статистику. Заставлять их проходить наш
  онбординг-квиз и стартовать с приближённого значения — терять данные.
- Импорт делает онбординг быстрым (поиск по имени → один клик «подтвердить»
  → готово), и сразу даёт человеку **точку в нашей системе матчинга** с
  правдоподобным Elo.
- Для уже зарегистрированных игроков импорт — это маркетинговая фича: тир
  и Elo с ligatennisa.com видны на их карточке как «второе мнение», что
  усиливает доверие к платформе.

## 2. Принципы (важные для legal/security обзора)

1. **Opt-in**. Никаких фоновых импортов. Игрок сам нажимает «привязать»
   на `/onboarding/import-lt` или `/me/profile`.
2. **Никакой PII upstream-аккаунта**. Мы НЕ сохраняем `email`, `phone`,
   `password_hash`, `last_password_reset` — даже если ligatennisa.com их
   возвращает в ответе (а он возвращает; см. §6 про безопасность).
3. **Manual refresh only**. Никаких cron'ов на ligatennisa.com. Игрок сам
   жмёт «Обновить» на `/me/profile`. Это минимизирует трафик к
   upstream-API и лимитирует наше «правовое лицо» одним пользовательским
   кликом за раз.
4. **LT.Elo первичен только при импорте**. После того как мы сохранили
   `profiles.current_elo` из LT, наш собственный Elo живёт по нашим
   правилам (см. `lib/rating/elo.ts`). Refresh обновляет только
   `external_ratings`, НЕ трогает `profiles.current_elo`.

## 3. Архитектура

```
ligatennisa.com /api/players[/<id>]
            │
            ▼  (server only)
┌──────────────────────────────────────────────┐
│ lib/rating/external/liga-tennisa.ts          │
│   - fetchLtPlayers (cached 10 min)           │
│   - fetchLtPlayer (no cache)                 │
│   - rankLtCandidates (fuzzy match)           │
│   - ltTierForElo, ltEloToLocalElo, ...       │
└──────────────────────────────────────────────┘
            │
            ▼  Zod parse + sanitisation
┌──────────────────────────────────────────────┐
│ lib/validators/external-ratings.ts           │
│   - LtPlayerListItem / LtPlayerDetail        │
│   - LtSafePayload  ← whitelist, no PII       │
│   - sanitiseLtPayload(detail) → safe         │
└──────────────────────────────────────────────┘
            │
            ▼  business logic
┌──────────────────────────────────────────────┐
│ lib/rating/external/actions-impl.ts          │
│   - searchLtCandidates / previewLtPlayer     │
│   - confirmImportFromLt                      │
│   - refreshExternalRating                    │
│   - disconnectExternalRating                 │
│   - loadMyExternalRating                     │
│   - loadExternalRatingForPlayer (public)     │
└──────────────────────────────────────────────┘
            │
            ▼  Server Action wrappers
            ▼   (per-page, "use server")
┌──────────────────────────────────────────────┐
│ app/[locale]/onboarding/import-lt/actions.ts │
│ app/[locale]/(player)/me/profile/            │
│       external-rating-actions.ts             │
└──────────────────────────────────────────────┘
            │
            ▼  Database
┌──────────────────────────────────────────────┐
│ public.external_ratings                      │
│   (migration 20260510000100_…)               │
│   one row per (player_id, source)            │
└──────────────────────────────────────────────┘
```

## 4. Схема БД

См. `supabase/migrations/20260510000100_external_ratings.sql`.

Ключевые поля:

| Колонка                             | Тип              | Заметка                                        |
| ----------------------------------- | ---------------- | ---------------------------------------------- |
| `player_id`                         | uuid FK profiles | ON DELETE CASCADE                              |
| `source`                            | text             | enum: `'liga_tennisa'`                         |
| `external_id`                       | text             | id из upstream API                             |
| `external_url`                      | text             | https://www.ligatennisa.com/players/&lt;id&gt; |
| `display_tier`                      | text             | 'Rookies'…'Pro' (см. §5)                       |
| `external_elo`                      | integer          | LT singles Elo                                 |
| `external_elo_doubles`              | integer          | LT doubles Elo (опц.)                          |
| `is_calibrating_singles/doubles`    | bool             | флаг калибровки в LT                           |
| `raw_payload`                       | jsonb            | санитизированный snapshot (см. §6)             |
| `imported_at` / `last_refreshed_at` | timestamptz      | аудит                                          |
| `last_refresh_error`                | text             | текст последней ошибки рефреша                 |

Уникальные ограничения:

- `(player_id, source)` — один внешний рейтинг на игрока на источник.
- `(source, external_id)` — нельзя дважды «забрать» один LT-профиль.

RLS:

- `select` — для всех (бейдж публичный).
- `insert/update/delete` — только владелец (`player_id = auth.uid()`)
  или админ.

## 5. Маппинг тиров

LT-API не возвращает строковый тир — только `elo_points`. Мы вычисляем
тир из Elo по таблице, выровненной по UI ligatennisa.com:

| Тир        | Floor (Elo ≥) |
| ---------- | ------------- |
| Rookies    | 0             |
| Satellite  | 1050          |
| Futures    | 1225          |
| Legger     | 1425          |
| Challenger | 1625          |
| Masters    | 1850          |
| Supreme    | 2050          |
| Pro        | 2250          |

Реализация: `LT_TIER_FLOORS` + `ltTierForElo()` в
`lib/rating/external/liga-tennisa.ts`.

## 6. Безопасность данных upstream

ligatennisa.com экспонирует **сам по себе** некоторые чувствительные поля
(это известная утечка на их стороне):

- `password_hash` (bcrypt) — для части аккаунтов **не null**.
- `last_password_reset`.
- `email`, `phone` — на single-player endpoint.

**Мы их никогда не сохраняем.** Граница — `LtPlayerDetail` Zod-схема в
`lib/validators/external-ratings.ts`, где явно перечислены только нужные
поля; `sanitiseLtPayload()` потом конструирует новый объект из
whitelisted-полей и используется как payload в `external_ratings.raw_payload`.

Тесты-регрессии в `lib/rating/external/__tests__/liga-tennisa.test.ts`
гарантируют, что `password_hash`, `last_password_reset`, `email`, `phone`
никогда не попадают в финальный объект.

## 7. Поведение при импорте

Когда игрок подтверждает импорт (`confirmImportFromLt`):

1. Заново фетчим `LtPlayerDetail` (нельзя доверять externalId с клиента).
2. Проверяем, не привязан ли этот LT-профиль к другому аккаунту →
   ошибка `already_claimed_by_other_user`.
3. Upsert строки в `external_ratings`.
4. Обновляем `profiles`:
   - `current_elo` ← `ltEloToLocalElo(elo_points)` (зажим [800, 2200],
     fallback 1000 если LT-Elo отсутствует);
   - `elo_status = 'provisional'` (как у квиза — первые 10 матчей считаются
     с увеличенным K);
   - `onboarding_completed_at = now()`;
   - если `copyEmptyFields=true` И поле пустое → копируем
     `first_name`, `last_name`, `avatar_url`, `date_of_birth`, `city`,
     `dominant_hand`, `backhand_style`, `social_links.instagram`.
5. Пишем `rating_history(reason='external_import', old_elo, new_elo,
k_factor=0, multiplier=1.0)`.

## 8. Refresh / Disconnect

- `refreshExternalRating()` — заново фетчит upstream и обновляет только
  `external_ratings` (display_tier, external_elo, raw_payload,
  last_refreshed_at). Если upstream упал — пишет `last_refresh_error`,
  не теряя кэшированный snapshot.
- `disconnectExternalRating()` — удаляет строку. Профильные поля,
  скопированные при импорте, остаются (игрок может их править вручную).

## 9. Поиск / fuzzy match

`searchLtCandidates(query, city?)`:

1. Тянет полный список (`fetchLtPlayers` — кеш 10 мин).
2. `rankLtCandidates(players, query, { city, limit: 8 })` — нормализация
   (lower-case, strip diacritics), скоринг по правилам:
   - exact full-name → 1.0
   - starts-with → 0.85
   - word-prefix → 0.7
   - contains → 0.5
   - token-coverage → 0.2..0.4
   - бонус за совпадение фамилии: +0.1
   - бонус за совпадение города: +0.15
3. Возвращает топ-8 с `score > 0`.

## 10. UI

- `app/[locale]/onboarding/page.tsx` — chooser «квиз vs импорт»; показывается
  один раз после регистрации (бывший редирект на `/onboarding/quiz`).
- `app/[locale]/onboarding/import-lt/page.tsx` — flow поиска и подтверждения.
- `app/[locale]/onboarding/quiz/page.tsx` — баннер «Уже на ligatennisa.com?»
  со ссылкой на 2.2-LT.
- `app/[locale]/(player)/me/profile/page.tsx` — карточка
  `ExternalRatingCard` над формой профиля.
- `app/[locale]/(player)/me/find/find-client.tsx` — фильтр-блок «Лига
  Тенниса» (`ltOnly` + `ltEloMin/Max`) + бейдж `ExternalRatingBadge` на
  карточках кандидатов.
- `components/profile/external-rating-badge.tsx` — переиспользуемый
  компактный pill.
- `components/profile/external-rating-card.tsx` — карточка управления
  (refresh / disconnect) на странице профиля.

## 11. Что осталось «на потом» (не входит в эту итерацию)

- Бэйдж на публичной карточке тренера (`/coaches/<id>`) и в публичной
  ленте матчей. Сейчас публично виден только на собственном профиле и
  в поиске.
- Импорт исторических матчей и H2H — нужен парсинг отдельных страниц
  ligatennisa.com (без открытого API).
- Других источников (TournamentSoftware, ITF…) — пока не планируется,
  но `external_ratings.source` оставлено расширяемым enum'ом ровно
  ради этого.
- Cron-обновление: продуктовое решение — НЕ делать. Если когда-то
  захотим, обсудить отдельно правовую сторону и rate-limit upstream.
