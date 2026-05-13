import { Trophy } from "lucide-react";

type ClubLogoProps = {
  url: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const SIZE_CLASS: Record<NonNullable<ClubLogoProps["size"]>, string> = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-xl",
  xl: "h-28 w-28 text-3xl",
};

/**
 * Square logo with a graceful fallback (first 1-2 letters of the name on a
 * grass-tinted background). Used in the clubs catalogue, club header,
 * "my clubs" rows and the primary-club badge.
 */
export function ClubLogo({ url, name, size = "md" }: ClubLogoProps) {
  const cls = SIZE_CLASS[size];
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`${cls} shrink-0 rounded-xl border border-ink-100 bg-white object-cover`}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={`${cls} grid shrink-0 place-items-center rounded-xl border border-grass-200 bg-grass-50 font-display font-bold uppercase tracking-wider text-grass-800`}
      aria-hidden
    >
      {initials || <Trophy className="h-1/2 w-1/2" />}
    </div>
  );
}
