import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import {
  LayoutDashboard,
  HelpCircle,
  Sliders,
  ShieldAlert,
  Star,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Admin area is protected by RLS at the data layer, but we also gate the
// routes here so non-admins get a clear redirect rather than blank pages.
export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminNav");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/admin`);

  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  if (!profile?.is_admin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-clay-500" />
        <h1 className="mt-3 font-display text-2xl font-bold text-ink-900">
          {t("forbidden_title")}
        </h1>
        <p className="mt-2 text-ink-600">{t("forbidden_body")}</p>
      </div>
    );
  }

  const items = [
    { href: "/admin", label: t("overview"), icon: LayoutDashboard },
    { href: "/admin/quiz", label: t("quiz"), icon: HelpCircle },
    { href: "/admin/rating", label: t("rating"), icon: Sliders },
    { href: "/admin/reviews", label: t("reviews"), icon: Star },
  ] as const;

  return (
    <>
      <nav className="border-b border-ink-100 bg-clay-50/40">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                href={it.href as any}
                className="inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-ink-600 transition hover:border-clay-400 hover:text-clay-700"
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}
