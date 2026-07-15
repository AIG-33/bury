"use client";

import { useEffect, useState } from "react";

// =============================================================================
// Launch splash for the native store app (Capacitor shell). Server-rendered
// into the first HTML response when the `PlayTennisApp` UA token is present,
// so it paints with the very first frame of the remote page — no black gap
// between the native splash and the web app. Pure-CSS grass court with white
// lines, a tennis ball rallying over the net (top ↔ bottom), logo + slogan on
// top. The static native splash image mirrors this exact layout
// (scripts/generate-mobile-assets.mjs) INCLUDING the ball's resting position:
// the ball animation stays paused until hydration — the same moment
// native-bridge.tsx hides the native splash — so the hand-off is a still
// frame → identical still frame, and then the ball simply starts flying.
// Stays for MIN_VISIBLE_MS after hydration (the moment the overlay becomes
// user-visible), then fades out and unmounts.
// =============================================================================

const MIN_VISIBLE_MS = 3000;
const FADE_MS = 600;
const SEEN_KEY = "pt-launch-splash-seen";

type Phase = "visible" | "fading" | "gone";

export function LaunchSplash({ slogan }: { slogan: string }) {
  const [phase, setPhase] = useState<Phase>("visible");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    // Unpause on the next frame so the resting pose (identical to the native
    // splash image) is painted at least once before the ball starts flying.
    const raf = requestAnimationFrame(() => setRunning(true));
    return () => cancelAnimationFrame(raf);
  }, []);

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

    // Count the minimum display time from NOW (hydration), not from
    // navigation start: the native splash covers the WebView until the app
    // mounts (native-bridge.tsx hides it), so this is the first moment the
    // animated overlay is actually visible to the user. Counting from
    // navigation start made the overlay flash for well under a second when
    // the remote page took a few seconds to load.
    const remaining = seen ? 0 : MIN_VISIBLE_MS;
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
        @keyframes ptSplashBallY {
          from { transform: translateY(21vh); }
          to { transform: translateY(-21vh); }
        }
        @keyframes ptSplashBallX {
          from { transform: translateX(-5.95vh); }
          to { transform: translateX(5.95vh); }
        }
        @keyframes ptSplashBallArc {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.22); }
        }
        /* Rally over the net (net is horizontal, flight is vertical): Y flies
           one court length per 1.4s, X drifts at half speed so the diagonals
           alternate, and the scale "arc" (1.4s, peak at 50%) maxes exactly at
           each net crossing (t = 0.7s + k*1.4s) so the ball reads as rising
           over the net. Start states = the resting pose baked into the native
           splash image. */
        .pt-splash-ball-y {
          animation: ptSplashBallY 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
        }
        .pt-splash-ball-x {
          animation: ptSplashBallX 2.8s ease-in-out infinite alternate;
        }
        .pt-splash-ball-arc {
          animation: ptSplashBallArc 1.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pt-splash-ball-y, .pt-splash-ball-x, .pt-splash-ball-arc { animation: none; }
        }
      `}</style>

      {/* ---- Logo + slogan ---- */}
      <div
        className="relative z-10 flex flex-col items-center px-6 text-center text-white"
        style={{ paddingTop: "calc(max(env(safe-area-inset-top), 24px) + 40px)" }}
      >
        {/* Inline copy of public/icons/icon.svg: an <img> here popped in
            noticeably late on device (extra network fetch during boot). */}
        <svg
          viewBox="0 0 512 512"
          className="h-20 w-20 rounded-[22px] shadow-[0_14px_36px_rgba(0,0,0,0.3)]"
          role="img"
          aria-label="PlayTennis.by"
        >
          <defs>
            <radialGradient id="ptSplashLogoBg" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#E2F644" />
              <stop offset="100%" stopColor="#A6E0B5" />
            </radialGradient>
            <radialGradient id="ptSplashLogoBall" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#F4FF80" />
              <stop offset="100%" stopColor="#C4E12A" />
            </radialGradient>
          </defs>
          <rect width="512" height="512" rx="112" fill="url(#ptSplashLogoBg)" />
          <circle cx="256" cy="256" r="160" fill="url(#ptSplashLogoBall)" />
          <path
            d="M115 175 c45 40 75 105 75 165 s-30 125-75 165"
            stroke="#FFFFFF"
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
          <path
            d="M397 175 c-45 40 -75 105 -75 165 s30 125 75 165"
            stroke="#FFFFFF"
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
          <path
            d="M115 175 c45 40 75 105 75 165 s-30 125-75 165"
            stroke="#0F1B14"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.25"
          />
          <path
            d="M397 175 c-45 40 -75 105 -75 165 s30 125 75 165"
            stroke="#0F1B14"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.25"
          />
        </svg>
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

      {/* ---- Ball rallying over the net: near baseline → over the net →
           far half and back, drifting sideways so the diagonals alternate.
           Base point is the net line center; paused until hydration so the
           first frames are pixel-identical to the native splash image. ---- */}
      <div
        className="pt-splash-ball-y absolute left-1/2 top-[64%] -ml-[18px] -mt-[18px]"
        style={{ animationPlayState: running ? "running" : "paused" }}
      >
        <div
          className="pt-splash-ball-x"
          style={{ animationPlayState: running ? "running" : "paused" }}
        >
          <div
            className="pt-splash-ball-arc"
            style={{ animationPlayState: running ? "running" : "paused" }}
          >
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
    </div>
  );
}
