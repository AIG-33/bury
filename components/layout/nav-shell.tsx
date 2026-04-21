"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = { children: ReactNode };

/**
 * Sticky header wrapper that swaps to a glass + hairline state once the user
 * scrolls past a small threshold. Kept as a client island so the surrounding
 * TopNav can stay server-rendered (auth fetch).
 */
export function NavShell({ children }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className={[
        "sticky top-0 z-40 transition-[background-color,backdrop-filter,box-shadow,border-color] duration-500 ease-followthrough",
        "border-b",
        scrolled
          ? "border-ink-200/60 bg-white/75 backdrop-blur-xl shadow-[0_8px_30px_-18px_rgba(15,27,20,0.18)]"
          : "border-transparent bg-white/40 backdrop-blur-md",
      ].join(" ")}
    >
      {children}
    </header>
  );
}
