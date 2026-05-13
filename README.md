# PlayTennis.by — Open Amateur-Tennis Platform of Belarus

A platform for **everyone who plays amateur tennis in Belarus** — players of any level, coaches and small clubs. Find a sparring partner, find a coach, join or run a tournament — all in one place.

This is **not a single-club admin app**. It is an open, community-owned platform for amateur tennis with:

- **Find a sparring partner** by district + level + preferred time, plus an open-matches feed where anyone can post or apply.
- **Coach directory** with reviews and ratings, anti-fraud tied to bookings/matches.
- **Tournaments** in 6 formats (SE / DE / RR / Group+PO / Swiss / Compass) with flexible match rules (best-of-3/5, single set, pro-set 8/10, super-tiebreak only, timed match, first-to-X-games, no-ad, etc.) — anyone can join a tournament or create their own.
- **4-tab player cabinet**: Find, Tournaments, Rating, Profile.
- **Onboarding** in two paths: a 60-second self-eval quiz, or a one-click rating import from Liga Tennisa.
- **Universal Elo rating** in the background — keeps matchmaking fair without becoming the headline.
- **In-app guidance**: every admin page has a `HelpPanel` explaining "Why this page / What you can do / What will happen".

Launch city: **Минск**. District-aware matching is wired for the whole country, so any club, court or coach in Belarus can join with no per-instance fork.

## Stack

- **Frontend**: Next.js 15 (App Router, RSC, Server Actions), TypeScript strict, Tailwind, shadcn/ui, Framer Motion, TanStack Query, Zod, react-hook-form, next-intl.
- **Backend**: Supabase (Postgres 15, Auth, Storage, Realtime, Edge Functions).
- **Hosting**: Vercel.
- **Notifications**: Resend (email — primary) + WhatsApp click-to-chat (`wa.me`, primary contact channel in Belarus). Optional: grammY (Telegram bot, secondary). WhatsApp Business API integration is planned for Phase 2.
- **Map** (coaches): MapLibre GL + OpenStreetMap.

## Languages

`ru` (default) · `en`

## Documentation

| File                                                       | Purpose                                          |
| ---------------------------------------------------------- | ------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                                     | Rules for AI coding agents working in this repo  |
| [docs/TZ.md](docs/TZ.md)                                   | Full product specification                       |
| [docs/AI_BUILD_PLAN.md](docs/AI_BUILD_PLAN.md)             | 14-iteration build plan with acceptance criteria |
| [docs/diagrams/data-model.md](docs/diagrams/data-model.md) | DB schema (ER + DDL)                             |
| [docs/diagrams/user-flows.md](docs/diagrams/user-flows.md) | Sequence diagrams for key flows                  |
| [docs/design-tokens.md](docs/design-tokens.md)             | Design system, palette, typography, components   |
| [docs/copy-deck.md](docs/copy-deck.md)                     | UI copy in EN/RU with tennis humor               |
| [docs/admin-help.md](docs/admin-help.md)                   | Help-panel content for every admin page          |
| [docs/rating-algorithm.md](docs/rating-algorithm.md)       | Elo + onboarding quiz + seasonal race spec       |
| [docs/external-ratings.md](docs/external-ratings.md)       | Liga Tennisa import (architecture + privacy)     |

## Quick start

```bash
cp .env.example .env.local
# fill in Supabase keys at minimum
npm install
npx supabase start          # local Postgres + auth on Docker
npx supabase db reset       # apply migrations + seed
npm run dev                 # http://localhost:3000
```

See [docs/AI_BUILD_PLAN.md](docs/AI_BUILD_PLAN.md) §1 for full setup.

## Status

Iterations 1–3 complete: scaffold + auth + onboarding quiz + invitations. Liga Tennisa import flow available at `/onboarding/import-lt`. Next: profile editing and "Find a Player" (Iterations 4–6).

## Project ethos

PlayTennis.by is built for the **whole amateur-tennis community of Belarus** — not for one club, one coach or one player. Anyone with a court, a coaching practice or just a racket is welcome to register and use the same find-a-sparring engine, the same tournament engine and the same coach directory as everyone else. Code, schema and content live in this repository so the project can be audited, forked or self-hosted by clubs that prefer to run their own instance.
