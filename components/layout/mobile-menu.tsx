"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/routing";
import { Globe2, LogIn, LogOut, Menu, UserRound, X } from "lucide-react";

export type MobileMenuItem = {
  href: string;
  label: string;
  highlight?: boolean;
  /** Visual group — used to render a section header before the first item. */
  group: "personal" | "public";
};

type Props = {
  items: readonly MobileMenuItem[];
  authed: boolean;
  labels: {
    open: string;
    close: string;
    logout: string;
    login: string;
    group_personal: string;
    group_public: string;
  };
};

/**
 * Hamburger menu shown on small screens. Renders a full-bleed sheet via a
 * portal on document.body so the overlay isn't trapped by the sticky
 * <header> (which establishes a containing block via backdrop-filter).
 *
 * Items are rendered in two visually distinct sections — "personal" (logged-in
 * destinations) and "public" (open to everyone) — to mirror the desktop split.
 */
export function MobileMenu({ items, authed, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const grouped = useMemo(() => {
    const personal = items.filter((i) => i.group === "personal");
    const publicItems = items.filter((i) => i.group === "public");
    return { personal, public: publicItems };
  }, [items]);

  const renderGroup = (
    rows: MobileMenuItem[],
    eyebrow: string,
    icon: "personal" | "public",
  ) => {
    if (rows.length === 0) return null;
    const Icon = icon === "personal" ? UserRound : Globe2;
    const tint =
      icon === "personal"
        ? "bg-grass-50 text-grass-800 ring-grass-200/70"
        : "bg-ink-50 text-ink-700 ring-ink-200/70";
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2 pb-1 pt-3">
          <span
            aria-hidden
            className={`grid h-6 w-6 place-items-center rounded-full ring-1 ${tint}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="font-display text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-500">
            {eyebrow}
          </span>
          <span className="ml-2 h-px flex-1 bg-gradient-to-r from-ink-200/80 to-transparent" />
        </div>
        <ul className="flex flex-col gap-1">
          {rows.map((it) => {
            const active =
              pathname === it.href || pathname.startsWith(`${it.href}/`);
            return (
              <li key={it.href}>
                <Link
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={it.href as any}
                  onClick={() => setOpen(false)}
                  className={[
                    "flex h-12 items-center rounded-xl px-4 font-display text-[15px] tracking-tight transition-colors",
                    active
                      ? "bg-grass-700 font-bold text-white shadow-[0_10px_24px_-12px_rgba(21,94,54,0.55)]"
                      : it.highlight
                        ? "bg-grass-50 font-bold text-grass-800 ring-1 ring-grass-200/70"
                        : "font-semibold text-ink-800 hover:bg-ink-50",
                  ].join(" ")}
                >
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[100] md:hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={labels.close}
        onClick={() => setOpen(false)}
        className="absolute inset-0 h-full w-full bg-ink-900/45 backdrop-blur-sm"
      />
      {/* Sheet */}
      <div className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <span className="font-display text-base font-extrabold tracking-tight text-grass-900">
            Bury Tennis
          </span>
          <button
            type="button"
            aria-label={labels.close}
            onClick={() => setOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 pb-3 pt-1"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          {renderGroup(grouped.personal, labels.group_personal, "personal")}
          {renderGroup(grouped.public, labels.group_public, "public")}
        </nav>

        <div
          className="border-t border-ink-100 p-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        >
          {authed ? (
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink-200 bg-white font-display text-[13px] font-bold uppercase tracking-[0.16em] text-clay-700 hover:bg-clay-50"
              >
                <LogOut className="h-4 w-4" />
                {labels.logout}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-grass-700 font-display text-[13px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_12px_28px_-12px_rgba(21,94,54,0.6)]"
            >
              <LogIn className="h-4 w-4" />
              {labels.login}
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        aria-label={labels.open}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200/70 bg-white/70 text-ink-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white md:hidden"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {open && mounted ? createPortal(overlay, document.body) : null}
    </>
  );
}
