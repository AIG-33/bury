import { MapPin, Users, Award } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { ClubListItem } from "@/app/[locale]/clubs/actions";
import type { JoinPolicy } from "@/lib/clubs/schema";
import { ClubLogo } from "./club-logo";
import { JoinPolicyBadge } from "./join-policy-badge";

type Props = {
  club: ClubListItem;
  labels: {
    members_count: (n: number) => string;
    coaches_count: (n: number) => string;
    top5_avg_elo: string;
    no_elo_yet: string;
    join_policy: Record<JoinPolicy, string>;
  };
};

/**
 * Catalogue tile for the `/clubs` listing. Keeps the hierarchy:
 *   logo + name (with policy badge)
 *   short description (line-clamp-3)
 *   meta strip: city · members · coaches · top-5 Elo
 *
 * Designed for a 3-up grid on desktop / 2-up on tablet / 1-up on mobile.
 */
export function ClubCard({ club, labels }: Props) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={`/clubs/${club.slug}` as any}
      className="group block rounded-xl2 border border-ink-100 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-grass-200 hover:shadow-ace"
    >
      <div className="flex items-start gap-3">
        <ClubLogo url={club.logo_url} name={club.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-base font-semibold text-ink-900 group-hover:text-grass-800">
              {club.name}
            </h3>
            <JoinPolicyBadge policy={club.join_policy} labels={labels.join_policy} />
          </div>
          {(club.city || club.district_name) && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-500">
              <MapPin className="h-3 w-3" />
              <span className="truncate">
                {[club.city, club.district_name].filter(Boolean).join(" · ")}
              </span>
            </p>
          )}
        </div>
      </div>

      {club.description && (
        <p className="mt-3 line-clamp-3 text-sm text-ink-600">{club.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-50 pt-3 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-grass-600" />
          <span className="font-mono tabular-nums font-semibold text-ink-900">
            {club.members_total}
          </span>
          <span>{labels.members_count(club.members_total)}</span>
        </span>
        {club.coaches_total > 0 && (
          <span className="inline-flex items-center gap-1">
            <Award className="h-3.5 w-3.5 text-ball-600" />
            <span className="font-mono tabular-nums font-semibold text-ink-900">
              {club.coaches_total}
            </span>
            <span>{labels.coaches_count(club.coaches_total)}</span>
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          {club.top5_avg_elo > 0 ? (
            <>
              <span className="text-ink-500">{labels.top5_avg_elo}</span>
              <span className="font-mono tabular-nums font-semibold text-grass-800">
                {club.top5_avg_elo}
              </span>
            </>
          ) : (
            <span className="text-ink-400">{labels.no_elo_yet}</span>
          )}
        </span>
      </div>
    </Link>
  );
}
