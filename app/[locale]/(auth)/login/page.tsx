import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";
import { TennisBall } from "@/components/icons/tennis-ball";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";

type Props = { params: Promise<{ locale: string }> };

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("login");

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 80% 10%, rgba(226,246,68,0.18) 0%, transparent 65%), radial-gradient(50% 60% at 10% 100%, rgba(166,224,181,0.30) 0%, transparent 70%)",
        }}
      />

      <div className="page-shell">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col justify-center gap-6">
          <div className="flex flex-col items-center gap-4">
            <span className="relative inline-flex h-14 w-14 items-center justify-center">
              <span aria-hidden className="absolute inset-0 rounded-full bg-grass-200/40 blur-xl" />
              <TennisBall className="relative h-12 w-12 text-ball-500 drop-shadow-[0_4px_18px_rgba(31,138,76,0.35)]" />
            </span>
            <PageHeader eyebrow={t("subtitle")} title={t("title")} />
          </div>

          <Surface variant="card">
            <Suspense fallback={null}>
              <LoginForm
                locale={locale}
                labels={{
                  email: t("email"),
                  password: t("password"),
                  cta_password: t("cta_password"),
                  cta_signup: t("cta_signup"),
                  cta_magic: t("cta_magic"),
                  sending: t("sending"),
                  sent: t("sent"),
                  help_magic: t("help_magic"),
                  help_signup_confirm: t("help_signup_confirm"),
                  error: t("error"),
                  tab_password: t("tab_password"),
                  tab_signup: t("tab_signup"),
                  tab_magic: t("tab_magic"),
                  forgot: t("forgot"),
                  forgot_sent_title: t("forgot_sent_title"),
                  forgot_sent_body: t("forgot_sent_body"),
                  back: t("back"),
                  password_min_hint: t("password_min_hint"),
                  show_password: t("show_password"),
                  hide_password: t("hide_password"),
                  auth_error_missing_token: t("auth_error_missing_token"),
                  auth_error_missing_code: t("auth_error_missing_code"),
                  auth_error_no_session: t("auth_error_no_session"),
                  auth_error_generic: t("auth_error_generic"),
                }}
              />
            </Suspense>
          </Surface>

          <p className="text-center font-mono text-[11.5px] uppercase tracking-[0.18em] text-ink-500">
            {t("footer")}
          </p>
        </div>
      </div>
    </section>
  );
}
