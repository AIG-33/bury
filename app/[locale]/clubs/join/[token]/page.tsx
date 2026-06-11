import { redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { joinViaToken } from "../../actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

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
        <Button asChild variant="primary" size="sm">
          <Link
            href={`/${locale}/login?next=${encodeURIComponent(`/clubs/join/${token}`)}`}
          >
            {t("cta_login")}
          </Link>
        </Button>
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
      <Button asChild variant="secondary" size="sm">
        <Link href={`/${locale}/clubs`}>
          {t("cta_clubs")}
        </Link>
      </Button>
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
  return (
    <div className="page-shell flex min-h-[40vh] items-center justify-center">
      <Surface
        variant={variant === "error" ? "soft" : "card"}
        className={
          "w-full max-w-md text-center " +
          (variant === "error" ? "border-clay-200 bg-clay-50/60 text-clay-900" : "")
        }
      >
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <div className="mt-4 flex justify-center">{children}</div>
      </Surface>
    </div>
  );
}
