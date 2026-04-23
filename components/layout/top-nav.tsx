import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Globe2, LogOut, UserRound } from "lucide-react";
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

  // The mobile menu lists the same destinations as desktop but groups them
  // explicitly so the personal vs public split is visible there too.
  const mobileItems: MobileMenuItem[] = user
    ? [
        { group: "personal", href: "/me/rating", label: t("rating") },
        { group: "personal", href: "/me/bookings", label: t("bookings") },
        {
          group: "personal",
          href: "/me/tournaments",
          label: t("tournaments"),
        },
        { group: "personal", href: "/me/find", label: t("find") },
        { group: "personal", href: "/me/coaches", label: t("coaches") },
        { group: "personal", href: "/me/profile", label: t("profile") },
        { group: "personal", href: "/me/matches", label: t("my_matches") },
        { group: "public", href: "/matches", label: t("matches") },
        { group: "public", href: "/venues", label: t("venues") },
        { group: "public", href: "/help", label: t("help") },
        ...(isCoach
          ? [
              {
                group: "personal" as const,
                href: "/coach/dashboard",
                label: t("coach"),
                highlight: true,
              },
            ]
          : []),
        ...(isAdmin
          ? [
              {
                group: "personal" as const,
                href: "/admin",
                label: t("admin"),
                highlight: true,
              },
            ]
          : []),
      ]
    : [
        { group: "public", href: "/tournaments", label: t("tournaments") },
        { group: "public", href: "/matches", label: t("matches") },
        { group: "public", href: "/coaches", label: t("coaches") },
        { group: "public", href: "/venues", label: t("venues") },
        { group: "public", href: "/help", label: t("help") },
      ];

  return (
    <NavShell>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-10">
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
            <span className="font-display text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-500">
              Alex Bury
            </span>
            <span className="mt-0.5 font-display text-[14px] font-extrabold tracking-tight text-grass-900">
              Tennis Club
            </span>
          </span>
          <span className="font-display text-[15px] font-extrabold tracking-tight text-grass-900 sm:hidden">
            ABTC
          </span>
        </Link>

        {/* Centre — two glass capsules: PERSONAL (your zone) + PUBLIC (club).
            Their distinct backgrounds make it instantly obvious which links
            require an account and which are open to everyone. The wrapper
            allows horizontal scrolling on narrow desktops so both capsules
            stay legible without compressing. */}
        <div
          className={[
            "hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto md:flex",
            // Hide WebKit scrollbar so the nav stays clean.
            "scrollbar-none [&::-webkit-scrollbar]:hidden",
            "justify-center",
          ].join(" ")}
          style={{ scrollbarWidth: "none" }}
        >
          {user ? (
            <>
              {/* Personal capsule — green-tinted, with a tiny user icon eyebrow */}
              <nav
                aria-label={t("group_personal")}
                title={t("group_personal")}
                className={[
                  "group/cap relative flex h-11 shrink-0 items-center gap-0.5 rounded-full px-1.5",
                  "border border-grass-200/70 bg-gradient-to-r from-grass-50/90 via-white/85 to-grass-50/80",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_24px_-16px_rgba(31,138,76,0.45)]",
                  "backdrop-blur-md",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="ml-1 mr-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/80 text-grass-700 ring-1 ring-grass-200/80"
                >
                  <UserRound className="h-3.5 w-3.5" />
                </span>
                <NavLink href="/me/rating" tone="personal">
                  {t("rating")}
                </NavLink>
                <NavLink href="/me/bookings" tone="personal">
                  {t("bookings")}
                </NavLink>
                <NavLink href="/me/tournaments" tone="personal">
                  {t("tournaments")}
                </NavLink>
                <NavLink href="/me/find" tone="personal">
                  {t("find")}
                </NavLink>
                <NavLink href="/me/coaches" tone="personal">
                  {t("coaches")}
                </NavLink>
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
              </nav>

              {/* Public capsule — neutral white glass, with a tiny globe eyebrow */}
              <nav
                aria-label={t("group_public")}
                title={t("group_public")}
                className={[
                  "flex h-11 shrink-0 items-center gap-0.5 rounded-full px-1.5",
                  "border border-ink-200/70 bg-white/60",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_24px_-16px_rgba(15,27,20,0.18)]",
                  "backdrop-blur-md",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="ml-1 mr-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-600 ring-1 ring-ink-200/70"
                >
                  <Globe2 className="h-3.5 w-3.5" />
                </span>
                <NavLink href="/matches" tone="public">
                  {t("matches")}
                </NavLink>
                <NavLink href="/venues" tone="public">
                  {t("venues")}
                </NavLink>
              </nav>

              {/* Highlight pills (coach / admin) sit outside the capsules so
                  they read as elevated CTAs, not regular nav. */}
              {(isCoach || isAdmin) && (
                <div className="ml-1 flex shrink-0 items-center gap-1.5">
                  {isCoach && (
                    <NavLink href="/coach/dashboard" tone="highlight">
                      {t("coach")}
                    </NavLink>
                  )}
                  {isAdmin && (
                    <NavLink href="/admin" tone="highlight">
                      {t("admin")}
                    </NavLink>
                  )}
                </div>
              )}
            </>
          ) : (
            // Anonymous visitors see only the public capsule.
            <nav
              aria-label={t("group_public")}
              title={t("group_public")}
              className={[
                "flex h-11 shrink-0 items-center gap-0.5 rounded-full px-1.5",
                "border border-ink-200/70 bg-white/60",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_24px_-16px_rgba(15,27,20,0.18)]",
                "backdrop-blur-md",
              ].join(" ")}
            >
              <span
                aria-hidden
                className="ml-1 mr-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-600 ring-1 ring-ink-200/70"
              >
                <Globe2 className="h-3.5 w-3.5" />
              </span>
              <NavLink href="/tournaments" tone="public">
                {t("tournaments")}
              </NavLink>
              <NavLink href="/matches" tone="public">
                {t("matches")}
              </NavLink>
              <NavLink href="/coaches" tone="public">
                {t("coaches")}
              </NavLink>
              <NavLink href="/venues" tone="public">
                {t("venues")}
              </NavLink>
              <NavLink href="/help" tone="public">
                {t("help")}
              </NavLink>
            </nav>
          )}
        </div>

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
              group_personal: t("group_personal"),
              group_public: t("group_public"),
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
                className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200/70 bg-white/70 text-ink-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md transition-all duration-300 ease-followthrough hover:-translate-y-0.5 hover:border-clay-300 hover:bg-white hover:text-clay-700 hover:shadow-[0_10px_24px_-12px_rgba(176,55,55,0.45)]"
              >
                <LogOut className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5" />
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="group hidden h-10 items-center gap-2 rounded-full bg-grass-700 pl-4 pr-2 font-display text-[12.5px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_28px_-10px_rgba(21,94,54,0.65)] transition-all duration-400 ease-followthrough hover:-translate-y-0.5 hover:bg-grass-800 hover:shadow-[0_18px_38px_-10px_rgba(21,94,54,0.75)] md:inline-flex"
            >
              {t("login")}
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-followthrough group-hover:translate-x-0.5">
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
