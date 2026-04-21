"use client";

import { motion } from "framer-motion";

type Props = {
  label: string;
  index?: string;
  theme?: "light" | "dark";
};

export function ScrollCue({ label, index = "01 / 02", theme = "light" }: Props) {
  const text = theme === "dark" ? "text-silver" : "text-ink-500";
  const track = theme === "dark" ? "bg-white/15" : "bg-ink-900/15";
  const dot =
    theme === "dark"
      ? "bg-lime-neon shadow-[0_0_12px_rgba(212,255,58,0.8)]"
      : "bg-grass-700 shadow-[0_0_10px_rgba(31,138,76,0.55)]";

  return (
    <div className={`flex items-center gap-4 ${text}`}>
      <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
        {label}
      </span>
      <span
        className={`relative block h-px w-16 overflow-hidden ${track}`}
      >
        <motion.span
          aria-hidden
          className={`absolute left-0 top-1/2 -mt-[3px] block h-[6px] w-[6px] rounded-full ${dot}`}
          initial={{ x: 0 }}
          animate={{ x: 56 }}
          transition={{
            duration: 2.4,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
        {index}
      </span>
    </div>
  );
}
