import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SectionNav } from "@/components/layout/section-nav";

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
    { href: "/admin", label: t("overview"), icon: "dashboard" },
    { href: "/admin/db", label: t("database"), icon: "database" },
    { href: "/admin/quiz", label: t("quiz"), icon: "help" },
    { href: "/admin/rating", label: t("rating"), icon: "sliders" },
    { href: "/admin/reviews", label: t("reviews"), icon: "star" },
  ] as const;

  return (
    <>
      <SectionNav items={items} accent="clay" />
      {children}
    </>
  );
}
