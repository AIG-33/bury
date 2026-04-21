import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Trophy, Users, Search, Sparkles } from "lucide-react";
import { TennisBall } from "@/components/icons/tennis-ball";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ locale: string }> };

// If the user is signed in, route the primary CTA straight to their home.
// Coach (or admin) → coach dashboard; otherwise → player rating tab.
async function resolvePrimaryCtaHref(): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "/login";
    const { data: profile } = (await supabase
      .from("profiles")
      .select("is_coach, is_admin")
      .eq("id", user.id)
      .maybeSingle()) as { data: { is_coach: boolean; is_admin: boolean } | null };
    if (profile?.is_coach || profile?.is_admin) return "/coach/dashboard";
    return "/me/rating";
  } catch {
    return "/login";
  }
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const ctaHref = await resolvePrimaryCtaHref();

  const features = [
    { icon: Trophy, key: "rating" },
    { icon: Search, key: "find" },
    { icon: Users, key: "coaches" },
    { icon: Sparkles, key: "tournaments" },
  ] as const;

  return (
    <div className="relative overflow-hidden">
      <section className="relative px-6 pb-20 pt-12 md:pt-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-grass-50 px-3 py-1 text-sm font-medium text-grass-700">
                <TennisBall className="h-4 w-4" />
                {t("hero.eyebrow")}
              </span>
              <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-900 md:text-6xl">
                {t("hero.title")}
              </h1>
              <p className="max-w-xl text-lg text-ink-600">{t("hero.subtitle")}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={ctaHref as any}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-grass-500 px-6 font-medium text-white shadow-card transition hover:bg-grass-600"
                >
                  {t("hero.cta_primary")}
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square w-full max-w-md mx-auto rounded-xl2 bg-gradient-to-br from-grass-50 via-white to-ball-100 p-12 shadow-card">
                <div className="relative flex h-full items-center justify-center">
                  <TennisBall className="h-48 w-48 text-ball-500 animate-bounceBall" />
                  <div className="absolute -bottom-3 left-1/2 h-3 w-32 -translate-x-1/2 rounded-full bg-ink-900/10 blur-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-grass-50/40 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center font-display text-3xl font-semibold text-ink-900 md:text-4xl">
            {t("features.title")}
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="rounded-xl2 border border-grass-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-ace"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-grass-50 text-grass-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1 font-display text-lg font-semibold">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-sm text-ink-600">{t(`features.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="font-display text-2xl font-medium text-ink-900 md:text-3xl">
            {t("quote.text")}
          </p>
          <p className="mt-3 text-sm text-ink-500">{t("quote.author")}</p>
        </div>
      </section>
    </div>
  );
}
