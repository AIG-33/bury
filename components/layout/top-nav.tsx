import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Globe2, HelpCircle, LogOut } from "lucide-react";
import { TennisBall } from "@/components/icons/tennis-ball";
import { LanguageSwitcher } from "./language-switcher";
import { NavShell } from "./nav-shell";
import { NavLink } from "./nav-link";
import { ProfileMenu } from "./profile-menu";
import { MobileMenu, type MobileMenuItem } from "./mobile-menu";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Top navigation — variant A "3 pillars + Profile".
// -------------------------------------------------
// Public capsule (always 4 destinations) reflects the project's
// positioning: Спарринги / Турниры / Тренеры / Площадки.
// Authenticated users get an additional Profile dropdown that hides the
// secondary "me/*" pages (rating, bookings, my matches, my tournaments,
// the personalised matchmaker), so the visible header stays calm.
//
// Removed from the visible bar (still reachable):
//   * /players  → footer + cross-links from /open-matches & /me/find
//   * /matches  → footer
//   * /help     → "?" icon in the right cluster + footer
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

  // Mobile menu mirrors the desktop split. Personal items (only for authed
  // users) sit on top, then the public 4 pillars, then secondary public
  // links (players, matches feed, help) so even mobile users keep a
  // shortcut to them.
  const mobileItems: MobileMenuItem[] = user
    ? [
        { group: "personal", href: "/me/profile", label: t("my_profile") },
        { group: "personal", href: "/me/find", label: t("my_finder") },
        { group: "personal", href: "/me/matches", label: t("my_matches") },
        { group: "personal", href: "/me/tournaments", label: t("my_tournaments") },
        { group: "personal", href: "/me/bookings", label: t("bookings") },
        { group: "personal", href: "/me/rating", label: t("my_elo") },
        { group: "public", href: "/open-matches", label: t("sparrings") },
        { group: "public", href: "/tournaments", label: t("tournaments") },
        { group: "public", href: "/coaches", label: t("coaches") },
        { group: "public", href: "/venues", label: t("venues") },
        { group: "public", href: "/players", label: t("players") },
        { group: "public", href: "/matches", label: t("matches") },
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
        { group: "public", href: "/open-matches", label: t("sparrings") },
        { group: "public", href: "/tournaments", label: t("tournaments") },
        { group: "public", href: "/coaches", label: t("coaches") },
        { group: "public", href: "/venues", label: t("venues") },
        { group: "public", href: "/players", label: t("players") },
        { group: "public", href: "/matches", label: t("matches") },
        { group: "public", href: "/help", label: t("help") },
      ];

  // The 4 pillars are identical for anon and authed visitors — single
  // source of truth, single visual treatment.
  const pillars = (
    <>
      <NavLink href="/open-matches" tone="public">
        {t("sparrings")}
      </NavLink>
      <NavLink href="/tournaments" tone="public">
        {t("tournaments")}
      </NavLink>
      <NavLink href="/coaches" tone="public">
        {t("coaches")}
      </NavLink>
      <NavLink href="/venues" tone="public">
        {t("venues")}
      </NavLink>
    </>
  );

  return (
    <NavShell>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-10">
        {/* Wordmark — ball spins on hover */}
        <Link
          href="/"
          className="group inline-flex items-center gap-3"
          aria-label="playtennis.by — найди соперника, тренера и турнир"
        >
          <span className="relative inline-flex h-11 w-11 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-grass-100/0 blur-md transition-colors duration-500 group-hover:bg-grass-200/60"
            />
            <TennisBall className="ease-followthrough relative h-10 w-10 text-ball-500 drop-shadow-[0_2px_8px_rgba(31,138,76,0.3)] transition-transform duration-700 group-hover:rotate-[360deg]" />
          </span>
          <span className="font-display text-[20px] font-extrabold tracking-tight text-grass-900 sm:text-[22px]">
            playtennis.by
          </span>
        </Link>

        {/* Centre — single capsule with 4 pillars + (authed only) Profile
            dropdown. The capsule keeps the existing glass treatment so the
            visual continuity with the previous design is preserved. */}
        <div
          className={[
            "hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto md:flex",
            "scrollbar-none [&::-webkit-scrollbar]:hidden",
            "justify-center",
          ].join(" ")}
          style={{ scrollbarWidth: "none" }}
        >
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
            {pillars}
            {user && (
              <>
                <span aria-hidden className="mx-1 h-5 w-px bg-ink-200/70" />
                <ProfileMenu
                  label={t("profile")}
                  items={[
                    { href: "/me/profile", label: t("my_profile"), icon: "user" },
                    { href: "/me/find", label: t("my_finder"), icon: "finder" },
                    { href: "/me/matches", label: t("my_matches"), icon: "matches" },
                    {
                      href: "/me/tournaments",
                      label: t("my_tournaments"),
                      icon: "tournaments",
                    },
                    { href: "/me/bookings", label: t("bookings"), icon: "bookings" },
                    {
                      href: "/me/rating",
                      label: t("my_elo"),
                      icon: "elo",
                      divider: true,
                    },
                  ]}
                />
              </>
            )}
          </nav>

          {/* Highlight pills (coach / admin) sit outside the capsule so they
              read as elevated CTAs, not regular nav. */}
          {user && (isCoach || isAdmin) && (
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
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {/* Help — replaced the bulky "Помощь" nav entry with a small icon
              button so the help glossary stays one click away without
              competing with the 4 pillars for attention. */}
          <Link
            href="/help"
            aria-label={t("help_aria")}
            title={t("help_aria")}
            className="ease-followthrough hidden h-10 w-10 items-center justify-center rounded-full border border-ink-200/70 bg-white/70 text-ink-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-grass-300 hover:bg-white hover:text-grass-700 md:inline-flex"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
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
            <form action="/api/auth/signout" method="post" className="hidden md:block">
              <button
                type="submit"
                aria-label={t("logout")}
                className="ease-followthrough group inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200/70 bg-white/70 text-ink-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-clay-300 hover:bg-white hover:text-clay-700 hover:shadow-[0_10px_24px_-12px_rgba(176,55,55,0.45)]"
              >
                <LogOut className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5" />
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="duration-400 ease-followthrough group hidden h-10 items-center gap-2 rounded-full bg-grass-700 pl-4 pr-2 font-display text-[12.5px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_28px_-10px_rgba(21,94,54,0.65)] transition-all hover:-translate-y-0.5 hover:bg-grass-800 hover:shadow-[0_18px_38px_-10px_rgba(21,94,54,0.75)] md:inline-flex"
            >
              {t("login")}
              <span className="ease-followthrough inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:translate-x-0.5">
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
