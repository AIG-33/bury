"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/routing";
import {
  Activity,
  CalendarDays,
  GraduationCap,
  HelpCircle,
  LifeBuoy,
  LogIn,
  LogOut,
  MapPin,
  Medal,
  Menu,
  ShieldCheck,
  Swords,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

// =============================================================================
// Burger tab of the mobile-app tab bar: the 5th slot opens a bottom-sheet
// (same visual language as MFilterTool in m-header-tools.tsx) listing every
// app destination that doesn't have its own tab, grouped личное / разделы /
// инфо. Rendered through a portal — the tab bar's backdrop-blur creates a
// containing block that would otherwise trap the fixed overlay.
// =============================================================================

export type MMenuLabels = {
  title: string;
  open: string;
  close: string;
  group_personal: string;
  group_sections: string;
  group_info: string;
  profile: string;
  my_matches: string;
  my_tournaments: string;
  my_clubs: string;
  game: string;
  coaches: string;
  venues: string;
  players: string;
  matches_feed: string;
  leaderboard: string;
  help: string;
  support: string;
  privacy: string;
  logout: string;
  login: string;
};

type MenuItem = { href: string; label: string; icon: LucideIcon };

type Props = {
  /** Tab-bar caption under the burger icon («Меню»). */
  label: string;
  labels: MMenuLabels;
  authed: boolean;
};

export function MMenuSheet({ label, labels, authed }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close after in-app navigation (Link click keeps the component mounted).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const personal: MenuItem[] = authed
    ? [
        { href: "/m/profile", label: labels.profile, icon: UserRound },
        { href: "/me/matches", label: labels.my_matches, icon: CalendarDays },
        { href: "/m/tournaments?tab=mine", label: labels.my_tournaments, icon: Trophy },
        { href: "/me/clubs", label: labels.my_clubs, icon: Users },
      ]
    : [];

  const sections: MenuItem[] = [
    { href: "/m/game", label: labels.game, icon: Swords },
    { href: "/coaches", label: labels.coaches, icon: GraduationCap },
    { href: "/venues", label: labels.venues, icon: MapPin },
    { href: "/players", label: labels.players, icon: UsersRound },
    { href: "/matches", label: labels.matches_feed, icon: Activity },
    { href: "/leaderboard", label: labels.leaderboard, icon: Medal },
  ];

  const info: MenuItem[] = [
    { href: "/help", label: labels.help, icon: HelpCircle },
    { href: "/support", label: labels.support, icon: LifeBuoy },
    { href: "/privacy", label: labels.privacy, icon: ShieldCheck },
  ];

  const renderGroup = (eyebrow: string, items: MenuItem[]) => {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[1.2px] text-[#8AA093]">
          {eyebrow}
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={item.href as any}
                  onClick={() => setOpen(false)}
                  className="flex h-12 items-center gap-3 rounded-[13px] px-2 transition-colors active:bg-[#EFF5E7]"
                >
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-[linear-gradient(135deg,#E7F4D9,#D3ECC4)] text-grass-600">
                    <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                  </span>
                  <span className="font-display text-[14px] font-bold text-ink-900">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const overlay = (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={labels.close}
        className="absolute inset-0 bg-grass-900/40"
        onClick={() => setOpen(false)}
      />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-[18px] pt-4"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          animation: "mMenuSheetUp 250ms cubic-bezier(.4,0,.2,1) both",
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-100" aria-hidden />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-extrabold tracking-[-0.4px] text-grass-900">
            {labels.title}
          </h2>
          <button
            type="button"
            aria-label={labels.close}
            className="grid h-9 w-9 place-items-center rounded-[12px] border border-[rgba(20,60,30,0.1)] bg-white text-grass-900 transition-opacity active:opacity-85"
            onClick={() => setOpen(false)}
          >
            <X className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-3 max-h-[62dvh] space-y-4 overflow-y-auto pb-2">
          {renderGroup(labels.group_personal, personal)}
          {renderGroup(labels.group_sections, sections)}
          {renderGroup(labels.group_info, info)}
        </div>

        <div className="mt-2 border-t border-[rgba(20,60,30,0.07)] pt-3">
          {authed ? (
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] border border-clay-200 bg-white font-display text-[14px] font-bold text-clay-600 transition-opacity active:opacity-85"
              >
                <LogOut className="h-4 w-4" />
                {labels.logout}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-pt-primary font-display text-[15px] font-extrabold text-white shadow-[0_10px_22px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85"
            >
              <LogIn className="h-4 w-4" />
              {labels.login}
            </Link>
          )}
        </div>
      </div>
      <style>{`@keyframes mMenuSheetUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );

  return (
    <>
      <button
        type="button"
        aria-label={labels.open}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={[
          "flex flex-1 flex-col items-center justify-center gap-[3px] pb-1 pt-0.5 transition-opacity duration-150 active:opacity-85",
          open ? "text-grass-600" : "text-[#9AAB9F]",
        ].join(" ")}
      >
        <Menu className="h-[23px] w-[23px]" strokeWidth={1.8} />
        <span className="font-display text-[10px] font-bold leading-none">{label}</span>
      </button>

      {open && mounted ? createPortal(overlay, document.body) : null}
    </>
  );
}
