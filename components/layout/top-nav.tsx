import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { TennisBall } from "@/components/icons/tennis-ball";
import { LanguageSwitcher } from "./language-switcher";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function TopNav() {
  const t = await getTranslations("nav");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isCoach = false;
  let isAdmin = false;
  if (user) {
    const { data } = (await supabase
      .from("profiles")
      .select("is_coach, is_admin")
      .eq("id", user.id)
      .single()) as { data: { is_coach: boolean; is_admin: boolean } | null };
    isCoach = data?.is_coach ?? false;
    isAdmin = data?.is_admin ?? false;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <TennisBall className="h-7 w-7 text-ball-500" />
          <span className="font-display text-lg font-semibold text-ink-900">
            Bury Tennis
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm md:flex">
          {user ? (
            <>
              <NavLink href="/me/rating">{t("rating")}</NavLink>
              <NavLink href="/me/bookings">{t("bookings")}</NavLink>
              <NavLink href="/me/matches">{t("matches")}</NavLink>
              <NavLink href="/me/tournaments">{t("tournaments")}</NavLink>
              <NavLink href="/me/find">{t("find")}</NavLink>
              <NavLink href="/me/coaches">{t("coaches")}</NavLink>
              <NavLink href="/me/profile">{t("profile")}</NavLink>
              {isCoach && (
                <NavLink href="/coach/dashboard" highlight>
                  {t("coach")}
                </NavLink>
              )}
              {isAdmin && (
                <NavLink href="/admin" highlight>
                  {t("admin")}
                </NavLink>
              )}
            </>
          ) : (
            <>
              <NavLink href="/leaderboard">{t("leaderboard")}</NavLink>
              <NavLink href="/coaches">{t("coaches")}</NavLink>
              <NavLink href="/help">{t("help")}</NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {user ? (
            <form action="/api/auth/signout" method="post" className="hidden md:block">
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
              >
                {t("logout")}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-lg bg-grass-500 px-4 text-sm font-medium text-white transition hover:bg-grass-600 md:inline-flex"
            >
              {t("login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  highlight = false,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={href as any}
      className={
        highlight
          ? "rounded-md bg-grass-50 px-2 py-1 text-grass-700 transition hover:bg-grass-100"
          : "text-ink-600 transition hover:text-grass-600"
      }
    >
      {children}
    </Link>
  );
}
