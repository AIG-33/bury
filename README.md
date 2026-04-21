# Aliaksandr Bury Tennis Platform

Tennis platform for the club of **Aliaksandr Bury** — former ATP doubles #59, Swiss Open Gstaad 2015 champion (with Denis Istomin), now a coach. Project is being developed in **Poland**.

This is **not just a club admin app**. It is a platform for amateur tennis with:

- **Universal Elo rating** that travels with the player across any tournament/match in the system.
- **4-tab player cabinet**: Rating, Tournaments, Find a Player, Profile.
- **Find a Player** matching by district + level (Elo ±100) + preferred time.
- **Coach reviews and ratings** with anti-fraud tied to bookings/matches.
- **Onboarding quiz** with editable questions and a configurable starting-Elo algorithm.
- **Tournaments** in 6 formats (SE / DE / RR / Group+PO / Swiss / Compass) with flexible match rules (best-of-3/5, single set, pro-set 8/10, super-tiebreak only, timed match, first-to-X-games, no-ad, etc.).
- **In-app guidance**: every admin page has a `HelpPanel` explaining "Why this page / What you can do / What will happen".

## Stack

- **Frontend**: Next.js 15 (App Router, RSC, Server Actions), TypeScript strict, Tailwind, shadcn/ui, Framer Motion, TanStack Query, Zod, react-hook-form, next-intl.
- **Backend**: Supabase (Postgres 15, Auth, Storage, Realtime, Edge Functions).
- **Hosting**: Vercel.
- **Notifications**: Resend (email — primary) + WhatsApp click-to-chat (`wa.me`, primary contact channel in PL). Optional: grammY (Telegram bot, secondary). WhatsApp Business API integration is planned for Phase 2.
- **Map** (coaches): MapLibre GL + OpenStreetMap.

## Languages

`pl` (default) · `en` · `ru`

## Documentation

| File | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Rules for AI coding agents working in this repo |
| [docs/TZ.md](docs/TZ.md) | Full product specification |
| [docs/AI_BUILD_PLAN.md](docs/AI_BUILD_PLAN.md) | 14-iteration build plan with acceptance criteria |
| [docs/diagrams/data-model.md](docs/diagrams/data-model.md) | DB schema (ER + DDL) |
| [docs/diagrams/user-flows.md](docs/diagrams/user-flows.md) | Sequence diagrams for key flows |
| [docs/design-tokens.md](docs/design-tokens.md) | Design system, palette, typography, components |
| [docs/copy-deck.md](docs/copy-deck.md) | UI copy in PL/EN/RU with tennis humor |
| [docs/admin-help.md](docs/admin-help.md) | Help-panel content for every admin page |
| [docs/rating-algorithm.md](docs/rating-algorithm.md) | Elo + onboarding quiz + seasonal race spec |

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

Iterations 1–3 complete: scaffold + auth + onboarding quiz + invitations. Next: profile editing and "Find a Player" (Iterations 4–6).
