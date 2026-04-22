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
        className="min-w-[200px] overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-[0_18px_40px_-18px_rgba(15,27,20,0.35)]"
      >
        <ul className="py-1">
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
                    "flex items-center gap-2 px-3 py-2 text-[13px] transition-colors",
                    isActive
                      ? "bg-grass-50 text-grass-800"
                      : "text-ink-800 hover:bg-ink-50",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 text-ink-500" />
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
          "group relative inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium tracking-tight transition-colors duration-300 ease-followthrough",
          active ? "text-grass-800" : "text-ink-700 hover:text-grass-800",
        ].join(" ")}
      >
        {active && (
          <span
            aria-hidden
            className="mr-1.5 inline-block h-1 w-1 rounded-full bg-grass-500 shadow-[0_0_6px_rgba(31,138,76,0.6)]"
          />
        )}
        <span className="relative">
          {label}
          <span
            aria-hidden
            className={[
              "pointer-events-none absolute -bottom-1 left-0 right-0 h-px origin-left bg-grass-700 transition-transform duration-500 ease-followthrough",
              active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
            ].join(" ")}
          />
        </span>
        <ChevronDown
          className={[
            "h-3 w-3 text-ink-500 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {mounted && popover ? createPortal(popover, document.body) : null}
    </>
  );
}
