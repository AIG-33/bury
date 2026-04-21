"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const LANGS = [
  { code: "pl", label: "PL", full: "Polski" },
  { code: "en", label: "EN", full: "English" },
  { code: "ru", label: "RU", full: "Русский" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function change(next: string) {
    startTransition(() => {
      router.replace(pathname, { locale: next as "pl" | "en" | "ru" });
      setOpen(false);
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="inline-flex h-9 items-center gap-1 rounded-full border border-ink-200/70 bg-white/60 px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-700 backdrop-blur-md transition-all duration-300 ease-followthrough hover:-translate-y-0.5 hover:bg-white hover:text-grass-800 disabled:opacity-60"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {locale.toUpperCase()}
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-2xl border border-ink-200/70 bg-white/85 shadow-[0_16px_40px_-18px_rgba(15,27,20,0.25)] backdrop-blur-xl"
        >
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => change(l.code)}
                role="option"
                aria-selected={l.code === locale}
                className={`flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] transition-colors duration-200 hover:bg-grass-50 ${
                  l.code === locale
                    ? "bg-grass-50 font-semibold text-grass-800"
                    : "text-ink-700"
                }`}
              >
                <span>{l.full}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  {l.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
