# Интернационализация PlayTennis — аудит и план

> Статус: **аудит / план работ** (июль 2026). Код не менялся — этот документ описывает, что и где нужно поменять, чтобы платформа работала в любой стране с фильтрами «страна → город».
>
> Контекст: проект уже пережил один географический pivot (Варшава/PL → Беларусь/BY, миграция `20260510000000_belarus_relocation.sql`). Тогда страна была «зашита» повторно — теперь задача сделать географию параметром, а не константой.
>
> Тексты (i18n-строки, fastlane, маркетинг) параллельно правит другой агент — здесь они только отмечены, править их в рамках этого плана не нужно.

---

## 1. Текущее состояние — краткая карта проблем

| Область | Что сейчас | Основные точки в коде |
|---|---|---|
| География в БД | `country text` есть у `profiles`, `districts`, `venues` (default `'BY'`); города — **свободный текст**; у `clubs` и `tournaments` страны нет вообще | `20260421000000_init.sql`, `20260510000000_belarus_relocation.sql`, `20260515000000_clubs_membership.sql` |
| Фильтры/выдачи | ~10 лоадеров жёстко фильтруют `.eq("country", "BY")`; каталоги фильтруют по district/city, страны в UI нет | `app/[locale]/{players,coaches,tournaments,venues,open-matches}/…`, `lib/seo/sitemap-data.ts` |
| Валюта | BYN зашит в именах колонок (`entry_fee_byn`, `price_byn`, `coach_hourly_rate_byn`) и в ~11 i18n-ключах на локаль («{n} BYN»); `Intl.NumberFormat` для денег не используется | ~47 файлов с `_byn` |
| Часовой пояс | `Europe/Minsk` зашит в 6+ местах, включая фиксированный офсет UTC+3 в дедлайнах регистрации | `i18n/request.ts`, `app/[locale]/layout.tsx`, `lib/tournaments/applications.ts`, `lib/slots/expand.ts`, `lib/notifications/templates.ts`, `lib/mobile/format.ts` |
| Локали | ru (default) + en; список локалей продублирован в коде и **в CHECK-констрейнтах БД** | `i18n/routing.ts`, `profiles_locale_check`, `notifications_outbox_locale_check`, `lib/seo/site.ts` |
| Телефоны | Валидатор в профиле уже нейтральный, но в `lib/contact/whatsapp.ts` живёт легаси-логика «9 цифр → +48 (Польша)» | `lib/profile/schema.ts`, `lib/contact/whatsapp.ts` |
| Карты | Центр/зум карты тренеров и пикера — Беларусь/Минск константами; геокодер Nominatim уже глобальный | `components/map/coach-map.tsx`, `components/map/coach-location-picker.tsx` |
| SEO | `COUNTRY_CODE = "BY"`, минские keywords, JSON-LD `addressCountry: "BY"`, sitemap только BY-площадки; домен playtennis.by | `lib/seo/site.ts`, `lib/seo/metadata.ts`, `app/[locale]/players/[id]/page.tsx`, `lib/seo/sitemap-data.ts` |
| Интеграции | Лига Тенниса (ligatennisa.com) вросла в онбординг, поиск соперника, карточки игроков, автоклуб | `lib/rating/external/*`, `lib/clubs/liga-tennisa.ts`, `lib/matching/find-player.ts` |

---

## 2. География в данных

### 2.1 Что есть сейчас

- `districts` — справочник районов: `(id, country text default 'BY', city text, name, slug, lat, lng)`. Город внутри district — свободный текст; сам справочник засеян только Беларусью (`belarus_relocation`: Минск ×9 районов, областные центры, райцентры).
- `profiles`: `country text default 'BY'`, `city text` (free text), `district_id FK → districts (ON DELETE SET NULL)`. Country в UI профиля не редактируется — все получают `'BY'` по дефолту.
- `venues`: `city text`, `district_id FK`, `country text default 'BY'` (добавлен в `belarus_relocation`), `lat/lng`.
- `clubs`: `city text`, `district_id FK` — **страны нет**.
- `tournaments`: геопривязка только через `tournament_venues` (m:n) — ни city, ни country.
- Хардкода районов Минска в `lib/`/константах **нет** — районы честно читаются из таблицы `districts`. Захардкожены только BY-города в SEO-keywords (`lib/seo/site.ts`) и центры карт.

Проблемы: города — свободный текст без нормализации («Минск» vs «минск» vs «Minsk»); у клубов и турниров нет страны, поэтому фильтр страны на их каталогах построить не из чего; district — единственный «справочный» уровень, но он имеет смысл только для больших городов.

### 2.2 Целевая модель

Двухуровневая: **страна (ISO 3166-1 alpha-2) → город (справочник) → район (опционально)**.

1. **Страны — без таблицы.** Код ISO хранится как `text` (уже так), названия локализуются через `Intl.DisplayNames(locale, { type: "region" })`. Новый модуль `lib/geo/countries.ts`: список поддерживаемых стран + конфиг per-country: `{ code, defaultCurrency, defaultTimezone, phonePrefix, mapCenter: [lng,lat], mapZoom }`. Добавление страны = одна запись в конфиге + сиды городов.

2. **Города — справочник `cities`.**

```sql
create table public.cities (
  id         uuid primary key default gen_random_uuid(),
  country    text not null,            -- ISO alpha-2
  name       text not null,            -- локальное название ("Минск", "Warszawa")
  name_en    text,                     -- транслит для en-выдачи и slug
  slug       text not null unique,     -- "by-minsk"
  lat        double precision,
  lng        double precision,
  timezone   text not null,            -- IANA, "Europe/Minsk"
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cities_country_name_idx on cities (country, lower(name));
-- RLS: select для всех, insert/update только админ (как districts).
```

   `timezone` у города решает 90 % проблемы часовых поясов (см. §5) — не нужно спрашивать tz у каждого турнира.

3. **`city_id` добавляется рядом с `city text`, а не вместо него** (forward-only, без ломки):
   - `profiles.city_id`, `clubs.city_id`, `venues.city_id` — `uuid references cities(id) on delete set null`;
   - `clubs.country text not null default 'BY'` (у clubs страны нет вовсе);
   - `tournaments.country text not null default 'BY'` + `tournaments.city_id` (денормализация: заполняется из первой привязанной площадки, редактируется организатором; нужна, потому что каталог `/tournaments` фильтруется по городу, а турнир без площадки — валидное состояние);
   - старые `city text` оставить как read-only fallback на переходный период, UI переводится на выбор из справочника (combobox с «предложить город» → админ-модерация или автосоздание с `is_active=false`).

4. **Districts остаются как есть**, но привязываются к городу: `districts.city_id uuid references cities(id)`. Для городов без районов district просто не заполняется (уже так работает: «Барановичи · Город»). Фильтр района показывается в UI только если у выбранного города есть районы.

### 2.3 Миграция данных (forward-only)

Одна миграция `..._geo_countries_cities.sql`:

1. создать `cities` + RLS + триггер `updated_at`;
2. засеять из существующих данных: `insert into cities (country, name, timezone) select distinct coalesce(country,'BY'), city, 'Europe/Minsk' from (venues ∪ districts ∪ profiles ∪ clubs) where city is not null` — с ручной чисткой дублей по `lower(name)`;
3. добавить `city_id` в `profiles/clubs/venues`, `country`+`city_id` в `tournaments`, `city_id` в `districts`;
4. бэкфилл: `city_id` по совпадению `lower(city)`; `clubs.country = 'BY'`, `tournaments.country = 'BY'`; у турниров `city_id` — из первой площадки в `tournament_venues`;
5. индексы: `(country, city_id)` на profiles/clubs/venues/tournaments; частичный `tournaments (country, status)`.

Дефолты `'BY'` на колонках можно оставить до P1 (сервер всё равно будет проставлять страну явно при создании), затем убрать default в отдельной миграции.

---

## 3. Фильтры и выдачи

### 3.1 Где сейчас зашит BY (все — заменить на параметр)

| Файл | Что делает |
|---|---|
| `app/[locale]/players/actions.ts:104` | справочник районов для фильтра `/players` |
| `app/[locale]/coaches/actions.ts:198` | опции venue/district для `/coaches` |
| `app/[locale]/tournaments/actions.ts:22-37` | `loadVenueCities()` — города для фильтра `/tournaments` |
| `app/[locale]/venues/user-actions.ts:27` | районы для формы «добавить корт» |
| `app/[locale]/open-matches/new/page.tsx:36` | районы для создания open match |
| `app/[locale]/(player)/me/find/actions.ts:67` | районы в «найти соперника» |
| `app/[locale]/(player)/me/bookings/actions.ts:627`, `me/profile/actions.ts:65` | районы в ЛК |
| `app/[locale]/(admin)/admin/venues/actions.ts:127,189` | админка площадок |
| `lib/seo/sitemap-data.ts:65` | sitemap только BY-venues |
| `app/[locale]/players/[id]/page.tsx:48` | JSON-LD `addressCountry: "BY"` |

### 3.2 Целевая механика

1. **Единый резолвер страны** — `lib/geo/resolve-country.ts` (server-side):
   - залогинен → `profiles.country`;
   - аноним → cookie `country` (если выбирал руками) → заголовок Vercel `x-vercel-ip-country` → дефолт `'BY'`.
   - Выбор страны в шапке каталогов пишет cookie и, для залогиненных, профиль.

2. **Каталоги** `/players`, `/coaches`, `/clubs`, `/venues`, `/tournaments`, `/open-matches`: лоадеры принимают `{ country, cityId?, districtId? }`; страна берётся из резолвера, город/район — из searchParams. UI: селект страны (флаг + `Intl.DisplayNames`) → селект города (из `cities` по стране) → селект района (если есть). `/venues` сейчас фильтрует город только на клиенте — перевести на серверный фильтр по `city_id`.
   - `/players`: фильтр по `profiles.country` (сейчас каталог вообще не фильтрует игроков по географии — только районы в дропдауне).
   - `/tournaments`: `loadVenueCities()` → `loadCities(country)`; фильтр по `tournaments.country/city_id`.
   - Лидерборды (`/leaderboard`, coach leaderboard): сейчас гео-фильтров нет — добавить фильтр страны (P0: `where profiles.country = $1`) и города (P1). Elo остаётся глобальным, «национальных» рейтингов не заводим — только фильтрация выдачи.

3. **«Найти соперника»** (`lib/matching` + `me/find`): SQL-фильтр кандидатов дополнить `country = seeker.country` (обязательный) и `city_id` (по умолчанию — город искателя, можно расширить). В скоринге `scoreCandidate` бонус «same district» (10 pts) разбить: same city +6 / same district +4 — в разных городах district бессмыслен. LT-фильтры (`ltOnly`, `ltEloMin/Max`) показывать только там, где провайдер доступен (§8).

4. **Публичные views** (`public_player_directory`, `public_coach_directory` и т.п.) — добавить `country`/`city_id` в select-list, чтобы фильтры работали без join'ов.

---

## 4. Валюта

### 4.1 Сейчас

- Колонки: `tournaments.entry_fee_byn`, `slots.price_byn`, `slot_templates.price_byn`, `profiles.coach_hourly_rate_byn` (все — rename из `_pln`, т.е. это уже второй «валютный» rename).
- `_byn` встречается в ~47 файлах (actions, формы, карточки, mobile-страницы `m/*`, `lib/supabase/types.ts`, views).
- i18n: «{n} BYN», «{amount} BYN / час» и т.д. — ~11 ключей на локаль; форматирование строковой подстановкой, не `Intl.NumberFormat`.

### 4.2 Целевая модель

1. **Валюта — атрибут записи**, ISO 4217:
   - `tournaments.currency char(3) not null default 'BYN'`;
   - `profiles.coach_rate_currency char(3) not null default 'BYN'`;
   - `slot_templates.currency` + денормализация в `slots` при экспансии (слоты наследуют от шаблона).
   - Дефолт при создании — из `lib/geo/countries.ts` по стране сущности (BY→BYN, PL→PLN, …). Никаких конвертаций/курсов — цена хранится в той валюте, в которой её назначили.
2. **Отображение** — единый хелпер `lib/format/money.ts`: `formatMoney(amount, currency, locale)` через `Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 })`. i18n-ключи вида «{n} BYN» превращаются в «{amount}» с готовой строкой (или `{amount} / час` там, где нужен суффикс).
3. **Переименование колонок** `_byn` → нейтральные (`entry_fee`, `price`, `coach_hourly_rate`) — делать **вторым шагом** (P1): это механический, но широкий рефактор (47 файлов + rebuild `public_coach_directory` view + `lib/supabase/types.ts`). P0 работает и со старыми именами: семантика колонки становится «сумма в валюте из соседней колонки currency», имя временно врёт — фиксируем комментарием на колонке.

Миграция данных: `update … set currency='BYN'` (покрывается default'ом), значения сумм не трогаем.

---

## 5. Часовые пояса

### 5.1 Точки хардкода `Europe/Minsk`

| Место | Что зашито |
|---|---|
| `i18n/request.ts:18` и `app/[locale]/layout.tsx:97` | `timeZone` для next-intl (сервер + клиент-провайдер) |
| `lib/tournaments/applications.ts` | дедлайн регистрации: **фиксированный офсет UTC+3** («Минск без DST») — сломается для любой страны с DST |
| `lib/slots/expand.ts` | экспансия слотов тренера: локальные даты трактуются как Minsk wall-clock, конверсия в SQL через `AT TIME ZONE 'Europe/Minsk'` |
| `lib/notifications/templates.ts:71`, `lib/mobile/format.ts:28` | форматирование дат в письмах/мобильном UI |
| `profiles.timezone default 'Europe/Minsk'` | есть в БД, но почти нигде не используется |
| `lib/seo/site.ts:16` | `TIMEZONE` для SEO |

### 5.2 Целевая модель

Принцип: **у события tz места, у пользователя tz просмотра**.

1. `cities.timezone` (§2) — источник по умолчанию. Производные: venue → tz его города; турнир → `tournaments.timezone text not null default 'Europe/Minsk'` (проставляется из города/площадки при создании, форма показывает подсказку); слоты тренера → tz тренера (`profiles.timezone`) или города его площадки.
2. `lib/tournaments/applications.ts`: заменить фиксированный `+03:00` на честную конверсию `date-fns-tz` (`zonedTimeToUtc(deadline + " 23:59:59", tournament.timezone)`). Это единственное место с «арифметикой» — остальные просто параметризуются.
3. `lib/slots/expand.ts` + SQL-слой: `'Europe/Minsk'` → параметр (tz тренера). В формах слотов подсказку «время в Europe/Minsk» заменить на tz тренера.
4. next-intl: `timeZone` в `i18n/request.ts` брать из профиля (cookie для анонимов), fallback — tz страны из резолвера (§3.2). `profiles.timezone` начать реально заполнять: при онбординге из `Intl.DateTimeFormat().resolvedOptions().timeZone`.
5. Письма/уведомления: `timeZone` — получателя (`profiles.timezone`), а для событий турнира — tz турнира с явной подписью зоны.

---

## 6. Локали

Сейчас: `ru` (default) + `en`; `localePrefix: "always"`. Локаль уже **не завязана на страну** в маршрутизации — это правильно, сохранить (страна = контент-фильтр, локаль = язык интерфейса).

Что нужно для добавления языка N (например `pl`):

1. `messages/{pl}/{app,help}.json` (+ emails/telegram, если появятся отдельными файлами);
2. `i18n/routing.ts` → `locales: ["ru","en","pl"]`; `lib/seo/site.ts` → `LOCALES` (продублирован сознательно — не забыть);
3. **БД**: `profiles_locale_check` и `notifications_outbox_locale_check` зашивают `('ru','en')` — при каждом новом языке нужна миграция drop/add constraint. Рекомендация: в ближайшей миграции заменить оба CHECK на более мягкий (`locale ~ '^[a-z]{2}(-[A-Z]{2})?$'`) и валидировать список локалей на уровне приложения (Zod) — тогда новый язык не требует миграции вообще;
4. `handle_new_user()` — default locale `'ru'`; сделать выбор из `raw_user_meta_data` (уже есть) + от Accept-Language на странице регистрации;
5. hreflang в `lib/seo/metadata.ts` строится из `LOCALES` — подхватится автоматически; `x-default` остаётся `ru` (пересмотреть, когда появится en-рынок);
6. fastlane/сторы — отдельная колея (другой агент).

Отвязка «locale → страна»: единственное реальное сцепление — SEO-keywords (минские города для ru/en) и дефолт `'ru'` для новых аккаунтов. Keywords генерить по стране (§9), дефолт локали оставить.

---

## 7. Телефоны и контакты

- `lib/profile/schema.ts` — валидатор уже нейтральный (`/^[+0-9 ()\-]*$/`), менять не обязательно.
- **`lib/contact/whatsapp.ts` — легаси Польши**: `normalizeWhatsAppNumber` дополняет 9-значный номер кодом `+48`, `formatPhoneForDisplay` красиво форматирует только `+48`. Исправить: убрать автоподстановку кода страны (номер без `+` и без кода — не нормализуем, просим пользователя ввести в международном формате) либо подставлять `phonePrefix` из страны профиля. Форматирование дисплея — универсальное `+CC …` без по-страновых шаблонов (или `libphonenumber-js`, но это +дependency — не обязательно для P0).
- Плейсхолдеры `+375 …` в формах (`components/venues/user-venue-form.tsx` и др.) — брать из `phonePrefix` страны пользователя.
- Telegram username — глобален, менять нечего. WhatsApp «primary channel» — тоже глобален.
- В хелп-текстах/подсказках упоминания «+375» правит текстовый агент.

---

## 8. Карты (MapLibre/OSM)

- `components/map/coach-map.tsx`: `BELARUS_CENTER [27.953, 53.71]`, zoom 6.4 — но карта уже делает `fitBounds` по пинам, константа — только fallback при нуле пинов. Фикс: принимать `fallbackCenter/zoom` пропсом из `mapCenter/mapZoom` страны пользователя (`lib/geo/countries.ts`).
- `components/map/coach-location-picker.tsx`: `DEFAULT_CENTER` = Минск — аналогично, центр из страны профиля.
- Геокодер: Nominatim уже глобальный (без `countrycodes`) — работает для любой страны. Улучшение (P1): передавать `countrycodes=<страна пользователя>` как bias + `accept-language=<locale>`.
- Тайлы OSM — глобальные, без привязки. Ничего не менять.

---

## 9. SEO и домен

- **Домен `playtennis.by` менять не нужно** для запуска второй страны: контент и так фильтруется страной, hreflang уже есть. Отметить варианты на будущее: (а) нейтральный домен (playtennis.app) с 301 с .by — дорого по SEO, делать только при реальном международном трекшене; (б) поддиректории `/pl/…` — конфликтуют с локальными префиксами (`/[locale]/`), не рекомендуется; (в) кантри-поддомены (pl.playtennis.by) — выглядит странно на .by. Рекомендация: остаться на .by, купить нейтральный домен «про запас» и повесить редирект.
- `lib/seo/site.ts`: `COUNTRY_CODE`, `TIMEZONE`, `BELARUS_CITY_KEYWORDS_*` — превратить в функции от страны: `cityKeywords(country, locale)` на основе таблицы `cities` (top-N по числу площадок/игроков) или статического конфига в `lib/geo`.
- `lib/seo/metadata.ts`: «tennis Minsk» в базовых keywords → генерить по стране запрошенного контента (для страниц сущностей — по стране сущности).
- JSON-LD: `addressCountry: "BY"` (`players/[id]`, вероятно venue/club-страницы) → страна сущности.
- `lib/seo/sitemap-data.ts`: убрать `.eq("country","BY")` — в sitemap должны попадать все активные площадки/сущности всех стран.
- hreflang: уже корректный (`ru`/`en`/`x-default`), при новых локалях расширяется сам (§6).

---

## 10. Лига Тенниса → «региональный модуль»

Точки врастания: `lib/rating/external/liga-tennisa.ts` (+`actions-impl`, `history`), `lib/validators/external-ratings.ts`, `lib/clubs/liga-tennisa.ts` (автоклуб `liga-tennisa`), онбординг (`import-lt/`, `lt-quick-import.tsx`), «найти соперника» (`ltOnly`, `ltEloMin/Max` в `lib/matching/find-player.ts` и UI), бейджи/карточки рейтинга, страница `/me/rating`, лидерборд тренера.

План изоляции (данные уже почти готовы: `external_ratings.source = 'liga_tennisa'` — колонка source есть):

1. **Реестр провайдеров** `lib/rating/external/providers.ts`:

```ts
export const EXTERNAL_RATING_PROVIDERS = {
  liga_tennisa: { countries: ["BY"], label: "Лига Тенниса", ... },
} as const;
export function providersForCountry(country: string) { ... }
```

2. **UI-гейтинг по стране пользователя**: шаг импорта LT в онбординге, quick-import, LT-фильтры в find-player, LT-колонки в выдачах — рендерятся только если `providersForCountry(user.country)` непуст. Для BY ничего не меняется; для второй страны модуль просто не виден.
3. Автоклуб (`lib/clubs/liga-tennisa.ts`) уже безопасен: «нет клуба со slug → no-op». Достаточно гейтинга импорта.
4. Данные не трогаем: `external_ratings` универсальна, новые провайдеры (например, локальная лига второй страны) добавляются новым `source` + адаптером в `lib/rating/external/providers/<slug>.ts`.

---

## 11. Сторы / маркетинг

`fastlane/metadata/{en-US,ru,android/*}`, описания «в Беларуси», скриншоты, SMM-материалы (`docs/smm/`) — **правит другой агент**, здесь не трогаем. Единственное пересечение с кодом: `capacitor.config.ts` и store-ссылки (`lib/mobile/store-links.ts`) — доменные, менять не требуется.

---

## 12. Фазы и приоритизация

Оценки: S — до полудня, M — 0.5–2 дня, L — 2+ дня.

### P0 — минимум для запуска во второй стране

Порядок = порядок внедрения (зависимости сверху вниз).

| # | Задача | Слой | Оценка |
|---|---|---|---|
| 1 | Модуль `lib/geo/`: список стран + per-country конфиг (валюта, tz, префикс телефона, центр карты) + `resolve-country.ts` (профиль → cookie → `x-vercel-ip-country` → 'BY') | lib | **M** |
| 2 | Миграция «geo»: таблица `cities` (+RLS), `city_id` в profiles/clubs/venues/districts, `country`+`city_id` в tournaments и clubs, бэкфилл BY, индексы | БД | **M** |
| 3 | Миграция «currency»: `currency` у tournaments/profiles/slot_templates/slots, default 'BYN', бэкфилл | БД | **S** |
| 4 | Убрать все `.eq("country","BY")` → параметр из резолвера; каталоги + лидерборды получают фильтр страны, город — из `cities` | actions/RSC | **M** |
| 5 | UI-фильтры «страна → город → район» на /players, /coaches, /clubs, /venues, /tournaments, /open-matches (район — только если есть у города) | UI | **M/L** |
| 6 | Онбординг/профиль: выбор страны и города (справочник + «предложить город»), автозаполнение tz из браузера | UI+actions | **M** |
| 7 | `formatMoney()` через `Intl.NumberFormat` + замена «{n} BYN»-ключей на `{amount}`; формы цен показывают валюту страны | lib+UI+i18n | **M** |
| 8 | «Найти соперника»: фильтр country/city в SQL-запросе кандидатов, скоринг city+district | lib/matching | **S/M** |
| 9 | Таймзоны, критичный минимум: `tournaments.timezone` + фикс UTC+3 в `applications.ts`; tz в слотах тренера параметром | БД+lib | **M** |
| 10 | Гейтинг Лиги Тенниса по стране (реестр провайдеров + скрытие UI) | lib+UI | **S/M** |
| 11 | `lib/contact/whatsapp.ts`: убрать +48-легаси, префикс из страны профиля; плейсхолдеры телефонов | lib+UI | **S** |
| 12 | Карты: fallback-центр из страны пользователя | UI | **S** |
| 13 | SEO-минимум: sitemap без BY-фильтра, JSON-LD `addressCountry` от сущности | SEO | **S** |

### P1 — удобство

| Задача | Оценка |
|---|---|
| Rename `_byn` → нейтральные имена колонок (`entry_fee`, `price`, `coach_hourly_rate`) + rebuild views + `lib/supabase/types.ts` + ~47 файлов | **L** |
| next-intl `timeZone` из профиля/cookie (сейчас останется Europe/Minsk для всех — терпимо, даты событий уже в tz события) | **M** |
| Ослабить `locale`-CHECK'и в БД (regex вместо перечисления) — новый язык без миграции | **S** |
| SEO: `cityKeywords(country, locale)` из данных, метадата каталогов по выбранной стране | **M** |
| Nominatim: `countrycodes`/`accept-language` bias; выбор города по геолокации | **S** |
| Админка городов/районов (добавление, модерация «предложенных» городов) | **M** |
| Письма/уведомления: даты в tz получателя | **M** |

### P2 — nice to have

- Третья локаль (pl/…) — по чек-листу §6.
- Нейтральный домен-алиас + стратегия hreflang/x-default для международного SEO.
- Второй провайдер внешних рейтингов как проверка изоляции модуля (§10).
- Districts для городов новых стран (импорт из OSM admin-boundaries).
- Мультивалютность платёжных интеграций (когда появятся онлайн-платежи).
- Гео-детект города по IP/геолокации с подтверждением.

### Что делать первым шагом

**P0-1 + P0-2 в одной итерации**: модуль `lib/geo/` и миграция `cities`/`country` — всё остальное (фильтры, валюта-дефолты, tz, гейтинг LT) зависит от них. Это безопасно: миграция чисто аддитивная, существующее поведение (`'BY'`-дефолты) не меняется, UI можно переключать инкрементально.
