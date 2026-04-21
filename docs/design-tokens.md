# Design tokens & components

## Palette

| Token | Hex | Usage |
|---|---|---|
| `white` | `#FFFFFF` | Base background |
| `grass-500` (Wimbledon) | `#1F8A4C` | Primary actions, accents |
| `grass-50` | `#EAF7EE` | HelpPanel background, subtle surfaces |
| `grass-700` | `#155E36` | Hover, depth |
| `ball-500` (neon yellow) | `#D7F205` | Highlights, badges |
| `ball-200` | `#F2FBA8` | Soft highlight |
| `clay-500` | `#C75B3A` | Warning / attention |
| `clay-100` | `#F8DCD0` | Soft warning bg |
| `ink-900` | `#0F1B14` | Text primary |
| `ink-500` | `#5B6A60` | Text secondary |
| `ink-200` | `#D7DDD9` | Borders |
| `error` | `#C2391E` | Errors |
| `success` | `#1F8A4C` | Success |
| `info` | `#2D6CDF` | Info |

Contrast notes: yellow `#D7F205` is light — only use on `ink-900` text or as decorative element. Not for white-text labels.

## Typography

```ts
// next/font
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";

export const fontDisplay = Bricolage_Grotesque({ subsets: ["latin","latin-ext"], variable: "--font-display" });
export const fontSans    = Inter({ subsets: ["latin","latin-ext","cyrillic"], variable: "--font-sans" });
export const fontMono    = JetBrains_Mono({ subsets: ["latin","latin-ext","cyrillic"], variable: "--font-mono" });
```

Scale (Tailwind classes):
- Display XL: `text-5xl md:text-6xl font-display font-bold tracking-tight`
- Display L: `text-3xl md:text-4xl font-display font-semibold`
- H2: `text-2xl font-display font-semibold`
- H3: `text-xl font-display font-medium`
- Body: `text-base font-sans`
- Small: `text-sm font-sans`
- Score/Elo numbers: `font-mono tabular-nums tracking-tight`

## Tailwind theme extends

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        grass: { 50:"#EAF7EE", 100:"#D2EFD8", 200:"#A6E0B5", 300:"#74CB91", 400:"#43B26F", 500:"#1F8A4C", 600:"#187341", 700:"#155E36", 800:"#11472A", 900:"#0B2E1B" },
        ball:  { 50:"#FBFEDD", 100:"#F8FDB8", 200:"#F2FBA8", 300:"#EAF876", 400:"#E2F644", 500:"#D7F205", 600:"#B5CB04", 700:"#8FA303", 800:"#6A7902", 900:"#454F01" },
        clay:  { 50:"#FBEEE9", 100:"#F8DCD0", 200:"#EFB6A0", 300:"#E48F70", 400:"#DA7548", 500:"#C75B3A", 600:"#A8482D", 700:"#883623", 800:"#69281A", 900:"#451810" },
        ink:   { 50:"#F4F6F5", 100:"#E6EBE8", 200:"#D7DDD9", 300:"#B6BFB9", 400:"#8C988F", 500:"#5B6A60", 600:"#445048", 700:"#2D352F", 800:"#1B2620", 900:"#0F1B14" },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans:    ["var(--font-sans)",    "ui-sans-serif", "system-ui"],
        mono:    ["var(--font-mono)",    "ui-monospace",  "monospace"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        card: "0 1px 2px rgba(15,27,20,0.04), 0 8px 24px -12px rgba(15,27,20,0.12)",
        ace:  "0 0 0 4px #D7F205, 0 8px 24px -8px #1F8A4C",
      },
    },
  },
};
```

## Help components — spec

### `<HelpPanel />`

```tsx
type HelpPanelProps = {
  pageId: string;                                  // for localStorage key
  why: React.ReactNode;                            // 1 paragraph
  what: string[] | React.ReactNode[];              // 3–5 bullets
  result: string[] | React.ReactNode[];            // 2–4 bullets
  defaultCollapsed?: boolean;
};
```

Rendering:
- Card with `bg-grass-50 border border-grass-100 rounded-xl2`.
- Tennis-ball icon (lucide `Circle` filled with `ball-500`) + title from i18n key `help.panel.title` ("Что это за раздел").
- Three sections with green dot bullets.
- "Hide" button stores `tennis.help.{pageId}=false` in `localStorage`.
- "Show again" link in `/me/profile` settings.

### `<HelpTooltip />`

```tsx
type HelpTooltipProps = {
  term: string;                                    // glossary key
  size?: "sm" | "md";
};
```

Renders `?` icon (lucide `HelpCircle`, `text-grass-500`) wrapped in shadcn Popover. Content from `messages/{locale}/help.json` under `glossary.<term>` (with `title` and `body`).

### `<FlowDiagram />`

```tsx
type FlowDiagramProps = {
  steps: { id: string; label: string; description?: string }[];
  currentStep: number;
  variant?: "horizontal" | "vertical";
};
```

Horizontal: pill-shaped steps connected by dashed line; current step has `bg-grass-500 text-white`, completed `bg-grass-200`, future `bg-ink-100 text-ink-500`.

### `<EmptyState />`

```tsx
type EmptyStateProps = {
  illustration?: "ball" | "racket" | "court";       // SVG decorative
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
};
```

## Animations (Framer Motion)

- **Bounce** (`bounce` preset) — primary CTA hover.
- **Ace** — green ring expands then fades on success (toast).
- **Let cord** — small horizontal shake on validation error.
- **Score pop** — number scale 1.0→1.15→1.0 on Elo change.

## Accessibility

- Focus ring: `outline outline-2 outline-offset-2 outline-grass-500` on all interactive.
- Min tap target 44×44px.
- All icons inside buttons have aria-label.
- HelpPanel collapse button is `aria-expanded`.
