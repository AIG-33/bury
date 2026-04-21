---
name: help-demo
description: >-
  Maintains the canonical "/help-demo" reference page for the AlexB Tennis Club
  project and enforces the help-content rules from AGENTS.md (§3.4, §8) on every
  admin or coach page. Use when creating or editing pages under
  app/[locale]/(admin)/ or app/[locale]/(coach)/, when working on any file in
  components/help/, when editing app/[locale]/(public)/help-demo/page.tsx, or
  when the user mentions HelpPanel, HelpTooltip, FlowDiagram, EmptyState,
  "не понятно для чего", "why this page", glossary, or help copy.
---

# help-demo — canonical reference for the help system

## What this skill is for

The project has a hard rule (`AGENTS.md` §3.4 and §8): every admin and coach page must explain itself with three blocks — **Зачем эта страница / Что можно сделать / Что произойдёт после** — and every domain term (K-фактор, super-tiebreak, walkover, snake-seeding, RRULE, comped, no-ad, ...) must be wrapped in `<HelpTooltip>`.

The page at `app/[locale]/(public)/help-demo/page.tsx` is the **single source of truth** for what those help primitives look like. Coaches and future contributors visit `/help-demo` to see the pattern, then copy it into their own pages.

This skill does two things:

1. Keeps `/help-demo` itself self-explanatory (it must follow the rules it demonstrates).
2. Pushes every new admin/coach page to mirror the patterns shown there.

## Required help primitives

All four live in `components/help/` — never reinvent them, never inline alternatives.

| Primitive | File | When to use |
|---|---|---|
| `HelpPanel` | `components/help/help-panel.tsx` | One per admin/coach page, at the top, with `pageId`, `why`, `what[]`, `result[]`. |
| `HelpTooltip` | `components/help/help-tooltip.tsx` | Inline next to any domain term. Pulls copy from `messages/{locale}/help.json` → `glossary.<term>`. |
| `FlowDiagram` | `components/help/flow-diagram.tsx` | Multi-step flows (draw generation, onboarding, registration). |
| `EmptyState` | `components/help/empty-state.tsx` | Any list/table that can be empty. Must include `title`, `description`, and a CTA. |

## Acceptance checklist for `/help-demo`

The demo page is **not done** unless every item is true. Run through this list whenever the page is touched.

- [ ] Page begins with its own `<HelpPanel pageId="help-demo">` answering: **why this page exists in the project**, **what a coach should do here**, **what changes after they apply the patterns**.
- [ ] Each of the four sections (HelpPanel / HelpTooltip / FlowDiagram / EmptyState) has:
  - a one-sentence "когда использовать" line above the demo,
  - a working example rendered with realistic copy (not "lorem ipsum", not "test"),
  - a "скопируй в свою страницу" hint pointing to `reference.md` snippets.
- [ ] Header copy answers the visitor's first question in one sentence: **"Это эталонная страница: посмотри, скопируй в свой экран, добавь в свои переводы."** No marketing tone.
- [ ] Every glossary term shown in the tooltip section is also defined in `messages/{pl,en,ru}/help.json` under `glossary.<term>`.
- [ ] All copy exists in `messages/pl/app.json`, `messages/en/app.json`, `messages/ru/app.json` under `helpDemo.*`. No locale missing a key.
- [ ] The link from the landing page (`app/[locale]/page.tsx` → `/help-demo`) uses a CTA label that names the destination's purpose, not just "Demo". Suggested keys: `landing.hero.cta_secondary` = `"Посмотреть help-компоненты"` / `"See help components"` / `"Zobacz komponenty pomocy"`.

## Acceptance checklist for any new admin / coach page

Treat this as a blocking gate — if any item fails, the page is not ready for review.

- [ ] Top of the page renders `<HelpPanel pageId="<unique-id>" why={…} what={[…]} result={[…]} />`. The `pageId` is unique across the app (used as the localStorage key for collapse state).
- [ ] `why` = one paragraph in plain language. No jargon. If jargon is unavoidable, wrap it in `<HelpTooltip>`.
- [ ] `what` = 3–5 bullets, each starting with an action verb ("Создай...", "Запусти...", "Отметь...").
- [ ] `result` = bullets describing what changes **for the coach AND for the player** after the action ("Игрок получит email с приглашением. В таблице приглашений появится строка со статусом «отправлено»."). Never leave a single-perspective result.
- [ ] Every domain term in JSX has `<HelpTooltip term="..." />` next to it. The `term` key matches `messages/{locale}/help.json` → `glossary.<term>`.
- [ ] Multi-step flows have `<FlowDiagram steps={[...]} currentStep={n} />`.
- [ ] Every list/table that can be empty has `<EmptyState>` with a CTA (no blank screens — see `AGENTS.md` §3.6).
- [ ] Destructive actions go through a confirmation dialog whose copy names the consequences ("Будут удалены 12 матчей. История Elo сохранится.").
- [ ] All new strings exist in **all three** locales (pl, en, ru) — see `AGENTS.md` §3.7.

## Workflow when adding a new admin/coach page

1. Open `app/[locale]/(public)/help-demo/page.tsx` and the matching translation block in `messages/ru/app.json` → `helpDemo.*`. Use them as the structural template.
2. Copy the `HelpPanel` snippet from `reference.md` and rename `pageId`.
3. Draft `why / what / result` copy in Russian first (project default for help text), then translate to PL and EN. All three locale files must be updated in the same change.
4. For every domain term you mention in the UI:
   - check if `glossary.<term>` already exists in `messages/{locale}/help.json`;
   - if not, add it to **all three** locale files before using `<HelpTooltip term="..." />`.
5. If the page contains a wizard/multi-step flow, wire `<FlowDiagram>` with the same step ids as the URL segments or form steps — keep the user's mental model and the diagram in sync.
6. For every list rendered on the page, supply an `<EmptyState>` branch.
7. Run the acceptance checklist above. Do not call the work done until every box is ticked.

## Common mistakes to fix on sight

- HelpPanel exists but `why` is empty / vague ("Управление страницей"). Rewrite to answer: "Зачем коучу этот экран в принципе?".
- `result[]` describes only the coach side ("Турнир будет создан"). Add the player side ("Игроки увидят анонс в своей ленте и получат push-уведомление.").
- A term like "K-фактор" or "walkover" appears in plain text without `<HelpTooltip>`. Wrap it.
- `<EmptyState>` without a CTA. Add `ctaLabel` + `ctaHref`, or an inline `action` button.
- New string added only to `ru` — PL and EN missing. All three must exist.
- New `pageId` collides with an existing one (localStorage will share collapse state). Pick a unique slug, e.g. `coach-players`, `admin-tournaments-create`.

## Reference snippets

Concrete copy/paste templates for HelpPanel, HelpTooltip, FlowDiagram, EmptyState, and matching translation JSON live in [reference.md](reference.md). Read it when you need the actual code, not before.
