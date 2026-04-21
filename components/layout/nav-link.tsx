"use client";

import { Link, usePathname } from "@/i18n/routing";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  highlight?: boolean;
};

/**
 * Compact pill nav link used inside the centre capsule of TopNav.
 * - Underline animates from left on hover.
 * - Active route gets a tiny lime "ball" dot before the label and a permanent
 *   underline.
 * - "highlight" variant (coach/admin) renders as a filled grass pill instead.
 */
export function NavLink({ href, children, highlight = false }: Props) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  if (highlight) {
    return (
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={href as any}
        className={[
          "group relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold tracking-tight transition-all duration-300 ease-followthrough",
          active
            ? "bg-grass-700 text-white shadow-[0_6px_16px_-6px_rgba(21,94,54,0.5)]"
            : "bg-grass-50 text-grass-800 hover:bg-grass-100",
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

  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={href as any}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium tracking-tight transition-colors duration-300 ease-followthrough",
        active
          ? "text-grass-800"
          : "text-ink-700 hover:text-grass-800",
      ].join(" ")}
    >
      {/* tiny lime dot for active link */}
      {active && (
        <span
          aria-hidden
          className="mr-1.5 inline-block h-1 w-1 rounded-full bg-grass-500 shadow-[0_0_6px_rgba(31,138,76,0.6)]"
        />
      )}
      <span className="relative">
        {children}
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute -bottom-1 left-0 right-0 h-px origin-left bg-grass-700 transition-transform duration-500 ease-followthrough",
            active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
          ].join(" ")}
        />
      </span>
    </Link>
  );
}
