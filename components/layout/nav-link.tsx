"use client";

import { Link, usePathname } from "@/i18n/routing";
import type { ReactNode } from "react";

type Tone = "personal" | "public" | "highlight";

type Props = {
  href: string;
  children: ReactNode;
  /**
   * `personal` — link inside the green-tinted "your zone" capsule.
   * `public`   — link inside the neutral "club" capsule.
   * `highlight`— filled grass pill (coach / admin entry).
   */
  tone?: Tone;
  /** @deprecated use `tone="highlight"` instead. Kept for old call-sites. */
  highlight?: boolean;
};

/**
 * Compact pill nav link used inside the centre capsules of TopNav.
 *
 * Visual rules per tone:
 *  - personal: bold ink-900 text, active = grass-700 text + soft grass-100
 *    pill background with a tiny lime "ball" + faint glow.
 *  - public:   semibold ink-700 text, active = grass-800 text + animated
 *    underline (no background) so the public group reads "lighter".
 *  - highlight: filled grass pill for elevated destinations.
 */
export function NavLink({ href, children, tone, highlight = false }: Props) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const resolvedTone: Tone = highlight ? "highlight" : (tone ?? "public");

  if (resolvedTone === "highlight") {
    return (
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={href as any}
        className={[
          "group relative inline-flex h-9 items-center gap-1.5 rounded-full px-3.5",
          "font-display text-[13px] font-bold tracking-tight",
          "transition-all duration-300 ease-followthrough",
          active
            ? "bg-grass-800 text-white shadow-[0_10px_24px_-10px_rgba(21,94,54,0.65)]"
            : "bg-grass-50 text-grass-800 ring-1 ring-grass-200/60 hover:-translate-y-0.5 hover:bg-grass-100 hover:ring-grass-300/80 hover:shadow-[0_8px_22px_-12px_rgba(21,94,54,0.45)]",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={[
            "h-1.5 w-1.5 rounded-full transition-colors duration-300",
            active ? "bg-ball-300" : "bg-grass-500 group-hover:bg-grass-700",
          ].join(" ")}
        />
        {children}
      </Link>
    );
  }

  if (resolvedTone === "personal") {
    return (
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={href as any}
        aria-current={active ? "page" : undefined}
        className={[
          "group relative inline-flex h-9 items-center gap-1.5 rounded-full px-3",
          "font-display text-[13px] tracking-tight",
          "transition-all duration-300 ease-followthrough",
          active
            ? "bg-white font-bold text-grass-900 shadow-[0_8px_20px_-12px_rgba(31,138,76,0.5)] ring-1 ring-grass-300/60"
            : "font-semibold text-ink-800 hover:-translate-y-0.5 hover:bg-white/70 hover:text-grass-900",
        ].join(" ")}
      >
        {active && (
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-grass-500 shadow-[0_0_8px_rgba(31,138,76,0.85)]"
          />
        )}
        {children}
      </Link>
    );
  }

  // tone === "public"
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={href as any}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative inline-flex h-9 items-center gap-1.5 rounded-full px-3",
        "font-display text-[13px] tracking-tight",
        "transition-all duration-300 ease-followthrough",
        active
          ? "font-bold text-grass-900"
          : "font-semibold text-ink-700 hover:text-grass-900",
      ].join(" ")}
    >
      {active && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-grass-600 shadow-[0_0_6px_rgba(31,138,76,0.7)]"
        />
      )}
      <span className="relative">
        {children}
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute -bottom-1 left-0 right-0 h-[2px] origin-left rounded-full bg-gradient-to-r from-grass-600 to-grass-800",
            "transition-transform duration-500 ease-followthrough",
            active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
          ].join(" ")}
        />
      </span>
    </Link>
  );
}
