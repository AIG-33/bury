"use client";

import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

type Tab = {
  id: string;
  label: string;
  content: ReactNode;
  count?: number;
};

type Props = {
  defaultTab: string;
  tabs: Tab[];
};

// Simple Radix Tabs wrapper used by the venue detail page. Kept tiny on
// purpose — the heavy lifting (data, layout) is done in the server component
// and the tabs only juggle which prerendered block is visible.
export function VenueTabs({ defaultTab, tabs }: Props) {
  return (
    <Tabs.Root defaultValue={defaultTab} className="space-y-4">
      <Tabs.List
        className="flex gap-1 overflow-x-auto rounded-xl2 bg-ink-50 p-1 ring-1 ring-ink-100"
        aria-label="Venue sections"
      >
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.id}
            value={t.id}
            className="data-[state=active]:bg-white data-[state=active]:text-grass-800 data-[state=active]:shadow-card flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 transition hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-grass-500"
          >
            <span>{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[11px] tabular-nums " +
                  (t.count > 0 ? "bg-grass-100 text-grass-800" : "bg-ink-100 text-ink-500")
                }
              >
                {t.count}
              </span>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {tabs.map((t) => (
        <Tabs.Content
          key={t.id}
          value={t.id}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-grass-500"
        >
          {t.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
