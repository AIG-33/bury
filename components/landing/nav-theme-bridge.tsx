"use client";

import { useEffect } from "react";

type Props = {
  theme?: "dark" | "light";
};

/**
 * NavThemeBridge — sets `<html data-theme="dark">` while mounted so that
 * the existing TopNav (server component) renders with transparent styles
 * via CSS rules in globals.css. Removes the attribute on unmount, so
 * interior pages keep their light theme without changes.
 */
export function NavThemeBridge({ theme = "dark" }: Props) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-theme");
    root.setAttribute("data-theme", theme);
    return () => {
      if (previous === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previous);
    };
  }, [theme]);

  return null;
}
