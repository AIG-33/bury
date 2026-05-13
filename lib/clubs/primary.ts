// Batch loader for the "primary club" badge shown next to a player or coach
// name. Returns a map `user_id → { slug, name, logo_url }` for the subset of
// users that have any approved primary membership.
//
// Designed to be called once per page (after the list of player ids is known)
// to avoid N+1 round-trips.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export type PrimaryClubInfo = {
  slug: string;
  name: string;
  logo_url: string | null;
};

export async function loadPrimaryClubsForUsers(
  supabase: AnySupabase,
  userIds: readonly string[],
): Promise<Map<string, PrimaryClubInfo>> {
  if (userIds.length === 0) return new Map();

  const { data: rows } = (await supabase
    .from("club_members")
    .select("user_id, clubs!inner(slug, name, logo_url)")
    .in("user_id", userIds)
    .eq("status", "approved")
    .eq("is_primary", true)) as {
    data: Array<{
      user_id: string;
      clubs:
        | { slug: string; name: string; logo_url: string | null }
        | Array<{ slug: string; name: string; logo_url: string | null }>;
    }> | null;
  };

  const map = new Map<string, PrimaryClubInfo>();
  for (const r of rows ?? []) {
    const c = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs;
    if (!c) continue;
    map.set(r.user_id, { slug: c.slug, name: c.name, logo_url: c.logo_url });
  }
  return map;
}
