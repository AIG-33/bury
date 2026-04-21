# help-demo — copy/paste reference

Snippets below are the **canonical shape** of help primitives in this project. Adapt the strings, never the structural pattern.

## 1. HelpPanel at the top of an admin/coach page

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HelpPanel } from "@/components/help/help-panel";

type Props = { params: Promise<{ locale: string }> };

export default async function CoachPlayersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coach.players");

  return (
    <div className="space-y-6">
      <HelpPanel
        pageId="coach-players"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />
      {/* page body */}
    </div>
  );
}
```

Matching translation block (must exist in **pl, en, ru**):

```jsonc
// messages/ru/app.json (excerpt)
{
  "coach": {
    "players": {
      "help": {
        "why": "Сюда тренер приглашает игроков и видит их статус в клубе. Без приглашения игрок не попадёт в матчи и рейтинг.",
        "what": {
          "1": "Отправь приглашение по email или ссылке.",
          "2": "Отметь игроков, которые ушли (архив, не удаление).",
          "3": "Перепроверь, у кого не подтверждён email."
        },
        "result": {
          "1": "Приглашённый игрок получит письмо со ссылкой на регистрацию.",
          "2": "В таблице появится строка со статусом «pending»; после регистрации статус сменится на «active»."
        }
      }
    }
  }
}
```

## 2. HelpTooltip inline in JSX

```tsx
import { HelpTooltip } from "@/components/help/help-tooltip";

<p>
  Текущий{" "}
  <span className="inline-flex items-center gap-1 font-medium">
    K-фактор <HelpTooltip term="k_factor" />
  </span>{" "}
  игрока — 40.
</p>
```

The `term` value must match a key in `messages/{locale}/help.json` → `glossary.<term>` in **all three locales**:

```jsonc
// messages/ru/help.json (excerpt — pattern is the same in en/pl)
{
  "glossary": {
    "k_factor": {
      "title": "K-фактор",
      "body": "Коэффициент чувствительности рейтинга. Чем выше — тем сильнее меняется Elo после одного матча."
    }
  }
}
```

For one-off, page-specific hints that don't belong in the global glossary, pass `description` directly instead of relying on the glossary lookup:

```tsx
<HelpTooltip
  term="match-comped-here"
  title="Бесплатный матч"
  description="Матч засчитывается в рейтинг, но не списывает оплату с тренера."
/>
```

## 3. FlowDiagram for multi-step flows

```tsx
import { FlowDiagram } from "@/components/help/flow-diagram";

<FlowDiagram
  currentStep={2}
  steps={[
    { id: "basic", label: t("flow.basic") },
    { id: "format", label: t("flow.format") },
    { id: "rules", label: t("flow.rules") },
    { id: "players", label: t("flow.players") },
    { id: "confirm", label: t("flow.confirm") },
  ]}
/>
```

Keep `id` values aligned with the corresponding URL segments or form-step keys so the user's mental model and the diagram stay in sync. Pass `variant="vertical"` for sidebars or narrow columns.

## 4. EmptyState — never leave a list blank

```tsx
import { EmptyState } from "@/components/help/empty-state";

{players.length === 0 ? (
  <EmptyState
    title={t("empty.title")}
    description={t("empty.description")}
    ctaLabel={t("empty.cta")}
    ctaHref="/coach/players/invite"
  />
) : (
  <PlayersTable rows={players} />
)}
```

Required translation shape:

```jsonc
{
  "empty": {
    "title": "Пока ни одного игрока",
    "description": "Пригласи первого игрока — он получит email и сможет зарегистрироваться по ссылке.",
    "cta": "Пригласить игрока"
  }
}
```

If the CTA needs a callback rather than a link, pass an `action` ReactNode instead of `ctaLabel`/`ctaHref`.

## 5. Confirmation dialog copy for destructive actions

Destructive actions (`AGENTS.md` §3.8) require copy that names every consequence. Template:

```
Заголовок: «Удалить турнир „<name>"?»
Тело:      «Будут удалены 12 матчей этого турнира.
            История Elo игроков сохранится — рейтинг не пересчитается.
            Действие нельзя отменить.»
Кнопки:    «Отмена»  /  «Удалить турнир» (destructive variant)
```

Apply the same shape to `pl` and `en`. If consequences differ between roles (player vs coach), spell out both.

## 6. Quick lint pass before declaring "done"

```bash
npm run lint && npm run format:check
```

If a new domain term was introduced, also grep all three locales:

```bash
rg "glossary\\.<new_term>" messages/
```

All three locale files must hit. If any locale is missing, the page is not done.
