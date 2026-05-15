import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { TennisBall } from "@/components/icons/tennis-ball";
import { InstallAppIcons } from "./install-app-card";

type Props = { authed: boolean };

/**
 * Compact, logically-grouped footer.
 *
 * Layout (desktop): brand + tagline | Discover | Catalog | Install/help
 * Layout (mobile):  stacked. The "install as PWA" affordance is two compact
 * icons next to the copyright (no longer a giant card) — the floating prompt
 * mounted in the root layout handles discoverability for first-time visitors.
 *
 * Reserves bottom safe-area for the mobile bottom tab bar.
 */
export async function Footer({ authed }: Props) {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-ink-100/80 bg-white/70 backdrop-blur-md pb-mobile-nav">
      <div className="page-shell !py-10 md:!py-12">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <Link href="/" className="group inline-flex items-center gap-3">
              <span className="relative inline-flex h-11 w-11 items-center justify-center">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-grass-100/0 blur-md transition-colors duration-500 group-hover:bg-grass-200/60"
                />
                <TennisBall className="ease-followthrough relative h-10 w-10 text-ball-500 drop-shadow-[0_2px_8px_rgba(31,138,76,0.3)] transition-transform duration-700 group-hover:rotate-[360deg]" />
              </span>
              <span className="font-display text-[22px] font-extrabold tracking-tight text-grass-900">
                PlayTennis.by
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-600">
              {t("tagline")}
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-600">
              {t("contact.body")}
            </p>
          </div>

          <FooterColumn title={t("groups.play")}>
            <FooterLink href="/open-matches">{t("links.sparrings")}</FooterLink>
            <FooterLink href="/tournaments">{t("links.tournaments")}</FooterLink>
            <FooterLink href="/coaches">{t("links.coaches")}</FooterLink>
            <FooterLink href="/clubs">{t("links.clubs")}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t("groups.browse")}>
            <FooterLink href="/venues">{t("links.venues")}</FooterLink>
            <FooterLink href="/players">{t("links.players")}</FooterLink>
            <FooterLink href="/matches">{t("links.matches")}</FooterLink>
            <FooterLink href="/leaderboard">{t("links.leaderboard")}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t("groups.account")}>
            <FooterLink href="/help">{t("links.help")}</FooterLink>
            {authed ? (
              <FooterLink href="/me/profile">{t("links.profile")}</FooterLink>
            ) : (
              <FooterLink href="/login">{t("links.login")}</FooterLink>
            )}
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-ink-100/80 pt-5 text-[11px] uppercase tracking-[0.16em] text-ink-500 md:flex-row md:items-center">
          <span>© {year} PlayTennis.by · Минск</span>

          <div className="flex flex-wrap items-center gap-3 normal-case tracking-normal">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">
              {t("install.title_short")}
            </span>
            <InstallAppIcons
              size="sm"
              labels={{
                android_button: t("install.android_button"),
                ios_button: t("install.ios_button"),
              }}
            />
          </div>

          <span>v1.0 · MVP</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="md:col-span-2">
      <h4 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
        {title}
      </h4>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={href as any}
        className="text-ink-700 transition-colors hover:text-grass-700"
      >
        {children}
      </Link>
    </li>
  );
}
