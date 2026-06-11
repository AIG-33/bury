import { setRequestLocale, getTranslations } from "next-intl/server";
import { TennisBall } from "@/components/icons/tennis-ball";
import { UpdatePasswordForm } from "./update-password-form";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";

type Props = { params: Promise<{ locale: string }> };

export default async function UpdatePasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("updatePassword");

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
            <UpdatePasswordForm
              locale={locale}
              labels={{
                password: t("password"),
                confirm: t("confirm"),
                cta: t("cta"),
                sending: t("sending"),
                done_title: t("done_title"),
                done_body: t("done_body"),
                go_home: t("go_home"),
                error: t("error"),
                mismatch: t("mismatch"),
                no_session: t("no_session"),
                password_min_hint: t("password_min_hint"),
                show_password: t("show_password"),
                hide_password: t("hide_password"),
              }}
            />
          </Surface>
        </div>
      </div>
    </section>
  );
}
