import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/**
 * Tournaments are no longer a coach-only feature. The organize area moved to
 * /me/tournaments/organized so any registered user can create a tournament
 * (not just coaches). Old `/coach/tournaments` URLs are redirected here for
 * backward compatibility — bookmarks, emails, and links from older docs
 * continue to land on the right page.
 */
export default async function CoachTournamentsRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/me/tournaments/organized`);
}
