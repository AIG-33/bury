"use client";

import { Link, usePathname } from "@/i18n/routing";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  Trophy,
  BarChart3,
  UserCircle,
  HelpCircle,
  Sliders,
  Star,
  Database,
  type LucideIcon,
} from "lucide-react";

// Icons live in the client bundle so server components can pass plain string
// names without violating the Server → Client serialization boundary.
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  venues: Building2,
  calendar: CalendarDays,
  trophy: Trophy,
  chart: BarChart3,
  user: UserCircle,
  help: HelpCircle,
  sliders: Sliders,
  star: Star,
  database: Database,
};

export type SectionNavIconName = keyof typeof ICONS;

export type SectionNavItem = {
  href: string;
  label: string;
  icon?: SectionNavIconName;
  /** Visual emphasis: turns this tab into a filled grass pill regardless of active state. */
  emphasis?: boolean;
};

type Props = {
  items: readonly SectionNavItem[];
  /** Optional accent color override; defaults to grass. */
  accent?: "grass" | "clay";
};

/**
 * Premium sub-navigation used by route groups (admin, coach).
 * - Glass capsule, scroll-through tabs.
 * - Active tab gets a filled grass pill; hover gets the same pill at low opacity.
 * - Sticks just below the global TopNav so the user always sees where they are.
 */
export function SectionNav({ items, accent = "grass" }: Props) {
  const pathname = usePathname();

  const palette =
    accent === "clay"
      ? {
          activeBg: "bg-clay-700",
          activeText: "text-white",
          activeRing: "shadow-[0_8px_22px_-8px_rgba(136,54,35,0.55)]",
          hoverBg: "hover:bg-clay-50",
          hoverText: "hover:text-clay-800",
        }
      : {
          activeBg: "bg-grass-700",
          activeText: "text-white",
          activeRing: "shadow-[0_8px_22px_-8px_rgba(21,94,54,0.55)]",
          hoverBg: "hover:bg-grass-50",
          hoverText: "hover:text-grass-800",
        };

  return (
    <div className="sticky top-14 z-30 border-b border-ink-200/50 bg-white/55 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center px-5 py-2.5 md:px-10">
        <nav
          aria-label="Section"
          className="flex h-10 items-center gap-0.5 overflow-x-auto rounded-full border border-ink-200/70 bg-white/70 px-1.5 backdrop-blur-md"
        >
          {items.map((it) => {
            const active =
              pathname === it.href || pathname.startsWith(`${it.href}/`);
            const Icon = it.icon ? ICONS[it.icon] : undefined;
            return (
              <Link
                key={it.href}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                href={it.href as any}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium tracking-tight transition-all duration-300 ease-followthrough",
                  active
                    ? `${palette.activeBg} ${palette.activeText} ${palette.activeRing}`
                    : `text-ink-700 ${palette.hoverBg} ${palette.hoverText}`,
                ].join(" ")}
              >
                {Icon && (
                  <Icon
                    className={[
                      "h-4 w-4 transition-transform duration-300",
                      active ? "" : "group-hover:scale-110",
                    ].join(" ")}
                  />
                )}
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
