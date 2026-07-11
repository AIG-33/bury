import { Capacitor } from "@capacitor/core";

export type NativePlatform = "ios" | "android";
export type Platform = NativePlatform | "web";

/** True when running inside the Capacitor native shell (iOS/Android app). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Concrete platform the code is executing on. `"web"` covers both browser and SSR. */
export function getPlatform(): Platform {
  return Capacitor.getPlatform() as Platform;
}
