import { ScoreboardIcon, TennisBallIcon } from "./m-icons";
import { Home, LayoutGrid, Trophy } from "lucide-react";

// =============================================================================
// Instant loading skeletons for the /m shell (`loading.tsx` of every tab).
// Pure server markup — no data, no translations — so the App Router can swap
// the screen the moment a tab is tapped instead of freezing on the old one.
// The bottom bar replica keeps the same geometry as <MTabBar> to avoid a
// visual jump while the real bar streams in.
// =============================================================================

function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[12px] bg-[#E3ECD8] ${className}`} />;
}

function RowBone() {
  return (
    <div className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-[13px] shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
      <Bone className="h-[38px] w-[38px] rounded-[11px]" />
      <div className="flex-1 space-y-2">
        <Bone className="h-3 w-3/5" />
        <Bone className="h-2.5 w-2/5" />
      </div>
      <Bone className="h-5 w-10 rounded-full" />
    </div>
  );
}

/** Non-interactive replica of the bottom tab bar (same geometry as MTabBar). */
function TabBarBone() {
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(20,60,30,0.07)] bg-white/90 backdrop-blur-[16px]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="mx-auto flex w-full max-w-[430px] px-[10px] pt-[9px]">
        {[Home, Trophy].map((Icon, i) => (
          <span
            key={i}
            className="flex flex-1 flex-col items-center justify-center gap-[3px] pb-1 pt-0.5 text-[#9AAB9F]"
          >
            <Icon className="h-[23px] w-[23px]" strokeWidth={1.8} />
            <Bone className="h-2 w-9 rounded" />
            <span className="h-[3px] w-[3px]" />
          </span>
        ))}
        <span className="relative flex flex-1 flex-col items-center justify-end gap-[3px] pb-1 pt-0.5">
          <span
            className="absolute -top-[30px] grid h-[54px] w-[54px] place-items-center rounded-full border-[3px] border-white text-grass-900 shadow-[0_10px_24px_rgba(163,203,56,0.55)]"
            style={{ background: "linear-gradient(135deg,#D4F16C,#B7E23F)" }}
          >
            <TennisBallIcon className="h-[25px] w-[25px]" />
          </span>
          <Bone className="h-2 w-9 rounded" />
          <span className="h-[3px] w-[3px]" />
        </span>
        {[0, 1].map((i) => (
          <span
            key={i}
            className="flex flex-1 flex-col items-center justify-center gap-[3px] pb-1 pt-0.5 text-[#9AAB9F]"
          >
            {i === 0 ? (
              <ScoreboardIcon className="h-[23px] w-[23px]" />
            ) : (
              <LayoutGrid className="h-[23px] w-[23px]" strokeWidth={1.8} />
            )}
            <Bone className="h-2 w-9 rounded" />
            <span className="h-[3px] w-[3px]" />
          </span>
        ))}
      </div>
    </div>
  );
}

type Variant = "light" | "dark" | "detail";

/**
 * Full-screen skeleton for a /m route. `light` mimics the sticky-header list
 * screens (Турниры / Матчи / Ещё / Рейтинг), `dark` the gradient-header feed
 * (`/m`), `detail` the hero-based detail screens (tournament / club / coach).
 */
export function MScreenSkeleton({ variant = "light" }: { variant?: Variant }) {
  return (
    <div aria-busy="true" className="min-h-dvh bg-[#F3F7ED]">
      {variant === "dark" ? (
        <header
          className="relative overflow-hidden rounded-b-[26px] text-white"
          style={{
            background: "linear-gradient(135deg,#12331F,#1C6B40 60%,#2A9556)",
            paddingTop: "max(env(safe-area-inset-top), 14px)",
          }}
        >
          <div className="mx-auto w-full max-w-[430px] px-[18px] pb-5 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Bone className="h-3 w-24 bg-white/20" />
                <Bone className="h-6 w-40 bg-white/25" />
              </div>
              <Bone className="h-11 w-11 rounded-full bg-white/20" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <Bone key={i} className="h-16 rounded-[13px] bg-white/15" />
              ))}
            </div>
          </div>
        </header>
      ) : (
        <header
          className="sticky top-0 z-40 border-b border-[rgba(20,60,30,0.07)] bg-[rgba(243,247,237,0.92)] backdrop-blur-[12px]"
          style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
        >
          <div className="mx-auto w-full max-w-[430px] px-[18px] pb-3">
            <div className="flex items-center justify-between gap-3 pt-1">
              <Bone className="h-7 w-36" />
              <div className="flex gap-2">
                <Bone className="h-10 w-10 rounded-[12px] bg-white" />
                <Bone className="h-10 w-10 rounded-[12px] bg-white" />
              </div>
            </div>
            {variant === "light" ? <Bone className="mt-3 h-9 w-full rounded-[12px]" /> : null}
          </div>
        </header>
      )}

      <div
        className="mx-auto w-full max-w-[430px] space-y-3 px-[18px] pt-4"
        style={{ paddingBottom: "calc(max(env(safe-area-inset-bottom), 12px) + 92px)" }}
      >
        {variant === "detail" ? (
          <>
            <Bone className="h-44 rounded-[18px]" />
            <div className="grid grid-cols-2 gap-2">
              <Bone className="h-16 rounded-[13px] bg-white" />
              <Bone className="h-16 rounded-[13px] bg-white" />
            </div>
          </>
        ) : (
          <Bone className="h-24 rounded-[16px] bg-white" />
        )}
        {[0, 1, 2, 3, 4].map((i) => (
          <RowBone key={i} />
        ))}
      </div>

      <TabBarBone />
    </div>
  );
}
