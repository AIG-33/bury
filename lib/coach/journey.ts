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
    .select("id, is_coach, is_admin, coach_bio, coach_hourly_rate_pln")
    .eq("id", user.id)
    .maybeSingle()) as {
    data: {
      id: string;
      is_coach: boolean;
      is_admin: boolean;
      coach_bio: string | null;
      coach_hourly_rate_pln: number | null;
    } | null;
  };

  if (!profile || (!profile.is_coach && !profile.is_admin)) {
    return { ok: false, error: "not_a_coach" };
  }

  const userId = profile.id;

  // Active step 1: profile is "done" once bio (≥30 chars) + hourly rate are
  // both set. We intentionally do NOT require a map pin — coach discovery
  // happens via published slots, not a separate coach map, so asking for a
  // pin would be busy-work that never closes the green check.
  const profileDone =
    Boolean(profile.coach_bio && profile.coach_bio.trim().length >= 30) &&
    Boolean(profile.coach_hourly_rate_pln && profile.coach_hourly_rate_pln > 0);

  const [slotsRes, acceptedInvitesRes, bookingsRes, tournamentsRes] = await Promise.all([
    supabase.from("slots").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase
      .from("invitations")
      .select("accepted_by")
      .eq("coach_id", userId)
      .eq("status", "accepted")
      .not("accepted_by", "is", null),
    supabase.from("bookings").select("player_id").eq("coach_id", userId),
    supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("owner_coach_id", userId),
  ]);

  const slotsCount = slotsRes.count ?? 0;
  const tournamentsCount = tournamentsRes.count ?? 0;

  // "Players" = real user accounts in the coach's orbit:
  //   - accepted an invitation (invitations.accepted_by, status='accepted')
  //   - OR booked at least one of the coach's slots (bookings.player_id)
  // Distinct profile ids across both sources.
  const playerIds = new Set<string>();
  for (const r of (acceptedInvitesRes.data ?? []) as Array<{ accepted_by: string | null }>) {
    if (r.accepted_by) playerIds.add(r.accepted_by);
  }
  for (const r of (bookingsRes.data ?? []) as Array<{ player_id: string }>) {
    playerIds.add(r.player_id);
  }
  const playersCount = playerIds.size;

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
      done: playersCount > 0,
      href: "/coach/players",
      count: playersCount,
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
