import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LogIn, Search, Trophy, Users } from "lucide-react";

// =============================================================================
// GuestNextStepBanner — slim "what to do next" strip we show at the top of
// public catalogues (`/players`, `/tournaments`, `/coaches`) when the viewer
// isn't signed in.
//
// Why we need this. Public catalogues are great at convincing guests that
// the platform is real (real players, real tournaments, real coaches), but
// without a deliberate hand-off they bounce after browsing. The banner
// gives them a single primary action ("Sign up — 1 minute") plus two soft
// links to the other two catalogues so they can keep exploring instead of
// closing the tab.
//
// We deliberately render NOTHING for authenticated users — they already
// know how the platform works.
// =============================================================================

type Catalogue = "players" | "tournaments" | "coaches";

const CATALOGUE_HREF: Record<Catalogue, "/players" | "/tournaments" | "/coaches"> = {
  players: "/players",
  tournaments: "/tournaments",
  coaches: "/coaches",
};

const CATALOGUE_ICON: Record<Catalogue, typeof Search> = {
  players: Search,
  tournaments: Trophy,
  coaches: Users,
};

type Props = {
  isGuest: boolean;
  /** Which catalogue the banner is rendered on, so we omit a self-link. */
  current: Catalogue;
};

export async function GuestNextStepBanner({ isGuest, current }: Props) {
  if (!isGuest) return null;

  const t = await getTranslations("guestNextStep");

  const others: Catalogue[] = (["players", "tournaments", "coaches"] as Catalogue[]).filter(
    (c) => c !== current,
  );

  return (
    <section
      aria-label={t("aria_label")}
      className="rounded-xl2 border border-grass-200 bg-gradient-to-br from-grass-50 via-white to-ball-50/40 p-5 shadow-card"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-grass-700">
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-lg font-semibold text-ink-900">{t("title")}</h2>
          <p className="max-w-2xl text-sm text-ink-700">{t("body")}</p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Link
            href="/login"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-grass-700 px-5 font-display text-[12.5px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_28px_-10px_rgba(21,94,54,0.65)] transition hover:bg-grass-800"
          >
            <LogIn className="h-4 w-4" />
            {t("primary_cta")}
          </Link>

          <div className="flex items-center gap-2 text-xs text-ink-600">
            <span className="hidden text-ink-400 sm:inline">·</span>
            <span className="hidden sm:inline">{t("or_keep_browsing")}</span>
            {others.map((c) => {
              const Icon = CATALOGUE_ICON[c];
              return (
                <Link
                  key={c}
                  href={CATALOGUE_HREF[c]}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-ink-200 bg-white px-3 text-xs font-medium text-ink-700 transition hover:border-grass-300 hover:bg-grass-50 hover:text-grass-800"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`secondary.${c}`)}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
