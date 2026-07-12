"use client";

import { Link, usePathname } from "@/i18n/routing";
import { Home, Swords, Trophy, GraduationCap, UserRound } from "lucide-react";

export type BottomTabItem = {
  href: string;
  label: string;
  icon: "home" | "sparrings" | "tournaments" | "coaches" | "profile";
  badge?: number;
};

type Props = {
  items: readonly BottomTabItem[];
};

const ICONS = {
  home: Home,
  sparrings: Swords,
  tournaments: Trophy,
  coaches: GraduationCap,
  profile: UserRound,
} as const;

/**
 * Mobile-only bottom tab bar.
 *
 * Sits fixed at the bottom of the viewport on `< md`. Provides 5 always-on
 * shortcuts to the most-used destinations so any feature is one tap away.
 *
 * The page layout reserves vertical space via `.pb-mobile-nav` (applied on
 * the root `<footer>` so the bar never overlaps real content).
 */
export function BottomTabBar({ items }: Props) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-[600px] px-3 pb-2 pt-2">
        <ul
          className={[
            "grid grid-cols-5 items-stretch gap-0.5 rounded-3xl",
            "border border-[rgba(20,60,30,0.08)] bg-white/90 shadow-[0_18px_60px_-20px_rgba(15,27,20,0.2)]",
            "backdrop-blur-[16px]",
          ].join(" ")}
        >
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ||
              (item.href === "/" && pathname === "/");
            return (
              <li key={item.href} className="relative">
                <Link
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={item.href as any}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 font-display text-[10.5px] font-semibold tracking-tight transition-all duration-200 ease-out",
                    active
                      ? "bg-pt-primary text-white shadow-glow"
                      : "text-ink-500 hover:text-grass-700",
                  ].join(" ")}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span className="truncate leading-none">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute right-2 top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-clay-500 px-1 text-[9.5px] font-bold leading-none text-white ring-2 ring-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
