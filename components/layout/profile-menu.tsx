"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/routing";
import { ChevronDown, ListChecks, User } from "lucide-react";

type Item = {
  href: string;
  label: string;
  icon: "user" | "matches";
};

type Props = {
  label: string;
  items: readonly Item[];
};

type Coords = { top: number; right: number } | null;

/**
 * Compact dropdown that lives inside the centre capsule of TopNav for
 * authenticated users. Keeps the "profile" pill behaviour (active dot,
 * hover underline) and adds a popover with secondary "me/*" entries
 * (currently: my profile + my matches).
 *
 * The popover is rendered via a React portal on document.body because
 * the parent <nav> uses `overflow-x-auto`, which (per CSS spec) also
 * clips the y-axis and would otherwise hide the dropdown.
 */
export function ProfileMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<Coords>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const active = items.some(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Position the popover under the button, anchored to its right edge.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      setCoords({
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const popover =
    open && coords ? (
      <div
        ref={popRef}
        role="menu"
        style={{
          position: "fixed",
          top: coords.top,
          right: coords.right,
          zIndex: 1000,
        }}
        className="min-w-[220px] overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[0_22px_48px_-20px_rgba(15,27,20,0.35)]"
      >
        <ul className="py-1.5">
          {items.map((it) => {
            const isActive =
              pathname === it.href || pathname.startsWith(`${it.href}/`);
            const Icon = it.icon === "user" ? User : ListChecks;
            return (
              <li key={it.href}>
                <Link
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  href={it.href as any}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={[
                    "flex items-center gap-2.5 px-3.5 py-2.5 font-display text-[13.5px] tracking-tight transition-colors",
                    isActive
                      ? "bg-grass-50 font-bold text-grass-900"
                      : "font-semibold text-ink-800 hover:bg-grass-50/60 hover:text-grass-900",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "h-4 w-4",
                      isActive ? "text-grass-700" : "text-ink-500",
                    ].join(" ")}
                  />
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          "group relative inline-flex h-9 items-center gap-1.5 rounded-full px-3",
          "font-display text-[13px] tracking-tight transition-all duration-300 ease-followthrough",
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
        {label}
        <ChevronDown
          className={[
            "h-3.5 w-3.5 text-ink-500 transition-transform duration-200",
            open ? "rotate-180 text-grass-700" : "",
          ].join(" ")}
        />
      </button>
      {mounted && popover ? createPortal(popover, document.body) : null}
    </>
  );
}
