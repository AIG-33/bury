# AGENTS.md — Rules for AI coding agents

These rules apply to **any AI agent (Cursor, Claude, GPT, etc.)** modifying this repository. They are non-negotiable. Read this file before any change.

## 1. Stack — fixed

Do **not** swap libraries without explicit approval.

- Next.js 15 App Router, TypeScript `strict: true`, RSC + Server Actions
- Tailwind CSS + `tailwind-merge` + `clsx` (helpers in `lib/utils.ts`)
- shadcn/ui (components copied into `components/ui/`, NOT a dep)
- next-intl for i18n (PL default, EN, RU)
- Supabase (`@supabase/ssr` for SSR, `@supabase/supabase-js` for client)
- Zod + react-hook-form for forms
- TanStack Query for client cache only (server data flows through RSC/actions)
- Framer Motion for animations
- Recharts for graphs
- date-fns + `date-fns-tz` (default `Europe/Warsaw`)
- Resend for email, grammY for Telegram
- MapLibre GL + OSM for maps (no API key)
- Vitest for unit, Playwright for e2e
- Sentry, PostHog (opt-in)

## 2. Project structure — respect it

```
app/[locale]/(public|player|coach|admin)/...
app/api/{telegram,cron,resend-webhook}/route.ts
components/{ui,domain,help}/...
lib/{supabase,rating,tournament,matching,dates,validators,utils.ts}
messages/{pl,en,ru}/{app,help,emails,telegram}.json
supabase/{migrations,functions,seed.sql,config.toml}
e2e/...
docs/...
```

Never put domain logic in `components/ui/`. UI primitives only.

## 3. Definition of Done (DoD) for every iteration

A feature is **NOT done** unless ALL of these are true:

1. TypeScript compiles with no `any` (use `unknown` + Zod parse).
2. ESLint + Prettier pass (`npm run lint && npm run format:check`).
3. New domain logic has Vitest tests (Elo, draw, validators, quiz scoring — non-negotiable).
4. **Every admin page** has a `<HelpPanel>` with three blocks: **Зачем эта страница / Что можно сделать / Что произойдёт после**.
5. **Every term** (K-фактор, snake-seeding, super-tiebreak, RRULE, walkover, DSQ, comped, no-ad, ...) has an inline `<HelpTooltip>`.
6. **Empty states** are not blank — they have purpose text + a CTA.
7. New strings are added to all three locales (`pl`, `en`, `ru`). Use the locale of the source language as draft for others if unsure, but **all three keys must exist**.
8. Destructive actions go through a confirmation dialog that names the consequences ("12 matches will be deleted, Elo history will be preserved").
9. Migrations are forward-only (no destructive edits to existing migration files).
10. RLS policy exists for every new table — no exceptions.

## 4. Style and conventions

- File names: `kebab-case.ts` for non-components, `PascalCase.tsx` for components.
- Server Actions: `"use server"` at top, inputs validated with Zod, return `{ ok: true, data }` or `{ ok: false, error }`.
- Database access in components is FORBIDDEN. Always go through `lib/supabase/server.ts` or a Server Action.
- No `console.log` in committed code. Use `console.warn` / `console.error` only with context.
- Comments only for non-obvious WHY. No narrating comments.
- Use `tabular-nums` for any score/rating display.

## 5. Secrets

- Never commit `.env.local`. Only `.env.example`.
- Never log secrets. Never print full tokens.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose to the browser.
- Webhook handlers verify signatures (Resend, Telegram).

## 6. i18n rules

- All user-facing strings via `useTranslations()` / `getTranslations()`.
- Never hardcode "Save", "Cancel", etc. in JSX.
- Date formatting uses `Intl.DateTimeFormat` via `lib/dates`.
- Number/currency formatting uses `Intl.NumberFormat`.
- Email & Telegram templates pick the recipient's `locale` from `profiles.locale`.

## 7. Database rules

- All tables have RLS ON.
- All FKs have ON DELETE behavior explicitly chosen (CASCADE / SET NULL / RESTRICT).
- Use `uuid` PKs (`gen_random_uuid()`).
- `created_at` / `updated_at` columns on every table; `updated_at` via trigger.
- JSONB columns have a Zod schema in `lib/validators/`.
- Long-running computations (Elo recalc, draw generation) go through Postgres functions or Edge Functions, NOT Server Actions.

## 8. Help-panel content rules

`<HelpPanel title why what result />` props:

- `why` — one paragraph, plain language, no jargon.
- `what` — bullet list (3–5 items), action verbs.
- `result` — bullet list, what changes for the coach AND for the player after the action.

If the page involves a multi-step flow, add `<FlowDiagram steps={[...]} currentStep={n} />`.

If a term is non-obvious — wrap it in `<HelpTooltip term="K-фактор" />` that pulls the definition from `messages/{locale}/help.json` under `glossary.k_factor`.

## 9. Commit & branching

- Conventional commits: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `refactor: ...`, `test: ...`.
- Do NOT commit unless the user explicitly asks (`git commit`).
- Never `git push --force` to `main`/`master`.
- Never `git config` changes.

## 10. When in doubt

- Re-read [docs/TZ.md](docs/TZ.md).
- Re-read [docs/AI_BUILD_PLAN.md](docs/AI_BUILD_PLAN.md) for the current iteration's acceptance criteria.
- If the user changes scope mid-iteration, update the relevant doc BEFORE writing code.
- Ask the user 1–2 sharp questions instead of guessing on architectural choices.
