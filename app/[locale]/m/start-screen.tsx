import { Link } from "@/i18n/routing";
import { Mail, Trophy, TrendingUp } from "lucide-react";
import { TennisBallIcon } from "@/components/mobile/m-icons";
import { StartOAuth, type StartOAuthLabels } from "./start-oauth";

// =============================================================================
// Screen 00 — Splash · Вход (дизайн «PlayTennis Start»). Guest landing of the
// native app: dark brand hero (breathing logo, slogan, feature chips, live
// proof) + light bottom sheet with Apple / Google first, then the primary
// e-mail sign-in CTA. Blocks cascade in with animate-rise.
// =============================================================================

export type StartScreenLabels = {
  slogan: string;
  chip_sparring: string;
  chip_tournaments: string;
  chip_elo: string;
  proof: string;
  login_email: string;
  or: string;
  new_here: string;
  signup: string;
  legal_prefix: string;
  legal_terms: string;
  legal_and: string;
  legal_privacy: string;
  oauth: StartOAuthLabels;
};

export function StartScreen({ labels }: { labels: StartScreenLabels }) {
  return (
    <div
      className="flex min-h-dvh flex-col text-white"
      style={{ background: "linear-gradient(160deg,#0F2C1A,#1C6B40 62%,#23854C)" }}
    >
      {/* ---- Hero: floating logo + slogan + chips + live proof ---- */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-[18px] text-center"
        style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}
      >
        {/* Lime corner glow + faint court markings behind the logo. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(48% 42% at 88% 0%, rgba(195,232,79,0.26) 0%, transparent 70%), radial-gradient(40% 40% at 6% 90%, rgba(42,149,86,0.4) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 bottom-[14%] top-[8%] rounded-[4px] border border-white/[0.07]"
        >
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.07]" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/[0.07]" />
        </div>

        <div className="relative animate-rise">
          <div className="pt-logo-breathe mx-auto grid h-[92px] w-[92px] place-items-center rounded-[26px] shadow-[0_18px_44px_rgba(0,0,0,0.35),0_0_60px_rgba(195,232,79,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192.png"
              alt="PlayTennis.by"
              className="h-full w-full rounded-[26px]"
            />
          </div>

          <h1 className="mt-6 font-display text-[34px] font-extrabold leading-none tracking-[-1px]">
            PlayTennis<span className="text-ball-500">.by</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[280px] whitespace-pre-line text-[15px] font-medium leading-[1.4] text-white/75">
            {labels.slogan}
          </p>
        </div>

        <div
          className="relative mt-7 flex animate-rise flex-wrap items-center justify-center gap-2"
          style={{ animationDelay: "120ms" }}
        >
          <FeatureChip icon={<TennisBallIcon className="h-[14px] w-[14px]" />}>
            {labels.chip_sparring}
          </FeatureChip>
          <FeatureChip icon={<Trophy className="h-[14px] w-[14px]" strokeWidth={2} />}>
            {labels.chip_tournaments}
          </FeatureChip>
          <FeatureChip icon={<TrendingUp className="h-[14px] w-[14px]" strokeWidth={2.2} />}>
            {labels.chip_elo}
          </FeatureChip>
        </div>

        <div className="relative mb-8 mt-7 animate-rise" style={{ animationDelay: "220ms" }}>
          <span className="glass-on-dark inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-bold text-white/85">
            <span className="pulse-dot text-ball-500" aria-hidden />
            {labels.proof}
          </span>
        </div>
      </div>

      {/* ---- Bottom sheet: Apple / Google → e-mail sign-in ---- */}
      <div
        className="relative animate-rise rounded-t-[28px] bg-[#F3F7ED] px-[18px] text-ink-900 shadow-[0_-18px_44px_rgba(0,0,0,0.3)]"
        style={{
          animationDelay: "300ms",
          paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
        }}
      >
        <div
          className="mx-auto h-[5px] w-10 translate-y-2.5 rounded-full bg-[rgba(20,60,30,0.14)]"
          aria-hidden
        />

        <div className="mx-auto w-full max-w-[430px] pt-7">
          <StartOAuth labels={labels.oauth} />

          <div className="my-5 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-[rgba(20,60,30,0.1)]" />
            <span className="text-[11px] font-bold uppercase tracking-[1px] text-[#8AA093]">
              {labels.or}
            </span>
            <span className="h-px flex-1 bg-[rgba(20,60,30,0.1)]" />
          </div>

          <Link
            href={"/login" as never}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-[16px] font-display text-[16px] font-extrabold text-white shadow-[0_12px_26px_rgba(28,122,70,0.38)] transition-opacity active:opacity-85"
            style={{ background: "linear-gradient(135deg,#2E9E5B,#1C7A46)" }}
          >
            <Mail className="h-[18px] w-[18px]" strokeWidth={2} />
            {labels.login_email}
          </Link>

          <p className="mt-5 text-center text-[13.5px] font-semibold text-ink-500">
            {labels.new_here}{" "}
            <Link href={"/login?mode=signup" as never} className="font-extrabold text-grass-600">
              {labels.signup}
            </Link>
          </p>

          <p className="mx-auto mt-3 max-w-[300px] text-center text-[11px] font-medium leading-[1.45] text-[#A7B5A9]">
            {labels.legal_prefix}{" "}
            <Link href={"/privacy" as never} className="font-bold text-[#7A8C7F]">
              {labels.legal_terms}
            </Link>{" "}
            {labels.legal_and}{" "}
            <Link href={"/privacy" as never} className="font-bold text-[#7A8C7F]">
              {labels.legal_privacy}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="glass-on-dark inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold leading-none text-white/90">
      <span className="text-ball-500">{icon}</span>
      {children}
    </span>
  );
}
