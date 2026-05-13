import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/routing";

// Cross-link card used to bridge two semantically-adjacent pages.
//
// Example: on /open-matches we show "didn't find a match? — find a partner
// by filters in /me/find OR browse all players in /players". This avoids
// the user being stuck on a single discovery surface and bouncing.
//
// The component is intentionally lightweight — secondary visual weight,
// always below the primary content — so it never competes with the page
// itself. Pass 1–3 items.
//
// `Link` is the locale-aware import from `@/i18n/routing`; `href` is
// passed through as the canonical pathname (no leading locale).

export type BridgeItem = {
  href: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
};

type Props = {
  title: string;
  items: BridgeItem[];
};

export function BridgePanel({ title, items }: Props) {
  if (items.length === 0) return null;
  return (
    <aside
      aria-label={title}
      className="rounded-xl2 border border-ink-100 bg-ink-50/40 p-4 sm:p-5"
    >
      <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
        {title}
      </p>
      <ul
        className={[
          "grid gap-2",
          items.length === 1 ? "" : "sm:grid-cols-2",
        ].join(" ")}
      >
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                href={it.href as any}
                className="group flex items-start gap-3 rounded-lg border border-ink-100 bg-white px-3.5 py-3 transition hover:border-grass-200 hover:bg-white"
              >
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-grass-50 text-grass-700 ring-1 ring-grass-200/70"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-display text-[14px] font-semibold tracking-tight text-ink-900">
                    {it.label}
                    <ArrowRight className="h-3.5 w-3.5 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-grass-700" />
                  </span>
                  {it.hint ? (
                    <span className="mt-0.5 block text-[12.5px] text-ink-600">
                      {it.hint}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
