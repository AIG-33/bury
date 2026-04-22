import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ scope?: string }>;
};

// /coach/leaderboard was merged into /coach/players. We keep this route as a
// stable redirect so old bookmarks, old emails, and any external links keep
// working. The previous `?scope=mine|all` query param is forwarded as `?lb=…`.
export default async function CoachLeaderboardRedirect({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const lb = sp.scope === "all" ? "all" : "mine";
  redirect(`/${locale}/coach/players?lb=${lb}`);
}
