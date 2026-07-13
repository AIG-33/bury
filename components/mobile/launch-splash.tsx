"use client";

import { useEffect, useState } from "react";

// =============================================================================
// Launch splash for the native store app (Capacitor shell). Server-rendered
// into the first HTML response when the `PlayTennisApp` UA token is present,
// so it paints with the very first frame of the remote page — no black gap
// between the native splash (solid grass green, see capacitor.config.ts) and
// the web app. Pure-CSS grass court with white lines, a tennis ball flying
// side to side, logo + slogan on top. Stays for MIN_VISIBLE_MS *and* until
// hydration (the effect below only fires once React is interactive), then
// fades out and unmounts.
// =============================================================================

const MIN_VISIBLE_MS = 3000;
const FADE_MS = 600;
const SEEN_KEY = "pt-launch-splash-seen";

type Phase = "visible" | "fading" | "gone";

export function LaunchSplash({ slogan }: { slogan: string }) {
  const [phase, setPhase] = useState<Phase>("visible");

  useEffect(() => {
    // The full 3s show is for the app launch only. Later hard navigations in
    // the same WebView session (e.g. auth redirects) just get a quick fade.
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage can be unavailable (private mode); treat as first launch.
    }

    // performance.now() counts from navigation start, so the minimum display
    // time is measured from app launch rather than from hydration.
    const remaining = seen ? 0 : Math.max(0, MIN_VISIBLE_MS - performance.now());
    const fadeTimer = window.setTimeout(() => setPhase("fading"), remaining);
    return () => window.clearTimeout(fadeTimer);
  }, []);

  useEffect(() => {
    if (phase !== "fading") return;
    const unmountTimer = window.setTimeout(() => setPhase("gone"), FADE_MS);
    return () => window.clearTimeout(unmountTimer);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[999] flex flex-col overflow-hidden transition-opacity ease-out ${
        phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{
        transitionDuration: `${FADE_MS}ms`,
        background: "linear-gradient(175deg, #2E9E5B 0%, #1C7A46 55%, #14522F 100%)",
      }}
    >
      <style>{`
        @keyframes ptSplashBallX {
          from { transform: translateX(-38vw); }
          to { transform: translateX(38vw); }
        }
        @keyframes ptSplashBallY {
          from { transform: translateY(0); }
          to { transform: translateY(-64px); }
        }
        .pt-splash-ball-x {
          animation: ptSplashBallX 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
        }
        .pt-splash-ball-y {
          animation: ptSplashBallY 0.7s ease-in-out infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .pt-splash-ball-x, .pt-splash-ball-y { animation: none; }
        }
      `}</style>

      {/* ---- Logo + slogan ---- */}
      <div
        className="relative z-10 flex flex-col items-center px-6 text-center text-white"
        style={{ paddingTop: "calc(max(env(safe-area-inset-top), 24px) + 40px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="PlayTennis.by"
          className="h-20 w-20 rounded-[22px] shadow-[0_14px_36px_rgba(0,0,0,0.3)]"
        />
        <div className="mt-4 font-display text-[28px] font-extrabold leading-none tracking-[-0.5px]">
          PlayTennis<span className="text-ball-500">.by</span>
        </div>
        <p className="mt-2.5 max-w-[300px] text-[15px] font-semibold leading-snug text-white/85">
          {slogan}
        </p>
      </div>

      {/* ---- Grass court (top-down) with white lines ---- */}
      <div className="absolute inset-x-[8%] bottom-[10%] top-[38%] rounded-[3px] border-2 border-white/55">
        {/* Singles sidelines */}
        <div className="absolute inset-y-0 left-[13%] w-[2px] bg-white/55" />
        <div className="absolute inset-y-0 right-[13%] w-[2px] bg-white/55" />
        {/* Net */}
        <div className="absolute inset-x-[-4%] top-1/2 h-[3px] -translate-y-1/2 bg-white/80" />
        {/* Service lines + center service line */}
        <div className="absolute left-[13%] right-[13%] top-[26%] h-[2px] bg-white/55" />
        <div className="absolute bottom-[26%] left-[13%] right-[13%] h-[2px] bg-white/55" />
        <div className="absolute bottom-[26%] left-1/2 top-[26%] w-[2px] -translate-x-1/2 bg-white/55" />
      </div>

      {/* ---- Ball flying over the net, left <-> right with an arc ---- */}
      <div className="pt-splash-ball-x absolute left-1/2 top-[62%] -ml-[18px]">
        <div className="pt-splash-ball-y">
          <div
            className="h-9 w-9 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 32% 30%, #F4FF8A 0%, #D7F205 55%, #A8C21B 100%)",
              boxShadow: "0 10px 20px rgba(0, 0, 0, 0.3)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
