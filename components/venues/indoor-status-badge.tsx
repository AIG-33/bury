import { Building2, CloudSun, Layers, HelpCircle } from "lucide-react";
import type { VenueIndoorStatus } from "@/lib/venues/schema";

// Single source of truth for the indoor / outdoor / mixed / unknown pill
// rendered next to a venue's name (admin list, admin detail, public list,
// public detail). The four states have distinct icons + accent colours so
// the badge is recognisable at a glance and accessible without colour alone.
const STYLES: Record<
  VenueIndoorStatus,
  { className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  indoor: {
    className: "bg-grass-100 text-grass-800 ring-1 ring-grass-200",
    Icon: Building2,
  },
  outdoor: {
    className: "bg-ball-100 text-ball-800 ring-1 ring-ball-200",
    Icon: CloudSun,
  },
  mixed: {
    className: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
    Icon: Layers,
  },
  unknown: {
    className: "bg-ink-100 text-ink-700 ring-1 ring-ink-200",
    Icon: HelpCircle,
  },
};

export function IndoorStatusBadge({
  status,
  label,
  size = "sm",
}: {
  status: VenueIndoorStatus;
  label: string;
  size?: "xs" | "sm";
}) {
  const { className, Icon } = STYLES[status];
  const sizeClasses =
    size === "xs"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-1 text-[11px]";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wider " +
        sizeClasses +
        " " +
        className
      }
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
