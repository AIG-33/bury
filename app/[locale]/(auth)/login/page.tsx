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
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-xl2 border border-grass-100 bg-white p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <TennisBall className="h-10 w-10 text-ball-500" />
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900">{t("title")}</h1>
            <p className="text-sm text-ink-600">{t("subtitle")}</p>
          </div>
        </div>
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
    </div>
  );
}
