"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * Compact dropdown that lives inside the centre capsule of TopNav for
 * authenticated users. Keeps the "profile" pill behaviour (active dot,
 * hover underline) and adds a small popover with secondary "me/*" entries
 * (currently: my profile + my matches). Closes on outside click, Escape,
 * and route change.
 */
export function ProfileMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement>(null);

  const active = items.some(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={wrapRef} className="relative">
      <button
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

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[180px] overflow-hidden rounded-xl border border-ink-200/70 bg-white/95 shadow-lg backdrop-blur-md"
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
      )}
    </div>
  );
}
