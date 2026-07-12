"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

// =============================================================================
// Header tools for mobile list screens: a 40×40 search toggle and a 40×40
// filter button that opens a bottom-sheet (ТЗ §7.02 «фильтры — в bottom-sheet»,
// motion: slide-up 16px / 250ms).
// =============================================================================

const BTN =
  "grid h-10 w-10 place-items-center rounded-[12px] border border-[rgba(20,60,30,0.1)] bg-white text-grass-900 transition-opacity active:opacity-85";

function useParamNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as any, { scroll: false });
  };
}

/** Search toggle: expands an input under the header title row. */
export function MSearchTool({
  placeholder,
  ariaLabel,
}: {
  placeholder: string;
  ariaLabel: string;
}) {
  const searchParams = useSearchParams();
  const navigate = useParamNavigation();
  const initial = searchParams.get("q") ?? "";
  const [open, setOpen] = useState(initial.length > 0);
  const [value, setValue] = useState(initial);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        className={BTN}
        onClick={() => {
          if (open && value) {
            setValue("");
            navigate({ q: null });
          }
          setOpen((v) => !v);
        }}
      >
        {open ? (
          <X className="h-[19px] w-[19px]" strokeWidth={1.8} />
        ) : (
          <Search className="h-[19px] w-[19px]" strokeWidth={1.8} />
        )}
      </button>
      {open ? (
        <form
          className="absolute inset-x-[18px] top-full z-50 -mt-1"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ q: value.trim() || null });
          }}
        >
          <input
            autoFocus
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-[13px] border border-[rgba(20,60,30,0.1)] bg-white px-4 text-[13.5px] font-medium text-ink-900 shadow-[0_10px_24px_rgba(20,60,30,0.12)] outline-none placeholder:text-[#8AA093] focus:border-grass-500"
          />
        </form>
      ) : null}
    </>
  );
}

export type MFilterGroup = {
  param: string;
  label: string;
  options: Array<{ value: string; label: string }>;
};

/** Filter button + bottom-sheet with pill-chip option groups. */
export function MFilterTool({
  title,
  applyLabel,
  resetLabel,
  anyLabel,
  ariaLabel,
  groups,
}: {
  title: string;
  applyLabel: string;
  resetLabel: string;
  anyLabel: string;
  ariaLabel: string;
  groups: MFilterGroup[];
}) {
  const searchParams = useSearchParams();
  const navigate = useParamNavigation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const openSheet = () => {
    const initial: Record<string, string | null> = {};
    for (const g of groups) initial[g.param] = searchParams.get(g.param);
    setDraft(initial);
    setOpen(true);
  };

  const activeCount = groups.filter((g) => searchParams.get(g.param)).length;

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        className={`${BTN} relative`}
        onClick={openSheet}
      >
        <SlidersHorizontal className="h-[19px] w-[19px]" strokeWidth={1.8} />
        {activeCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-grass-600 text-[9px] font-extrabold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label={ariaLabel}
            className="absolute inset-0 bg-grass-900/40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-[18px] pt-4"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
              animation: "mSheetUp 250ms cubic-bezier(.4,0,.2,1) both",
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-100" aria-hidden />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[18px] font-extrabold tracking-[-0.4px] text-grass-900">
                {title}
              </h2>
              <button
                type="button"
                className="text-[12.5px] font-bold text-ink-500 transition-opacity active:opacity-85"
                onClick={() => {
                  const cleared: Record<string, string | null> = {};
                  for (const g of groups) cleared[g.param] = null;
                  setDraft(cleared);
                }}
              >
                {resetLabel}
              </button>
            </div>

            <div className="mt-3 max-h-[55dvh] space-y-4 overflow-y-auto pb-2">
              {groups.map((g) => (
                <div key={g.param}>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-[#8AA093]">
                    {g.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                      label={anyLabel}
                      active={!draft[g.param]}
                      onClick={() => setDraft((d) => ({ ...d, [g.param]: null }))}
                    />
                    {g.options.map((o) => (
                      <FilterChip
                        key={o.value}
                        label={o.label}
                        active={draft[g.param] === o.value}
                        onClick={() => setDraft((d) => ({ ...d, [g.param]: o.value }))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-3 flex h-12 w-full items-center justify-center rounded-[15px] bg-pt-primary font-display text-[15px] font-extrabold text-white shadow-[0_10px_22px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85"
              onClick={() => {
                navigate(draft);
                setOpen(false);
              }}
            >
              {applyLabel}
            </button>
          </div>
          <style>{`@keyframes mSheetUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        </div>
      ) : null}
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-[7px] text-[12px] font-bold leading-none transition-opacity active:opacity-85",
        active
          ? "bg-[rgba(28,122,70,0.1)] text-grass-600"
          : "border border-[rgba(20,60,30,0.1)] bg-white text-[#3A5445]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
