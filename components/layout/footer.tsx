import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { TennisBall } from "@/components/icons/tennis-ball";
import { InstallAppCard } from "./install-app-card";

type Props = { authed: boolean };

export async function Footer({ authed }: Props) {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-ink-100 bg-white/60 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1200px] space-y-8 px-5 py-10 md:px-10 md:py-12">
        <InstallAppCard
          labels={{
            title: t("install.title"),
            body: t("install.body"),
            android_button: t("install.android_button"),
            ios_button: t("install.ios_button"),
            android_modal_title: t("install.android_modal_title"),
            android_step_1: t("install.android_step_1"),
            android_step_2: t("install.android_step_2"),
            android_step_3: t("install.android_step_3"),
            android_install_native: t("install.android_install_native"),
            android_native_hint: t("install.android_native_hint"),
            ios_modal_title: t("install.ios_modal_title"),
            ios_step_1: t("install.ios_step_1"),
            ios_step_2: t("install.ios_step_2"),
            ios_step_3: t("install.ios_step_3"),
            close: t("install.close"),
          }}
        />

        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center">
                <TennisBall className="h-7 w-7 text-ball-500" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                  Alex Bury
                </span>
                <span className="mt-0.5 font-display text-[14px] font-bold tracking-tight text-grass-900">
                  Tennis Club
                </span>
              </span>
            </Link>
            <p className="mt-3 max-w-md text-sm text-ink-600">{t("tagline")}</p>
          </div>

          <div>
            <h4 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
              {t("links.title")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <FooterLink href="/tournaments">{t("links.tournaments")}</FooterLink>
              </li>
              <li>
                <FooterLink href="/coaches">{t("links.coaches")}</FooterLink>
              </li>
              <li>
                <FooterLink href="/help">{t("links.help")}</FooterLink>
              </li>
              {!authed && (
                <li>
                  <FooterLink href="/login">{t("links.login")}</FooterLink>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
              {t("contact.title")}
            </h4>
            <p className="text-sm text-ink-600">{t("contact.body")}</p>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-2 border-t border-ink-100 pt-5 text-[11px] uppercase tracking-[0.16em] text-ink-500 md:flex-row md:items-center">
          <span>© {year} Alex Bury Tennis Club · Warszawa</span>
          <span>v1.0 · MVP</span>
        </div>
      </div>
    </footer>
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
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={href as any}
      className="text-ink-700 transition hover:text-grass-700"
    >
      {children}
    </Link>
  );
}
