import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/**
 * Compatibility redirect.
 *
 * Venues moved to the admin directory (see migration 20260422000200).
 * Old bookmarks and any cached client navigations to `/coach/venues`
 * land here and bounce to the public catalog map, which is what a coach
 * can actually do with venues now: browse them, not manage them.
 */
export default async function CoachVenuesRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/coaches/map`);
}
