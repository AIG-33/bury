import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { initialsOf } from "@/lib/mobile/format";

// =============================================================================
// Mobile app primitives (ТЗ Mobile §5 «Компоненты»). Server components only —
// every interactive element lives in its own client file.
//
// Base screen: 402px logical, adaptive 360–430, 18px content gutter,
// safe-area top 54px handled with max(env(safe-area-inset-top), 10px).
// =============================================================================

/** Scrollable content zone. Reserves space for the tab bar / CTA bar. */
export function MContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[430px] px-[18px] ${className}`}
      style={{ paddingBottom: "calc(max(env(safe-area-inset-bottom), 12px) + 92px)" }}
    >
      {children}
    </div>
  );
}

/**
 * Sticky light header (ТЗ §5): blur(12px) over the page bg, bottom hairline,
 * 27px/800 title on the left, 40×40 action buttons on the right.
 */
export function MStickyHeader({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-[rgba(20,60,30,0.07)] bg-[rgba(243,247,237,0.92)] backdrop-blur-[12px]"
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      <div className="mx-auto w-full max-w-[430px] px-[18px] pb-3">
        <div className="flex items-center justify-between gap-3 pt-1">
          <h1 className="font-display text-[27px] font-extrabold leading-[1.1] tracking-[-0.7px] text-grass-900">
            {title}
          </h1>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </header>
  );
}

/**
 * Sticky sub-screen header (design «PlayTennis Screens»): back button +
 * 24px title + optional 40×40 actions, optional row below (segment control).
 * Used by every screen opened from «Ещё» or the «Играть» sheet.
 */
export function MSubHeader({
  title,
  backHref,
  backLabel,
  actions,
  children,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-[rgba(20,60,30,0.07)] bg-[rgba(243,247,237,0.92)] backdrop-blur-[12px]"
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      <div className="mx-auto w-full max-w-[430px] px-[18px] pb-3">
        <div className="flex items-center gap-3 pt-1">
          <MBackButton href={backHref} label={backLabel} />
          <h1 className="flex-1 font-display text-[24px] font-extrabold leading-[1.1] tracking-[-0.6px] text-grass-900">
            {title}
          </h1>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </header>
  );
}

/** 40×40 white action button for headers (icon 19px). */
export function MHeaderButton({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href?: string;
  label: string;
}) {
  const cls =
    "grid h-10 w-10 place-items-center rounded-[12px] border border-[rgba(20,60,30,0.1)] bg-white text-grass-900 transition-opacity active:opacity-85";
  if (href) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Link href={href as any} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <span aria-label={label} className={cls}>
      {children}
    </span>
  );
}

/** Back button used on detail screens. */
export function MBackButton({ href, label }: { href: string; label: string }) {
  return (
    <MHeaderButton href={href} label={label}>
      <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={1.8} />
    </MHeaderButton>
  );
}

/**
 * Dark gradient header (ТЗ §5 «Хедер-градиент»): brand gradient, bottom radius
 * 24–26px, radial lime glow in the corner. Used on Лента / Профиль / Клуб.
 */
export function MDarkHeader({ children, radius = 26 }: { children: ReactNode; radius?: 24 | 26 }) {
  return (
    <header
      className="relative overflow-hidden text-white"
      style={{
        background: "linear-gradient(135deg,#12331F,#1C6B40 60%,#2A9556)",
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: radius,
        paddingTop: "max(env(safe-area-inset-top), 14px)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(42% 48% at 92% 4%, rgba(195,232,79,0.3) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-[430px] px-[18px] pb-5 pt-2">{children}</div>
    </header>
  );
}

/**
 * Segment control (ТЗ §5): container #E3ECD8 radius 12 padding 4;
 * active segment — white bg + shadow, text #1C7A46/700.
 * Link-based (search params), so it stays a server component.
 */
export function MSegment({
  items,
}: {
  items: Array<{ label: string; href: string; active: boolean }>;
}) {
  return (
    <div className="flex rounded-[12px] bg-[#E3ECD8] p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={item.href as any}
          scroll={false}
          className={[
            "flex-1 rounded-[9px] px-2 py-2 text-center font-display text-[12.5px] font-bold leading-none transition-opacity active:opacity-85",
            item.active
              ? "bg-white text-grass-600 shadow-[0_1px_3px_rgba(20,60,30,0.12)]"
              : "text-ink-500",
          ].join(" ")}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export type MPillTone = "registration" | "live" | "soon" | "finished" | "danger" | "win" | "loss";

const PILL_TONES: Record<MPillTone, string> = {
  registration: "bg-[rgba(28,122,70,0.1)] text-grass-600",
  live: "bg-ball-100 text-ball-700",
  soon: "bg-sun-50 text-sun-600",
  finished: "bg-ink-50 text-[#7A8C7F]",
  danger: "bg-clay-100 text-clay-500",
  win: "bg-grass-50 text-[#2C7A4C]",
  loss: "bg-clay-100 text-clay-500",
};

/** Status pill (ТЗ §5): radius 999, 10.5–12px/800, optional pulse dot. */
export function MStatusPill({
  tone,
  children,
  pulse = false,
}: {
  tone: MPillTone;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-1 text-[10.5px] font-extrabold leading-none ${PILL_TONES[tone]}`}
    >
      {pulse ? <span className="pulse-dot" aria-hidden /> : null}
      {children}
    </span>
  );
}

/**
 * Icon badge (ТЗ §5): rounded square, lime gradient by default,
 * icon inherits #1C7A46.
 */
export function MIconBadge({
  size = 38,
  radius = 11,
  className = "",
  children,
}: {
  size?: number;
  radius?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center text-grass-600 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: className.includes("bg-")
          ? undefined
          : "linear-gradient(135deg,#E7F4D9,#D3ECC4)",
      }}
    >
      {children}
    </span>
  );
}

/** Row card (ТЗ §5 «Строка-список»): white, radius 14–15, padding 12–13. */
export function MRow({
  children,
  href,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  const cls = `flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-[13px] shadow-[0_1px_2px_rgba(20,60,30,0.04)] ${className}`;
  if (href) {
    return (
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={href as any}
        className={`${cls} transition-opacity active:opacity-85`}
      >
        {children}
      </Link>
    );
  }
  return <div className={cls}>{children}</div>;
}

/** Eyebrow section label (10px/700, tracking +1.2, uppercase). */
export function MEyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-[1.2px] text-[#8AA093] ${className}`}>
      {children}
    </p>
  );
}

/** Stat tile (ТЗ §5): centered, Space Grotesk 19px/700 number, 9.5px caption. */
export function MStatTile({
  value,
  label,
  accent = false,
}: {
  value: ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[13px] border border-[rgba(20,60,30,0.06)] bg-white p-3 text-center shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
      <p
        className={`font-mono text-[19px] font-bold tabular-nums leading-tight ${
          accent ? "text-grass-600" : "text-ink-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[9.5px] font-semibold leading-tight text-[#8AA093]">{label}</p>
    </div>
  );
}

/**
 * Fixed CTA bar (ТЗ §5): replaces the tab bar on detail screens.
 * Blurred white bar, optional left slot (entry fee), gradient button.
 */
export function MCtaBar({ left, children }: { left?: ReactNode; children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(20,60,30,0.07)] bg-white/[0.92] backdrop-blur-[16px]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}
    >
      <div className="mx-auto flex w-full max-w-[430px] items-center gap-3 px-[18px] pt-3">
        {left ? <div className="shrink-0">{left}</div> : null}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Avatar circle with text initials; optional gradient status ring. */
export function MAvatar({
  name,
  url,
  size = 44,
  ring = false,
}: {
  name: string | null;
  url?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const inner = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name ?? ""} className="h-full w-full rounded-full object-cover" />
  ) : (
    <span
      className="grid h-full w-full place-items-center rounded-full bg-pt-icon font-display font-extrabold text-grass-700"
      style={{ fontSize: Math.max(11, Math.round(size * 0.34)) }}
    >
      {initialsOf(name)}
    </span>
  );

  if (!ring) {
    return (
      <span className="shrink-0 rounded-full" style={{ width: size, height: size }}>
        {inner}
      </span>
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full p-[2.5px]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg,#C3E84F,#28A35A)",
      }}
    >
      <span className="h-full w-full overflow-hidden rounded-full bg-grass-900">{inner}</span>
    </span>
  );
}

/** Empty state with purpose text and a CTA (AGENTS §3.6). */
export function MEmptyState({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="rounded-[16px] border border-dashed border-[rgba(20,60,30,0.15)] bg-white/60 p-5 text-center">
      <p className="font-display text-[14.5px] font-extrabold text-ink-900">{title}</p>
      <p className="mt-1 text-[12.5px] leading-[1.35] text-ink-500">{body}</p>
      {cta && href ? (
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={href as any}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-[14px] bg-pt-primary px-5 font-display text-[13px] font-extrabold text-white shadow-[0_10px_22px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85"
        >
          {cta}
        </Link>
      ) : null}
    </div>
  );
}
