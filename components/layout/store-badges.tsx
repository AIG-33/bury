import type { SVGProps } from "react";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "@/lib/mobile/store-links";

// =============================================================================
// Official-style App Store / Google Play badges linking to the published
// PlayTennis.by listings. Pure markup (no hooks) so they render in server
// components (footer) and client components (floating prompt) alike.
// =============================================================================

export type StoreBadgeLabels = {
  /** Small top line of the Apple badge, e.g. "Загрузите в". */
  apple_top: string;
  /** Small top line of the Google badge, e.g. "Доступно в". */
  google_top: string;
  /** Accessible names for the links. */
  aria_apple: string;
  aria_google: string;
};

const BADGE_BASE =
  "inline-flex items-center gap-2.5 rounded-[10px] border border-white/25 bg-ink-900 text-white shadow-card transition hover:bg-ink-800";

const SIZES = {
  sm: { pad: "h-10 px-3", logo: "h-5 w-5", top: "text-[8.5px]", bottom: "text-[13px]" },
  md: { pad: "h-12 px-4", logo: "h-6 w-6", top: "text-[10px]", bottom: "text-[16px]" },
} as const;

export function StoreBadges({
  labels,
  size = "md",
  className,
}: {
  labels: StoreBadgeLabels;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <div className={["flex flex-wrap items-center gap-2.5", className ?? ""].join(" ")}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={labels.aria_apple}
        className={[BADGE_BASE, s.pad].join(" ")}
      >
        <AppleLogo className={s.logo} />
        <span className="flex flex-col items-start leading-none">
          <span className={["font-medium tracking-wide text-white/80", s.top].join(" ")}>
            {labels.apple_top}
          </span>
          <span className={["mt-0.5 font-display font-bold", s.bottom].join(" ")}>
            App&nbsp;Store
          </span>
        </span>
      </a>
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={labels.aria_google}
        className={[BADGE_BASE, s.pad].join(" ")}
      >
        <GooglePlayLogo className={s.logo} />
        <span className="flex flex-col items-start leading-none">
          <span className={["font-medium tracking-wide text-white/80", s.top].join(" ")}>
            {labels.google_top}
          </span>
          <span className={["mt-0.5 font-display font-bold", s.bottom].join(" ")}>
            Google&nbsp;Play
          </span>
        </span>
      </a>
    </div>
  );
}

function AppleLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

function GooglePlayLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        fill="#4285F4"
        d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12 3.84 21.85c-.5-.24-.84-.76-.84-1.35Z"
      />
      <path fill="#34A853" d="M6.05 2.66c.22-.13.48-.16.85.05l9.91 6.17-2.27 2.27L6.05 2.66Z" />
      <path
        fill="#FBBC04"
        d="M20.16 10.85c.51.28.84.71.84 1.15 0 .44-.33.87-.84 1.15l-2.9 1.61-2.53-2.76 2.53-2.76 2.9 1.61Z"
      />
      <path fill="#EA4335" d="M6.9 21.29c-.37.21-.63.18-.85.05l8.49-8.49 2.27 2.27-9.91 6.17Z" />
    </svg>
  );
}
