"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe } from "lucide-react";
import { updateNotificationChannel } from "./actions";

// =============================================================================
// Client rows of the settings screen: brand-green toggles (on) / grey (off)
// for notification channels, and the language row that flips ru ↔ en in place
// (design «PlayTennis Screens», экран H).
// =============================================================================

export function ToggleRow({
  channel,
  label,
  initial,
  icon,
}: {
  channel: "email" | "telegram" | "whatsapp";
  label: string;
  initial: boolean;
  icon: React.ReactNode;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [, startTransition] = useTransition();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await updateNotificationChannel({ channel, enabled: next });
      if (!res.ok) setEnabled(!next);
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-[11px] shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85"
    >
      <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[11px] bg-pt-icon text-grass-600">
        {icon}
      </span>
      <span className="flex-1 truncate text-left font-display text-[14.5px] font-bold text-ink-900">
        {label}
      </span>
      <span
        aria-hidden
        className={[
          "relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors duration-200",
          enabled ? "bg-grass-500" : "bg-ink-100",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(20,60,30,0.25)] transition-all duration-200",
            enabled ? "left-[23px]" : "left-[3px]",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

export function LanguageRow({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const next = locale === "ru" ? "en" : "ru";
  const currentName = locale === "ru" ? "Русский" : "English";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          router.replace(pathname, { locale: next });
        });
      }}
      className="flex w-full items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-[11px] shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85 disabled:opacity-60"
    >
      <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[11px] bg-pt-icon text-grass-600">
        <Globe className="h-[17px] w-[17px]" strokeWidth={1.8} />
      </span>
      <span className="flex-1 truncate text-left font-display text-[14.5px] font-bold text-ink-900">
        {label}
      </span>
      <span className="shrink-0 text-[12.5px] font-bold text-ink-500">{currentName}</span>
    </button>
  );
}
