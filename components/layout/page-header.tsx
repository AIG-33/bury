import type { ReactNode } from "react";

type Props = {
  /** Small mono micro-cap shown above the title (e.g. "01 — Раздел"). Optional. */
  eyebrow?: string;
  /** Main display title. */
  title: ReactNode;
  /** Supporting body copy under the title. */
  subtitle?: ReactNode;
  /** Right-side slot for actions, e.g. primary CTA buttons. */
  actions?: ReactNode;
  /**
   * Inline slot rendered immediately to the right of the title — typically
   * a `<HelpPanel variant="inline">` so the "?" sits flush with the
   * heading instead of taking its own row.
   */
  help?: ReactNode;
};

/**
 * Standard inner-page header. Use on top of every admin/coach/player page so
 * the corporate hierarchy (eyebrow → display title → subtitle) is identical
 * everywhere.
 */
export function PageHeader({ eyebrow, title, subtitle, actions, help }: Props) {
  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="label-eyebrow">{eyebrow}</p>}
        <div
          className={
            (eyebrow ? "mt-3 " : "") +
            "flex flex-wrap items-center gap-x-2 gap-y-1"
          }
        >
          <h1 className="page-title">{title}</h1>
          {help}
        </div>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
