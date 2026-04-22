import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LogOut } from "lucide-react";
import { TennisBall } from "@/components/icons/tennis-ball";
import { LanguageSwitcher } from "./language-switcher";
import { NavShell } from "./nav-shell";
import { NavLink } from "./nav-link";
import { ProfileMenu } from "./profile-menu";
import { MobileMenu, type MobileMenuItem } from "./mobile-menu";
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

  // All entry points are listed for authenticated users — even if onboarding
  // (quiz) isn't done yet — so they can navigate the platform freely.
  // The "matches" entry in the centre capsule is the PUBLIC feed (`/matches`),
  // shown to everyone. The personal "my matches" page (`/me/matches`) lives
  // under the profile dropdown for authed users — see the desktop nav below
  // and the mobile menu entry that follows `/me/profile`.
  const mobileItems: MobileMenuItem[] = user
    ? [
        { href: "/me/rating", label: t("rating") },
        { href: "/me/bookings", label: t("bookings") },
        { href: "/matches", label: t("matches") },
        { href: "/me/tournaments", label: t("tournaments") },
        { href: "/me/find", label: t("find") },
        { href: "/me/coaches", label: t("coaches") },
        { href: "/venues", label: t("venues") },
        { href: "/me/profile", label: t("profile") },
        { href: "/me/matches", label: t("my_matches") },
        { href: "/help", label: t("help") },
        ...(isCoach
          ? [{ href: "/coach/dashboard", label: t("coach"), highlight: true }]
          : []),
        ...(isAdmin
          ? [{ href: "/admin", label: t("admin"), highlight: true }]
          : []),
      ]
    : [
        { href: "/tournaments", label: t("tournaments") },
        { href: "/matches", label: t("matches") },
        { href: "/coaches", label: t("coaches") },
        { href: "/venues", label: t("venues") },
        { href: "/help", label: t("help") },
      ];

  return (
    <NavShell>
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-5 md:px-10">
        {/* Wordmark — ball spins on hover */}
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5"
          aria-label="Alex Bury Tennis Club"
        >
          <span className="relative inline-flex h-7 w-7 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-grass-100/0 blur-md transition-colors duration-500 group-hover:bg-grass-200/60"
            />
            <TennisBall className="relative h-6 w-6 text-ball-500 drop-shadow-[0_2px_6px_rgba(31,138,76,0.25)] transition-transform duration-700 ease-followthrough group-hover:rotate-[360deg]" />
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-500">
              Alex Bury
            </span>
            <span className="mt-0.5 font-display text-[14px] font-bold tracking-tight text-grass-900">
              Tennis Club
            </span>
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight text-grass-900 sm:hidden">
            ABTC
          </span>
        </Link>

        {/* Centre capsule — floating glass pill with nav links */}
        <nav
          aria-label="Primary"
          className="hidden h-10 max-w-[60vw] items-center gap-0.5 overflow-x-auto rounded-full border border-ink-200/70 bg-white/55 px-1.5 backdrop-blur-md md:flex lg:max-w-none"
        >
          {user ? (
            <>
              <NavLink href="/me/rating">{t("rating")}</NavLink>
              <NavLink href="/me/bookings">{t("bookings")}</NavLink>
              <NavLink href="/matches">{t("matches")}</NavLink>
              <NavLink href="/me/tournaments">{t("tournaments")}</NavLink>
              <NavLink href="/me/find">{t("find")}</NavLink>
              <NavLink href="/me/coaches">{t("coaches")}</NavLink>
              <NavLink href="/venues">{t("venues")}</NavLink>
              <ProfileMenu
                label={t("profile")}
                items={[
                  { href: "/me/profile", label: t("profile"), icon: "user" },
                  {
                    href: "/me/matches",
                    label: t("my_matches"),
                    icon: "matches",
                  },
                ]}
              />
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
              <NavLink href="/tournaments">{t("tournaments")}</NavLink>
              <NavLink href="/matches">{t("matches")}</NavLink>
              <NavLink href="/coaches">{t("coaches")}</NavLink>
              <NavLink href="/venues">{t("venues")}</NavLink>
              <NavLink href="/help">{t("help")}</NavLink>
            </>
          )}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <MobileMenu
            items={mobileItems}
            authed={!!user}
            labels={{
              open: t("menu_open"),
              close: t("menu_close"),
              logout: t("logout"),
              login: t("login"),
            }}
          />
          {user ? (
            <form
              action="/api/auth/signout"
              method="post"
              className="hidden md:block"
            >
              <button
                type="submit"
                aria-label={t("logout")}
                className="group inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200/70 bg-white/60 text-ink-600 backdrop-blur-md transition-all duration-300 ease-followthrough hover:-translate-y-0.5 hover:border-clay-300 hover:bg-white hover:text-clay-700"
              >
                <LogOut className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5" />
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="group hidden h-9 items-center gap-2 rounded-full bg-grass-700 pl-4 pr-2 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_8px_24px_-10px_rgba(21,94,54,0.6)] transition-all duration-400 ease-followthrough hover:-translate-y-0.5 hover:bg-grass-800 hover:shadow-[0_14px_34px_-10px_rgba(21,94,54,0.7)] md:inline-flex"
            >
              {t("login")}
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-followthrough group-hover:translate-x-0.5">
                <svg
                  viewBox="0 0 16 16"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M2 8h12M9 3l5 5-5 5" />
                </svg>
              </span>
            </Link>
          )}
        </div>
      </div>
    </NavShell>
  );
}
