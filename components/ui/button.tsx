import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/**
 * Single CTA primitive used across the app.
 *
 * Variants follow the landing-page design language:
 *  - `primary`   → solid grass-700 pill (the canonical CTA from the hero)
 *  - `secondary` → glass white pill with grass hover
 *  - `accent`    → ball-yellow pill (used sparingly for celebratory moments)
 *  - `ghost`     → transparent, no border (in-row links / table actions)
 *  - `soft`      → tinted grass wash, green label (quiet in-card CTA)
 *  - `danger`    → soft clay-tinted pill for destructive actions
 *
 * Sizes:
 *  - `sm` (h-9), `md` (h-11, default), `lg` (h-12)
 *
 * Pass `asChild` to render the styles on a `<Link>` (next-intl) or any other
 * element while keeping a single source of truth for the button look.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "ghost"
  | "soft"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  accent: "btn-accent",
  ghost: "btn-ghost",
  soft: "btn-soft",
  danger: "btn-danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      asChild = false,
      type,
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref as never}
        type={asChild ? undefined : (type ?? "button")}
        className={cn("btn", VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
        {...props}
      />
    );
  },
);
