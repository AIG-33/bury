"use client";

import { motion } from "framer-motion";

type Props = {
  label: string;
  index?: string;
};

export function ScrollCue({ label, index = "01 / 06" }: Props) {
  return (
    <div className="flex items-center gap-4 text-silver">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
        {label}
      </span>
      <span className="relative block h-px w-16 overflow-hidden bg-white/15">
        <motion.span
          aria-hidden
          className="absolute left-0 top-1/2 -mt-[3px] block h-[6px] w-[6px] rounded-full bg-lime-neon shadow-[0_0_12px_rgba(212,255,58,0.8)]"
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
