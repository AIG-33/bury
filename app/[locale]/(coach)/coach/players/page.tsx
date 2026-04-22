import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { InviteForm } from "./invite-form";

type Props = { params: Promise<{ locale: string }> };

type InvitationListRow = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
};

type AcceptedInvitationRow = {
  accepted_by: string;
  accepted_at: string | null;
  email: string;
};

type BookingRow = {
  player_id: string;
  created_at: string;
  status: "pending" | "confirmed" | "cancelled" | "attended" | "no_show";
};

type ProfileBasicRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ClubPlayer = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  invited: boolean;
  booked: boolean;
  bookings_total: number;
  bookings_active: number;
  last_activity_at: string;
};

export default async function CoachPlayersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachPlayers");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [invitesRes, acceptedRes, bookingsRes] = await Promise.all([
    supabase
      .from("invitations")
      .select("id, email, status, expires_at, created_at")
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20) as unknown as Promise<{ data: InvitationListRow[] | null }>,
    supabase
      .from("invitations")
      .select("accepted_by, accepted_at, email")
      .eq("coach_id", user.id)
      .eq("status", "accepted")
      .not("accepted_by", "is", null) as unknown as Promise<{
      data: AcceptedInvitationRow[] | null;
    }>,
    supabase
      .from("bookings")
      .select("player_id, created_at, status")
      .eq("coach_id", user.id) as unknown as Promise<{ data: BookingRow[] | null }>,
  ]);

  const invites = invitesRes.data;
  const accepted = acceptedRes.data ?? [];
  const bookings = bookingsRes.data ?? [];

  const players = new Map<string, ClubPlayer>();

  for (const inv of accepted) {
    if (!inv.accepted_by) continue;
    const cur =
      players.get(inv.accepted_by) ??
      ({
        id: inv.accepted_by,
        display_name: "",
        avatar_url: null,
        email: null,
        invited: false,
        booked: false,
        bookings_total: 0,
        bookings_active: 0,
        last_activity_at: "",
      } satisfies ClubPlayer);
    cur.invited = true;
    cur.email = cur.email ?? inv.email ?? null;
    if (inv.accepted_at && inv.accepted_at > cur.last_activity_at) {
      cur.last_activity_at = inv.accepted_at;
    }
    players.set(inv.accepted_by, cur);
  }

  for (const b of bookings) {
    const cur =
      players.get(b.player_id) ??
      ({
        id: b.player_id,
        display_name: "",
        avatar_url: null,
        email: null,
        invited: false,
        booked: false,
        bookings_total: 0,
        bookings_active: 0,
        last_activity_at: b.created_at,
      } satisfies ClubPlayer);
    cur.booked = true;
    cur.bookings_total += 1;
    if (b.status !== "cancelled") cur.bookings_active += 1;
    if (b.created_at > cur.last_activity_at) cur.last_activity_at = b.created_at;
    players.set(b.player_id, cur);
  }

  const ids = Array.from(players.keys());
  if (ids.length > 0) {
    const { data: profs } = (await supabase
      .from("public_profile_basic")
      .select("id, display_name, avatar_url")
      .in("id", ids)) as { data: ProfileBasicRow[] | null };
    for (const p of profs ?? []) {
      const cur = players.get(p.id);
      if (cur) {
        cur.display_name = p.display_name ?? "";
        cur.avatar_url = p.avatar_url ?? null;
      }
    }
  }

  const playerList = Array.from(players.values()).sort((a, b) =>
    b.last_activity_at.localeCompare(a.last_activity_at),
  );

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="coach-players"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {t("club.title")}
            </h2>
            <p className="text-sm text-ink-600">{t("club.subtitle")}</p>
          </div>
          <span className="font-mono text-sm tabular-nums text-ink-700">
            {t("club.count", { n: playerList.length })}
          </span>
        </div>

        {playerList.length === 0 ? (
          <EmptyState
            title={t("club.empty_title")}
            description={t("club.empty_description")}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">
                    {t("club.col_player")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">
                    {t("club.col_source")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">
                    {t("club.col_sessions")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">
                    {t("club.col_last")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {playerList.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 sm:px-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={p.avatar_url} name={p.display_name || p.email || "?"} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink-900">
                            {p.display_name || t("club.unknown_name")}
                          </div>
                          {p.email && (
                            <div className="truncate text-xs text-ink-500">{p.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                      <div className="flex flex-wrap gap-1">
                        {p.invited && (
                          <span className="inline-flex rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-800">
                            {t("club.source_invited")}
                          </span>
                        )}
                        {p.booked && (
                          <span className="inline-flex rounded-full bg-grass-100 px-2 py-0.5 text-xs font-medium text-grass-800">
                            {t("club.source_booked")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-ink-700 sm:px-4">
                      {p.booked
                        ? t("club.sessions_value", {
                            active: p.bookings_active,
                            total: p.bookings_total,
                          })
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-500 sm:px-4">
                      {p.last_activity_at
                        ? dateFmt.format(new Date(p.last_activity_at))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {t("invite.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-600">{t("invite.subtitle")}</p>
        <div className="mt-4">
          <InviteForm
            copy={{
              email: t("invite.email"),
              first_name: t("invite.first_name"),
              last_name: t("invite.last_name"),
              cta: t("invite.cta"),
              sending: t("invite.sending"),
              sent: t("invite.sent"),
              dev_link_label: t("invite.dev_link_label"),
              error: t("invite.error"),
            }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {t("recent.title")}
        </h2>

        {!invites || invites.length === 0 ? (
          <EmptyState
            title={t("recent.empty_title")}
            description={t("recent.empty_description")}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">{t("recent.col_email")}</th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">{t("recent.col_status")}</th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">{t("recent.col_expires")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td className="break-all px-3 py-2 text-ink-900 sm:px-4">{i.email}</td>
                    <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                      <StatusBadge status={i.status} labels={{
                        pending: t("status.pending"),
                        accepted: t("status.accepted"),
                        expired: t("status.expired"),
                        revoked: t("status.revoked"),
                      }} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-500 sm:px-4">
                      {dateFmt.format(new Date(i.expires_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700">
      {initials || "?"}
    </span>
  );
}

function StatusBadge({
  status,
  labels,
}: {
  status: "pending" | "accepted" | "expired" | "revoked";
  labels: Record<"pending" | "accepted" | "expired" | "revoked", string>;
}) {
  const palette: Record<typeof status, string> = {
    pending: "bg-ball-100 text-ball-900",
    accepted: "bg-grass-100 text-grass-800",
    expired: "bg-ink-100 text-ink-600",
    revoked: "bg-clay-100 text-clay-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[status]}`}>
      {labels[status]}
    </span>
  );
}
