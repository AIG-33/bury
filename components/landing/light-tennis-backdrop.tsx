"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

type Props = {
  className?: string;
};

/**
 * LightTennisBackdrop — calm, abstract tennis-themed scenery for light hero
 * surfaces. Composed of:
 *   - layered soft pastel gradient (grass-50 → ball-50)
 *   - large diffused yellow ball halo on the right (the "sun" of the page)
 *   - thin curved bezier "trails" suggesting ball flight trajectories
 *   - hairline arcs that read as service-court markings
 *   - scattered lime/ball particles drifting upwards
 *   - subtle horizon line at the bottom
 *
 * Pure SVG + a few CSS animations; respects prefers-reduced-motion.
 */
export function LightTennisBackdrop({ className = "" }: Props) {
  const reduce = useReducedMotion();

  // Stable seeded particles so SSR & CSR render identically.
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => {
        const seed = (i + 1) * 9301 + 49297;
        const r = (seed % 233280) / 233280;
        const r2 = ((seed * 1.3) % 233280) / 233280;
        const r3 = ((seed * 2.7) % 233280) / 233280;
        return {
          id: i,
          x: r * 100,
          y: r2 * 100,
          size: 1.6 + r3 * 3.2,
          delay: r * 6,
          duration: 9 + r2 * 8,
          tone: r3 > 0.6 ? "lime" : "ball",
        };
      }),
    [],
  );

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Base ambient gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_0%,#EAF7EE_0%,#FBFEDD_55%,#F8FDB8_100%)]" />

      {/* Sun-ball halo on the right (glowing yellow felt sphere) */}
      <div className="absolute -right-[12vw] top-[6vh] h-[68vh] w-[68vh] rounded-full bg-[radial-gradient(circle_at_30%_30%,#F8FDB8_0%,#E2F644_40%,#D7F205_70%,rgba(215,242,5,0)_75%)] blur-2xl opacity-80" />

      {/* Soft green wash bottom-left */}
      <div className="absolute -left-[10vw] -bottom-[20vh] h-[70vh] w-[70vh] rounded-full bg-[radial-gradient(circle,#D2EFD8_0%,rgba(210,239,216,0)_70%)] blur-2xl" />

      {/* SVG composition: trails, court arcs, hairlines */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="trail-grass" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#1F8A4C" stopOpacity="0" />
            <stop offset="50%" stopColor="#1F8A4C" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1F8A4C" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trail-ball" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#B5CB04" stopOpacity="0" />
            <stop offset="50%" stopColor="#B5CB04" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#B5CB04" stopOpacity="0" />
          </linearGradient>

          <pattern
            id="grid-faint"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M80 0H0V80"
              fill="none"
              stroke="#1F8A4C"
              strokeOpacity="0.06"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        {/* Faint hairline grid for editorial texture */}
        <rect width="1440" height="900" fill="url(#grid-faint)" />

        {/* Large abstract court arcs — service area suggestion */}
        <g
          fill="none"
          stroke="#1F8A4C"
          strokeOpacity="0.18"
          strokeWidth="1"
          strokeLinecap="round"
        >
          <path d="M -80 700 Q 360 580 800 700 T 1600 700" />
          <path d="M -80 760 Q 360 660 800 760 T 1600 760" strokeOpacity="0.1" />
        </g>

        {/* Vertical service line abstraction */}
        <line
          x1="720"
          y1="640"
          x2="720"
          y2="900"
          stroke="#1F8A4C"
          strokeOpacity="0.12"
          strokeWidth="1"
          strokeDasharray="1 8"
        />

        {/* Two long, slow ball trails (parabolas) */}
        <motion.path
          d="M -50 480 Q 360 200 760 380 T 1520 220"
          stroke="url(#trail-ball)"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={
            reduce
              ? { pathLength: 1, opacity: 1 }
              : { pathLength: 1, opacity: [0, 1, 1, 0] }
          }
          transition={{
            duration: reduce ? 0 : 6,
            ease: [0.22, 1, 0.36, 1],
            repeat: reduce ? 0 : Infinity,
            repeatDelay: 2,
          }}
        />
        <motion.path
          d="M 1490 600 Q 1100 380 700 540 T -60 360"
          stroke="url(#trail-grass)"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={
            reduce
              ? { pathLength: 1, opacity: 1 }
              : { pathLength: 1, opacity: [0, 1, 1, 0] }
          }
          transition={{
            duration: reduce ? 0 : 7,
            ease: [0.22, 1, 0.36, 1],
            repeat: reduce ? 0 : Infinity,
            repeatDelay: 3,
            delay: 1.4,
          }}
        />

        {/* Drifting particles (lime + ball) */}
        <g>
          {particles.map((p) => (
            <motion.circle
              key={p.id}
              cx={`${p.x}%`}
              cy={`${p.y}%`}
              r={p.size}
              fill={p.tone === "lime" ? "#D7F205" : "#E2F644"}
              fillOpacity={0.5}
              initial={{ y: 0, opacity: 0 }}
              animate={
                reduce
                  ? { opacity: 0.5 }
                  : { y: [-12, 12, -12], opacity: [0.2, 0.6, 0.2] }
              }
              transition={{
                duration: reduce ? 0 : p.duration,
                ease: "easeInOut",
                repeat: reduce ? 0 : Infinity,
                delay: p.delay,
              }}
            />
          ))}
        </g>

        {/* Subtle horizon hairline */}
        <line
          x1="0"
          y1="820"
          x2="1440"
          y2="820"
          stroke="#1F8A4C"
          strokeOpacity="0.08"
          strokeWidth="1"
        />
      </svg>

      {/* Soft top-edge fade for nav legibility */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/70 to-transparent" />
    </div>
  );
}
