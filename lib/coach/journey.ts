import { createSupabaseServerClient } from "@/lib/supabase/server";

export type JourneyStepId = "profile" | "slot" | "player" | "tournament";

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
 * Compute the coach's onboarding progress.
 *
 * Steps the coach controls (in order):
 *   profile → slot → player → tournament
 *
 * Venues + courts are NOT a coach concern — they live in the admin-curated
 * directory and are browsable from the public /venues catalogue. Showing
 * them as passive rows on the dashboard added noise and a permanent
 * "0/2 done" feeling for the coach, so we removed them.
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

  const [slotsRes, invitationsRes, tournamentsRes] = await Promise.all([
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

  const slotsCount = slotsRes.count ?? 0;
  const invitationsCount = invitationsRes.count ?? 0;
  const tournamentsCount = tournamentsRes.count ?? 0;

  const baseSteps: Array<Omit<JourneyStep, "state">> = [
    {
      id: "profile",
      done: profileDone,
      href: "/coach/profile",
    },
    {
      id: "slot",
      done: slotsCount > 0,
      href: "/coach/slots",
      count: slotsCount,
    },
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

  const currentIdxRaw = baseSteps.findIndex((s) => !s.done);
  const currentIdx = currentIdxRaw;
  const currentStep = currentIdx === -1 ? null : baseSteps[currentIdx];

  const steps: JourneyStep[] = baseSteps.map((s, idx) => {
    if (currentIdx === -1) return { ...s, state: "done" as const };
    if (idx < currentIdx) return { ...s, state: "done" as const };
    if (idx === currentIdx) return { ...s, state: "current" as const };
    return { ...s, state: "future" as const };
  });

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;

  return {
    ok: true,
    data: {
      steps,
      completed,
      total,
      nextStepId: currentStep ? (currentStep.id as JourneyStepId) : null,
      isFullySetUp: currentIdx === -1,
    },
  };
}
