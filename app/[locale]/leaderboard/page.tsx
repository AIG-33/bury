import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

// /leaderboard was referenced from older copies of the landing page and
// some external places (TZ docs, possible bookmarks) but the actual public
// Elo list lives at /players. Keep this route as a permanent redirect so
// nothing 404s.
export default async function LeaderboardRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/players`);
}
