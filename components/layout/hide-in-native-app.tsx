"use client";

import type { ReactNode } from "react";
import { useIsNativeApp } from "@/lib/is-native-app";

/**
 * Renders children on the regular web but hides them inside the Capacitor
 * store app (e.g. "install the app" promos, which are pointless in the app).
 * Detection is client-side, so children stay visible during SSR/hydration and
 * unmount right after mount inside the native shell.
 */
export function HideInNativeApp({ children }: { children: ReactNode }) {
  const isNative = useIsNativeApp();
  if (isNative) return null;
  return <>{children}</>;
}
