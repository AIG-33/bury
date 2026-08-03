import { MapPin, Award } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { ClubListItem } from "@/app/[locale]/clubs/actions";
import type { JoinPolicy } from "@/lib/clubs/schema";
import { getCountryName } from "@/lib/geo/countries";
import { ClubLogo } from "./club-logo";
import { JoinPolicyBadge } from "./join-policy-badge";

type Props = {
  club: ClubListItem;
  locale: string;
  labels: {
    members_count: (n: number) => string;
    coaches_count: (n: number) => string;
    top5_avg_elo: string;
    no_elo_yet: string;
    join_policy: Record<JoinPolicy, string>;
  };
};

/**
 * Catalogue tile for the `/clubs` listing (redesign spec §4.4):
 *   logo + name + city
 *   short description (line-clamp-2)
 *   two mini stat tiles: members / top-5 Elo
 *   footer: access badge (+ coaches count when present)
 *
 * Designed for a 3-up grid on desktop / 2-up on tablet / 1-up on mobile.
 */
export function ClubCard({ club, locale, labels }: Props) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={`/clubs/${club.slug}` as any}
      className="lift-on-hover group flex flex-col rounded-xl2 border border-[rgba(20,60,30,0.07)] bg-white p-4 shadow-card md:p-5"
    >
      <div className="flex items-start gap-3">
        <ClubLogo url={club.logo_url} name={club.name} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-extrabold tracking-[-0.4px] text-ink-900 group-hover:text-grass-700">
            {club.name}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-500">
            <MapPin className="h-3 w-3" />
            <span className="truncate">
              {[club.city, getCountryName(club.country, locale)].filter(Boolean).join(" · ")}
            </span>
          </p>
        </div>
      </div>

      {club.description && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-600">{club.description}</p>
      )}

      {/* Mini stat tiles (spec §4.4): members / top-5 Elo. */}
      <div className="mt-4 flex gap-2">
        <div className="flex-1 rounded-[13px] border border-[rgba(20,60,30,0.05)] bg-[#FBFDF9] px-3 py-2.5 text-center">
          <div className="font-mono text-[19px] font-bold tabular-nums leading-tight text-ink-900">
            {club.members_total}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-ink-400">
            {labels.members_count(club.members_total)}
          </div>
        </div>
        <div className="flex-1 rounded-[13px] border border-[rgba(20,60,30,0.05)] bg-[#FBFDF9] px-3 py-2.5 text-center">
          <div className="font-mono text-[19px] font-bold tabular-nums leading-tight text-grass-600">
            {club.top5_avg_elo > 0 ? club.top5_avg_elo : "—"}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-ink-400">
            {club.top5_avg_elo > 0
              ? labels.top5_avg_elo.replace(/:\s*$/, "")
              : labels.no_elo_yet}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <JoinPolicyBadge policy={club.join_policy} labels={labels.join_policy} />
        {club.coaches_total > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-600">
            <Award className="h-3.5 w-3.5 text-ball-600" />
            <span className="font-mono tabular-nums font-semibold text-ink-900">
              {club.coaches_total}
            </span>
            <span>{labels.coaches_count(club.coaches_total)}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
