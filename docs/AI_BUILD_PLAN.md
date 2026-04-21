# AI Build Plan — 14 Iterations

For every iteration: **goal · files · steps · acceptance criteria · tests · do-not-do**.

**Sweeping DoD (every iteration)**: see [AGENTS.md](../AGENTS.md) §3. In particular: every admin page has a `<HelpPanel>`; every term has a `<HelpTooltip>`; every empty state has purpose text + CTA.

---

## Iteration 1 — Scaffold

**Goal**: `npm run dev` starts. Localized landing (PL/EN/RU). Demo page with `<HelpPanel>`, `<HelpTooltip>`, `<FlowDiagram>` working.

**Files**:
- `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.mjs`, `eslint.config.mjs`, `prettier.config.mjs`
- `app/[locale]/layout.tsx`, `app/[locale]/page.tsx` (landing)
- `app/[locale]/(public)/help-demo/page.tsx`
- `components/ui/*` (button, card, dialog, input, badge — shadcn)
- `components/help/{HelpPanel,HelpTooltip,FlowDiagram,EmptyState}.tsx`
- `lib/utils.ts` (cn helper), `lib/supabase/{client,server,service}.ts`
- `messages/{pl,en,ru}/{app,help}.json`
- `i18n.ts`, `middleware.ts` (next-intl routing)
- `.env.example`, `.gitignore`

**Steps**:
1. `npx create-next-app@latest . --ts --tailwind --eslint --app --import-alias "@/*"` (no src dir).
2. Install deps (see commands below).
3. `npx shadcn@latest init` (defaults: Slate, CSS variables yes).
4. Add base shadcn components: `button card dialog input label badge dropdown-menu sonner tabs tooltip popover sheet`.
5. Configure next-intl: `i18n.ts` + `middleware.ts` + `app/[locale]/layout.tsx`.
6. Implement Help components (own, not shadcn).
7. Landing page with hero (Bury silhouette + "Twój tenisowy ranking, bez kompromisów"), features grid, language switcher.
8. Demo page `/help-demo` showing all three Help components.

**Acceptance**:
- `npm run dev` → http://localhost:3000 returns landing in PL.
- `/en` and `/ru` work.
- `/help-demo` shows working HelpPanel (collapsible), HelpTooltip (`?` opens popover), FlowDiagram (5-step horizontal).
- ESLint + Prettier configured, `npm run lint` passes.
- TypeScript strict, no `any`.

**Tests**: smoke test that landing renders and language switch works (Vitest + RTL).

**Do NOT**: install Supabase deps yet (next iteration), don't write any DB code.

---

## Iteration 2 — DB + Auth + admin shell

**Goal**: All ~20 tables created with RLS. Magic-link auth works. After login, empty `/coach/dashboard` page with HelpPanel.

**Files**:
- `supabase/config.toml`, `supabase/migrations/0001_init.sql`, `supabase/seed.sql`
- `lib/supabase/{client,server,service,types.ts}` (full types from Supabase)
- `app/[locale]/(auth)/login/page.tsx`, `app/[locale]/(auth)/callback/route.ts`
- `app/[locale]/(coach)/coach/dashboard/page.tsx`
- `app/[locale]/(player)/me/profile/page.tsx` (placeholder)
- `app/api/auth/signout/route.ts`
- `middleware.ts` (extend with auth gate for /coach, /admin, /me)

**Steps**:
1. `supabase init`, configure `config.toml` (Europe/Warsaw, PLN as default in our app, not Supabase).
2. Write `0001_init.sql` per [data-model.md](diagrams/data-model.md).
3. RLS policies for every table.
4. Trigger: on `auth.users` insert → create `profiles` row, set locale from raw_user_meta.
5. `seed.sql`: create one admin user (Bury), one default `quiz_version` with 10 questions, one default `rating_algorithm_config`.
6. Login page with email magic-link form + Google OAuth button.
7. Callback route: exchange code → set cookie → redirect to `/coach/dashboard` (if coach) or `/me/profile`.
8. Dashboard page with HelpPanel: "Что это", "Что можно", "Что произойдёт".

**Acceptance**:
- `npx supabase db reset` runs without errors.
- Logging in via magic-link creates profile row.
- `/coach/dashboard` shows HelpPanel + greeting; redirects to login if anonymous.
- All RLS policies present (script `select count(*) from pg_policies where schemaname='public'` ≥ 30).

**Tests**: Vitest unit on auth helpers; manual test of magic-link locally (mailpit catches Supabase emails).

**Do NOT**: build full coach dashboard widgets — placeholder OK.

---

## Iteration 3 — Onboarding quiz + Invitations

**Goal**: Player goes through quiz → start Elo computed and stored. Coach sends invite → player accepts via link.

**Files**:
- `app/[locale]/onboarding/quiz/page.tsx`, `actions.ts`
- `app/[locale]/(coach)/coach/players/page.tsx`, `actions.ts`
- `app/[locale]/invite/[token]/page.tsx`, `actions.ts`
- `lib/rating/start-elo.ts` (+ Vitest)
- `lib/quiz/engine.ts` (loads active version + computes score)
- `lib/email/send.ts` (Resend wrapper, mock if no key)
- `messages/{pl,en,ru}/emails.json` (invitation template)

**Steps**:
1. Server Action `startQuiz()` returns active `quiz_version` + questions.
2. Client form (react-hook-form + Zod) — one question per screen with `<FlowDiagram>` showing progress.
3. Server Action `submitQuiz(answers)` → `lib/quiz/engine.ts` → `lib/rating/start-elo.ts` → write `quiz_answers` + `profiles.current_elo` + `profiles.elo_status='provisional'`.
4. Coach page: list of players + "Send invitation" dialog (single + bulk CSV).
5. Server Action `createInvitation(email, ...)` generates token (32-byte random, store hash), inserts row, calls Resend (or logs to console if no key).
6. `/invite/[token]` page: validates token, prompts for magic-link/Google, on success links player to coach + redirects to quiz.

**Acceptance**:
- Quiz completes → profile has Elo (800–2200) + `elo_provisional_until_match_n = 10`.
- Invitation email is sent (or printed in dev console with full link).
- Accepting invite logs in user, redirects to quiz, links to coach.
- HelpPanel on `/coach/players`, `/onboarding/quiz`, `/invite/[token]`.

**Tests**:
- Vitest: `start-elo.ts` with all branches (low/high answers, clamping).
- Vitest: token hashing, expiration logic.

**Do NOT**: build profile editing yet (Iteration 4); don't wire automated messengers (Iteration 13 — Telegram bot, WhatsApp Business API).

---

## Iteration 4 — Player profile (Tab 4)

**Goal**: Player can fully edit profile, including socials, availability, district, privacy.

- Form sections (collapsible cards): personal, contacts, socials, location, sport prefs, availability, privacy, notifications.
- Photo upload to Supabase Storage (bucket `avatars`, RLS).
- HelpTooltip on every non-obvious field.
- Save with optimistic UI.

---

## Iteration 5 — Tab 1 (Rating)

**Goal**: Player sees current Elo, history graph, race position (placeholder), top coaches placeholder.

- `lib/rating/history.ts`
- Recharts line graph of `rating_history` (last 20 matches).
- Race widget (calls `lib/rating/race.ts`, returns placeholder until Iteration 12).
- Top-20 coaches placeholder card.

---

## Iteration 6 — Tab 3 (Find a Player)

**Goal**: Filters work, list returns matches in <100ms locally, "Propose match" creates `matches` row in `proposed`.

- `lib/matching/find-player.ts` — query builder + tests.
- Filters UI: district multi-select, Elo range slider, availability multi-select.
- Result card: avatar, name, district, Elo, common availability slots, button "Propose Match".
- Server Action `proposeMatch(opponent_id)` → insert `matches` row + add to `notifications_outbox`.
- Page `/me/find/proposals` — incoming + sent.

---

## Iteration 7 — Elo recompute + match score entry

**Goal**: Confirming a match recomputes both players' Elo with provisional-period boost.

- Postgres function `recalc_match_elo(uuid)` — transactional, locks both profiles, writes `rating_history`.
- Server Action `submitMatchScore` → calls function.
- For non-tournament matches: requires both players to confirm OR coach override.
- Vitest: simulate sequence of matches, assert Elo trajectories.

---

## Iteration 8 — Venues + Courts + Slots + Bookings

**Goal**: Coach can create venues/courts, generate slots from RRULE, players can book.

- CRUD pages with HelpPanel.
- `slot_templates` UI: form with RRULE builder (preset day-of-week + time + duration + repeat-until).
- Generation: Server Action `materializeSlots(template_id, until)` → inserts into `slots`.
- Anti-overlap via gist constraint.
- Player view: `/me/find/courts` filter by district + day → list of free slots.
- Booking flow: confirm dialog → `bookings` row → notification.
- Coach finance table with paid/unpaid/comped toggle.

---

## Iteration 9 — Tournaments core

**Goal**: 5-step wizard creates tournament. Single Elimination + Round Robin work end-to-end.

- Wizard steps with `<FlowDiagram>`: Basic → Format → Match Rules → Participants → Confirm.
- `lib/tournament/draw.ts`: SE bracket generator, RR pairs generator.
- `lib/tournament/score-validation.ts`: validates `match_rules` JSONB.
- Bracket UI: SVG-based, responsive.
- Auto-advance winner.
- Manual seeding: drag-and-drop.

---

## Iteration 10 — Tab 2 (Tournaments) for player + public tournament page

- Player sees own tournaments, can register to open ones.
- Public `/tournaments/[id]` shows bracket and participant list.
- Score entry by tournament owner (or designated player) with full `match_rules` validation.

---

## Iteration 11 — Coach reviews + public coach profile

- Review form with category checkboxes + stars + text.
- Anti-fraud trigger: insert allowed only if reviewer has booking/match with target_coach in last 90 days.
- Coach reply.
- Public `/coaches/[slug]` page.
- Top-20 coach leaderboard widget for Tab 1.
- Flag → moderation queue.

---

## Iteration 12 — Admin block

- `/admin/onboarding-quiz`: CRUD questions with weights, version preview, publish (creates new `quiz_versions` row).
- `/admin/algorithm`: form for `rating_algorithm_config` JSONB (base, K factors, multipliers, season scoring), versioned.
- `/admin/seasons`: create season, scoring, prizes; current race standings; close season action.
- `/admin/moderation`: review flags, take actions.

---

## Iteration 13 — Notifications: Email outbox + WhatsApp deep-links + Telegram (secondary) + cron reminders

> **Channel priority (Poland-focused):**
> 1. **WhatsApp** — primary contact channel for player↔player and player↔coach (`wa.me` click-to-chat links, no API). Wired via `lib/contact/whatsapp.ts`.
> 2. **Email (Resend)** — primary channel for *automated* notifications (invitations, booking confirms, results, season summaries).
> 3. **Telegram (grammY)** — optional secondary channel for users who toggle `notification_telegram = true`.
> 4. **WhatsApp Business API** (Twilio / Meta Business Cloud) — postponed to Phase 2; will replace email as the primary automated channel once approved.

Tasks:

- `lib/contact/whatsapp.ts` — `wa.me` link helper used everywhere a player/coach contact is shown (Find a Player, coach card, match proposal page).
- `app/api/telegram/webhook/route.ts` (grammY) — handle `/start <token>` to link chat (only when `TELEGRAM_BOT_TOKEN` is set).
- `lib/notifications/render.ts` — pick template + locale + render (email + telegram payloads).
- Cron `app/api/cron/reminders/route.ts` (Vercel Cron) — reads outbox, sends via Email/Telegram, marks delivered/failed/retry.
- Outbox row schema reserves a `whatsapp` channel value for Phase 2 wiring.
- Triggers writing to outbox: invitation, booking confirm/cancel/reminder, tournament events, match proposed/accepted/declined, Elo change, season end.

---

## Iteration 14 — Phase 2 polish + production hardening

- Tournaments: Group+PO, Swiss, Double Elimination, Compass.
- Coach map (MapLibre + OSM) on `/coaches`.
- First-run onboarding tour for coach (6 steps).
- `/help` glossary and FAQ page.
- A11y pass (WCAG AA).
- Sentry + PostHog.
- Playwright e2e: auth, quiz, propose match, score entry, tournament create.
- Rate-limit on public APIs.
- Vercel + Supabase prod deploy + runbook.

---

## Install commands (used in Iteration 1)

```bash
# Already done by create-next-app: next, react, typescript, tailwind, eslint
npm i next-intl @supabase/ssr @supabase/supabase-js \
      zod react-hook-form @hookform/resolvers \
      @tanstack/react-query \
      framer-motion lucide-react \
      date-fns date-fns-tz \
      recharts \
      class-variance-authority clsx tailwind-merge \
      resend grammy \
      maplibre-gl
npm i -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom \
        @playwright/test prettier prettier-plugin-tailwindcss \
        supabase
npx shadcn@latest init
npx shadcn@latest add button card dialog input label badge dropdown-menu sonner tabs tooltip popover sheet form select checkbox radio-group switch textarea separator skeleton calendar
```

## Required env vars

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=                  # optional in dev (falls back to console.log)
RESEND_FROM=Bury Tennis <noreply@example.com>
TELEGRAM_BOT_TOKEN=              # optional in dev (bot disabled)
TELEGRAM_WEBHOOK_SECRET=
SENTRY_DSN=                      # optional
NEXT_PUBLIC_POSTHOG_KEY=         # optional
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
```
