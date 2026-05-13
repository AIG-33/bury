import { redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { joinViaToken } from "../../actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export const dynamic = "force-dynamic";

export default async function ClubJoinByTokenPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clubJoin");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <ResultShell title={t("errors.not_authenticated")} variant="error">
        <Link
          href={`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/clubs/join/${token}`)}`}
          className="inline-flex h-10 items-center rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600"
        >
          {t("cta_login")}
        </Link>
      </ResultShell>
    );
  }

  const res = await joinViaToken(token);
  if (res.ok) {
    redirect(`/${locale}/clubs/${res.data.slug}`);
  }

  const errorKey =
    res.error === "invite_invalid"
      ? "invite_invalid"
      : res.error === "invite_expired"
        ? "invite_expired"
        : res.error === "not_authenticated"
          ? "not_authenticated"
          : "unknown";

  return (
    <ResultShell title={t(`errors.${errorKey}`)} variant="error">
      <Link
        href={`/${locale}/clubs`}
        className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
      >
        {t("cta_clubs")}
      </Link>
    </ResultShell>
  );
}

function ResultShell({
  title,
  children,
  variant,
}: {
  title: string;
  children: React.ReactNode;
  variant: "error" | "success";
}) {
  const tone =
    variant === "error"
      ? "border-clay-200 bg-clay-50 text-clay-900"
      : "border-grass-200 bg-grass-50 text-grass-900";
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className={`rounded-xl2 border p-6 text-center ${tone}`}>
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <div className="mt-4 flex justify-center">{children}</div>
      </div>
    </div>
  );
}
