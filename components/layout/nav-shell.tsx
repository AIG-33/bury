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
        // Spec §2.4: sticky glass topbar — rgba(243,247,237,.72) + blur(16px).
        "sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300 ease-out",
        "border-b backdrop-blur-[16px]",
        scrolled
          ? "border-[rgba(20,60,30,0.08)] bg-[rgba(243,247,237,0.72)] shadow-[0_8px_30px_-18px_rgba(20,60,30,0.18)]"
          : "border-transparent bg-[rgba(243,247,237,0.45)]",
      ].join(" ")}
    >
      {children}
    </header>
  );
}
