import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";
import { TennisBall } from "@/components/icons/tennis-ball";

type Props = { params: Promise<{ locale: string }> };

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("login");

  return (
    <section className="relative overflow-hidden">
      {/* Soft branded backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 80% 10%, rgba(226,246,68,0.18) 0%, transparent 65%), radial-gradient(50% 60% at 10% 100%, rgba(166,224,181,0.30) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto flex min-h-[78vh] w-full max-w-md flex-col justify-center px-6 py-16">
        {/* Eyebrow */}
        <p className="label-eyebrow text-center">{t("subtitle")}</p>

        {/* Wordmark */}
        <div className="mt-4 flex flex-col items-center">
          <span className="relative inline-flex h-14 w-14 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-grass-200/40 blur-xl"
            />
            <TennisBall className="relative h-12 w-12 text-ball-500 drop-shadow-[0_4px_18px_rgba(31,138,76,0.35)]" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-grass-900 md:text-4xl">
            {t("title")}
          </h1>
        </div>

        {/* Card */}
        <div className="mt-8 surface-card">
          <Suspense fallback={null}>
            <LoginForm
              labels={{
                email: t("email"),
                cta: t("cta"),
                sending: t("sending"),
                sent: t("sent"),
                help: t("help"),
                error: t("error"),
              }}
            />
          </Suspense>
        </div>

        <p className="mt-6 text-center font-mono text-[11.5px] uppercase tracking-[0.18em] text-ink-500">
          Alex Bury · Tennis Club · Warszawa
        </p>
      </div>
    </section>
  );
}
