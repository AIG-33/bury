"use client";

import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

type Variant = "fill" | "ghost";

type Props = {
  href: ComponentProps<typeof Link>["href"];
  children: ReactNode;
  variant?: Variant;
  className?: string;
  radius?: number;
};

const baseClasses: Record<Variant, string> = {
  fill: "bg-lime-neon text-atp-night hover:shadow-[0_24px_60px_-20px_rgba(212,255,58,0.55)]",
  ghost:
    "border border-white/25 text-white hover:bg-white/5 backdrop-blur-sm",
};

/**
 * Magnetic CTA — the cursor pulls the button by `radius` px with spring physics.
 * Ghost variant works on dark surfaces; fill is the primary action lime-neon pill.
 */
export function MagneticCTA({
  href,
  children,
  variant = "fill",
  className = "",
  radius = 90,
}: Props) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 22, mass: 0.6 });

  const handleMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (reduce) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      x.set(0);
      y.set(0);
      return;
    }
    const f = 0.35;
    x.set(dx * f);
    y.set(dy * f);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      style={{ x: sx, y: sy }}
      className="inline-block will-change-transform"
    >
      <Link
        href={href}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className={[
          "group relative inline-flex h-14 items-center gap-3 rounded-full px-8 font-mono text-[12px] uppercase tracking-[0.2em] transition-shadow duration-500 ease-followthrough",
          baseClasses[variant],
          className,
        ].join(" ")}
      >
        <span className="relative z-10">{children}</span>
        <span className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-current/10 transition-transform duration-500 ease-followthrough group-hover:translate-x-0.5">
          <svg
            viewBox="0 0 16 16"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
          >
            <path d="M2 8h12M9 3l5 5-5 5" strokeLinecap="round" />
          </svg>
        </span>
      </Link>
    </motion.span>
  );
}
