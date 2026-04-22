import { createSupabaseServerClient } from "@/lib/supabase/server";

export type JourneyStepId = "profile" | "venue" | "court" | "slot" | "player" | "tournament";

export type JourneyStepState = "done" | "current" | "future";

export type JourneyStep = {
  id: JourneyStepId;
  done: boolean;
  state: JourneyStepState;
  href: string;
  count?: number;
};

export type CoachJourney = {
  steps: JourneyStep[];
  completed: number;
  total: number;
  nextStepId: JourneyStepId | null;
  isFullySetUp: boolean;
};

/**
 * Compute the coach's onboarding progress across the 6 canonical setup steps.
 * Each step is "done" if at least one entity of the right kind exists for the
 * coach. The first not-done step becomes "current" and gets a CTA on the
 * dashboard so the coach always knows what to do next.
 *
 * Step order is intentional and matches the dependency chain in the data model:
 *   profile (publish yourself) → venue → court (lives under venue) →
 *   slot (lives on court) → player (invite) → tournament (uses everything).
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

  // Step 1: profile is "done" only when bio + hourly rate + map pin are all
  // present. A half-filled profile is the most common reason players bounce
  // off a coach card, so we hold the green-check until everything is there.
  const profileDone =
    Boolean(profile.coach_bio && profile.coach_bio.trim().length >= 30) &&
    Boolean(profile.coach_hourly_rate_pln && profile.coach_hourly_rate_pln > 0) &&
    profile.coach_lat !== null &&
    profile.coach_lng !== null;

  // Step 2-6: presence counts (head:true is cheap — server only returns count).
  const [venuesRes, courtsRes, slotsRes, invitationsRes, tournamentsRes] = await Promise.all([
    supabase.from("venues").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase
      .from("courts")
      .select("id, venues!inner(owner_id)", { count: "exact", head: true })
      .eq("venues.owner_id", userId),
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
    { id: "profile", done: profileDone, href: "/coach/profile" },
    { id: "venue", done: venuesCount > 0, href: "/coach/venues", count: venuesCount },
    {
      id: "court",
      done: courtsCount > 0,
      // First venue page lets the coach add courts immediately; if no venues
      // exist, the venues list itself is the right destination.
      href: venuesCount > 0 ? "/coach/venues" : "/coach/venues",
      count: courtsCount,
    },
    { id: "slot", done: slotsCount > 0, href: "/coach/slots", count: slotsCount },
    {
      id: "player",
      done: invitationsCount > 0,
      href: "/coach/players",
      count: invitationsCount,
    },
    {
      id: "tournament",
      done: tournamentsCount > 0,
      href: "/coach/tournaments",
      count: tournamentsCount,
    },
  ];

  // First not-done step is the "current" one — gets a colored CTA on the
  // dashboard. Everything before is "done", everything after is "future".
  const nextIdx = baseSteps.findIndex((s) => !s.done);
  const steps: JourneyStep[] = baseSteps.map((s, idx) => ({
    ...s,
    state:
      nextIdx === -1 ? "done" : idx < nextIdx ? "done" : idx === nextIdx ? "current" : "future",
  }));

  const completed = steps.filter((s) => s.done).length;

  return {
    ok: true,
    data: {
      steps,
      completed,
      total: steps.length,
      nextStepId: nextIdx === -1 ? null : steps[nextIdx].id,
      isFullySetUp: nextIdx === -1,
    },
  };
}
