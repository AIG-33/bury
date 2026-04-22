import { createSupabaseServerClient } from "@/lib/supabase/server";

export type JourneyStepId = "profile" | "venue" | "court" | "slot" | "player" | "tournament";

export type JourneyStepState = "done" | "current" | "future" | "info";

export type JourneyStep = {
  id: JourneyStepId;
  done: boolean;
  /** True when this step isn't a coach action — we only show count + link. */
  passive: boolean;
  state: JourneyStepState;
  href: string;
  count?: number;
};

export type CoachJourney = {
  steps: JourneyStep[];
  /** Active steps completed (passive steps don't count). */
  completed: number;
  /** Total active steps (passive steps don't count). */
  total: number;
  nextStepId: JourneyStepId | null;
  isFullySetUp: boolean;
};

/**
 * Compute the coach's onboarding progress.
 *
 * Active steps the coach controls (counted in progress):
 *   profile → slot → player → tournament
 *
 * Passive steps controlled by the admin (shown for context only, no CTA):
 *   venue → court — these belong to the global admin-curated directory.
 *   The coach can't add them, but it's useful to know how many courts
 *   are available before scheduling slots.
 */
export async function loadCoachJourney(): Promise<
  { ok: true; data: CoachJourney } | { ok: false; error: "not_authenticated" | "not_a_coach" }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: profile } = (await supabase
    .from("profiles")
    .select("id, is_coach, is_admin, coach_bio, coach_hourly_rate_pln, coach_lat, coach_lng")
    .eq("id", user.id)
    .maybeSingle()) as {
    data: {
      id: string;
      is_coach: boolean;
      is_admin: boolean;
      coach_bio: string | null;
      coach_hourly_rate_pln: number | null;
      coach_lat: number | null;
      coach_lng: number | null;
    } | null;
  };

  if (!profile || (!profile.is_coach && !profile.is_admin)) {
    return { ok: false, error: "not_a_coach" };
  }

  const userId = profile.id;

  // Active step 1: profile is "done" only when bio + hourly rate + map pin
  // are all present. A half-filled profile is the most common reason
  // players bounce off a coach card, so we hold the green-check until
  // everything is there.
  const profileDone =
    Boolean(profile.coach_bio && profile.coach_bio.trim().length >= 30) &&
    Boolean(profile.coach_hourly_rate_pln && profile.coach_hourly_rate_pln > 0) &&
    profile.coach_lat !== null &&
    profile.coach_lng !== null;

  // Counts (head:true is cheap — server only returns count).
  // Venues + courts are now admin-managed; we count them globally so the
  // coach knows how rich the directory is.
  const [venuesRes, courtsRes, slotsRes, invitationsRes, tournamentsRes] = await Promise.all([
    supabase.from("venues").select("id", { count: "exact", head: true }),
    supabase.from("courts").select("id", { count: "exact", head: true }),
    supabase.from("slots").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", userId),
    supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("owner_coach_id", userId),
  ]);

  const venuesCount = venuesRes.count ?? 0;
  const courtsCount = courtsRes.count ?? 0;
  const slotsCount = slotsRes.count ?? 0;
  const invitationsCount = invitationsRes.count ?? 0;
  const tournamentsCount = tournamentsRes.count ?? 0;

  const baseSteps: Array<Omit<JourneyStep, "state">> = [
    {
      id: "profile",
      done: profileDone,
      passive: false,
      href: "/coach/profile",
    },
    {
      id: "venue",
      done: venuesCount > 0,
      passive: true,
      // Coaches can't manage venues, but they can browse the public catalog.
      href: "/coaches/map",
      count: venuesCount,
    },
    {
      id: "court",
      done: courtsCount > 0,
      passive: true,
      href: "/coaches/map",
      count: courtsCount,
    },
    {
      id: "slot",
      done: slotsCount > 0,
      passive: false,
      href: "/coach/slots",
      count: slotsCount,
    },
    {
      id: "player",
      done: invitationsCount > 0,
      passive: false,
      href: "/coach/players",
      count: invitationsCount,
    },
    {
      id: "tournament",
      done: tournamentsCount > 0,
      passive: false,
      href: "/coach/tournaments",
      count: tournamentsCount,
    },
  ];

  // The "current" CTA is the first not-done active step. Passive steps are
  // skipped over — they never grab the spotlight.
  const activeSteps = baseSteps.map((s, idx) => ({ s, idx })).filter((x) => !x.s.passive);
  const currentActive = activeSteps.find((x) => !x.s.done);
  const currentIdx = currentActive?.idx ?? -1;

  const steps: JourneyStep[] = baseSteps.map((s, idx) => {
    if (s.passive) return { ...s, state: "info" as const };
    if (currentIdx === -1) return { ...s, state: "done" as const };
    if (idx < currentIdx) return { ...s, state: "done" as const };
    if (idx === currentIdx) return { ...s, state: "current" as const };
    return { ...s, state: "future" as const };
  });

  const activeOnly = steps.filter((s) => !s.passive);
  const completed = activeOnly.filter((s) => s.done).length;
  const total = activeOnly.length;

  return {
    ok: true,
    data: {
      steps,
      completed,
      total,
      nextStepId: currentActive ? (currentActive.s.id as JourneyStepId) : null,
      isFullySetUp: currentIdx === -1,
    },
  };
}
