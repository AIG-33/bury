"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, trackPageview } from "@/lib/analytics/posthog-client";

/**
 * Mount-once provider that initialises PostHog and emits a `$pageview` on
 * every client-side route change. No-op when `NEXT_PUBLIC_POSTHOG_KEY` is
 * unset, so dev/CI without analytics keys keeps working unchanged.
 *
 * Render children directly (no extra DOM) so it composes cleanly with the
 * locale layout.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const qs = search?.toString();
    trackPageview(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, search]);

  return <>{children}</>;
}
