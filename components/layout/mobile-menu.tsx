"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/routing";
import { Menu, X, LogOut, LogIn } from "lucide-react";

export type MobileMenuItem = {
  href: string;
  label: string;
  highlight?: boolean;
};

type Props = {
  items: readonly MobileMenuItem[];
  authed: boolean;
  labels: { open: string; close: string; logout: string; login: string };
};

/**
 * Hamburger menu shown on small screens. Renders a full-bleed sheet via a
 * portal on document.body so the overlay isn't trapped by the sticky
 * <header> (which establishes a containing block via backdrop-filter).
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
          <span className="font-display text-base font-bold text-grass-900">
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
          className="flex-1 overflow-y-auto px-3 py-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <ul className="flex flex-col gap-1">
            {items.map((it) => {
              const active =
                pathname === it.href || pathname.startsWith(`${it.href}/`);
              return (
                <li key={it.href}>
                  <Link
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    href={it.href as any}
                    onClick={() => setOpen(false)}
                    className={[
                      "flex h-12 items-center rounded-xl px-4 text-[15px] font-medium transition-colors",
                      active
                        ? "bg-grass-700 text-white"
                        : it.highlight
                          ? "bg-grass-50 text-grass-800"
                          : "text-ink-800 hover:bg-ink-50",
                    ].join(" ")}
                  >
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className="border-t border-ink-100 p-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        >
          {authed ? (
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink-200 bg-white text-[13px] font-semibold uppercase tracking-wider text-clay-700"
              >
                <LogOut className="h-4 w-4" />
                {labels.logout}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-grass-700 text-[13px] font-semibold uppercase tracking-wider text-white"
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200/70 bg-white/60 text-ink-700 backdrop-blur-md md:hidden"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {open && mounted ? createPortal(overlay, document.body) : null}
    </>
  );
}
