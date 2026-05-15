import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Surface — single primitive for content blocks.
 *
 * Variants:
 *  - `card`   → default elevated white card (`.surface-card`)
 *  - `flat`   → same border/radius, no shadow (`.surface-card-flat`)
 *  - `soft`   → tinted grass background (info/empty states)
 *  - `glass`  → translucent white over hero auras
 *  - `row`    → compact card for dense lists
 *
 * Use `as` to render as something other than a `<div>` (e.g. `"section"`).
 */
export type SurfaceVariant = "card" | "flat" | "soft" | "glass" | "row";

const VARIANT_CLASS: Record<SurfaceVariant, string> = {
  card: "surface-card",
  flat: "surface-card-flat",
  soft: "surface-soft",
  glass: "surface-glass",
  row: "surface-row",
};

type AsProp = "div" | "section" | "article" | "aside" | "li" | "form";

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLElement> {
  variant?: SurfaceVariant;
  as?: AsProp;
}

export const Surface = React.forwardRef<HTMLElement, SurfaceProps>(
  function Surface(
    { className, variant = "card", as: As = "div", ...props },
    ref,
  ) {
    const Tag = As as React.ElementType;
    return (
      <Tag
        ref={ref}
        className={cn(VARIANT_CLASS[variant], className)}
        {...props}
      />
    );
  },
);

/**
 * SectionTitle — secondary heading inside pages.
 * Always grass-900 + display font, matching landing typography.
 */
export function SectionTitle({
  className,
  children,
  eyebrow,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement> & { eyebrow?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {eyebrow ? <p className="label-eyebrow">{eyebrow}</p> : null}
      <h2 className={cn("section-title", className)} {...rest}>
        {children}
      </h2>
    </div>
  );
}

/**
 * Chip — small status / tag pill.
 * Tones: neutral / grass / ball / clay / ink (mirroring `.chip-*` CSS classes).
 */
export type ChipTone = "neutral" | "grass" | "ball" | "clay" | "ink";

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: "",
  grass: "chip-grass",
  ball: "chip-ball",
  clay: "chip-clay",
  ink: "chip-ink",
};

export function Chip({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone }) {
  return (
    <span
      className={cn("chip", CHIP_TONE[tone], className)}
      {...props}
    />
  );
}
