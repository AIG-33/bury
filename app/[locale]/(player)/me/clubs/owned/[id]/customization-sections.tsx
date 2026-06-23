"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trash2, TrendingUp, Palette, Image as ImageIcon, Calculator } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MemberRow } from "../actions";
import type {
  ClubPageSettingsData,
  ClubRatingSettingsData,
  ClubRatingStandingRow,
} from "../rating-actions";
import {
  updateClubPageSettings,
  updateClubRatingSettings,
  adjustClubRating,
  simulateClubMatch,
} from "../rating-actions";
import type { ClubRatingConfig, ClubPageBlocks } from "@/lib/clubs/rating-schema";

type Props = {
  clubId: string;
  pageSettings: ClubPageSettingsData;
  ratingSettings: ClubRatingSettingsData;
  standings: ClubRatingStandingRow[];
  members: MemberRow[];
};

const SECTION = "rounded-xl2 border border-ink-100 bg-white p-4 shadow-card";
const INPUT =
  "h-9 w-full rounded-lg border border-ink-200 bg-white px-2 text-sm text-ink-900 focus:border-grass-500 focus:outline-none";
const BTN_PRIMARY =
  "inline-flex h-9 items-center gap-1 rounded-lg bg-grass-700 px-3 text-sm font-semibold text-white transition hover:bg-grass-800 disabled:cursor-not-allowed disabled:opacity-60";

export function ClubCustomizationSections(props: Props) {
  return (
    <>
      <PageBrandingSection clubId={props.clubId} initial={props.pageSettings} />
      <ClubRatingSection clubId={props.clubId} initial={props.ratingSettings} />
      <ManualAdjustSection
        clubId={props.clubId}
        standings={props.standings}
        members={props.members}
        startRating={props.ratingSettings.config.start_rating}
      />
    </>
  );
}

// ─── Branding ─────────────────────────────────────────────────────────────────

function PageBrandingSection({
  clubId,
  initial,
}: {
  clubId: string;
  initial: ClubPageSettingsData;
}) {
  const t = useTranslations("clubsOwned.detail.page");
  const router = useRouter();
  const [color, setColor] = useState(initial.brand_color ?? "#16a34a");
  const [colorOn, setColorOn] = useState(!!initial.brand_color);
  const [cover, setCover] = useState<string | null>(initial.cover_url);
  const [blocks, setBlocks] = useState<ClubPageBlocks>(initial.blocks);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [saving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      setStatus("idle");
      setError(null);
      const r = await updateClubPageSettings({
        club_id: clubId,
        brand_color: colorOn ? color : null,
        cover_url: cover,
        blocks,
      });
      if (r.ok) {
        setStatus("saved");
        router.refresh();
      } else {
        setStatus("error");
        setError(r.error);
      }
    });
  }

  const blockDefs: Array<{ key: keyof ClubPageBlocks; label: string }> = [
    { key: "rating", label: t("block_rating") },
    { key: "tournaments", label: t("block_tournaments") },
    { key: "roster", label: t("block_roster") },
    { key: "venues", label: t("block_venues") },
  ];

  return (
    <section className={SECTION}>
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
        <Palette className="h-5 w-5 text-grass-700" />
        {t("title")}
      </h2>
      <p className="mb-4 text-xs text-ink-500">{t("subtitle")}</p>

      <div className="space-y-5">
        {/* Brand color */}
        <div>
          <span className="mb-1 block text-sm font-medium text-ink-800">{t("brand_color")}</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={colorOn}
                onChange={(e) => setColorOn(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300"
              />
              {t("brand_color_clear")}
            </label>
            {colorOn && (
              <>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-ink-200"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className={`${INPUT} w-28 font-mono`}
                  maxLength={7}
                />
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-500">{t("brand_color_hint")}</p>
        </div>

        {/* Cover */}
        <div>
          <span className="mb-1 block text-sm font-medium text-ink-800">
            <ImageIcon className="mr-1 inline h-3.5 w-3.5" />
            {t("cover")}
          </span>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="mb-2 h-28 w-full max-w-md rounded-lg border border-ink-100 object-cover"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {uploading ? t("cover_uploading") : t("cover_upload")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  startUpload(async () => {
                    setError(null);
                    const supabase = createSupabaseBrowserClient();
                    const ext = file.name.split(".").pop() ?? "jpg";
                    const path = `${clubId}/cover-${Date.now()}.${ext}`;
                    const { error: upErr } = await supabase.storage
                      .from("club-logos")
                      .upload(path, file, { upsert: true, contentType: file.type });
                    if (upErr) {
                      setError(upErr.message);
                      return;
                    }
                    const { data: pub } = supabase.storage.from("club-logos").getPublicUrl(path);
                    setCover(pub.publicUrl);
                  });
                }}
              />
            </label>
            {cover && (
              <button
                type="button"
                onClick={() => setCover(null)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-clay-50 hover:text-clay-700"
              >
                <Trash2 className="h-4 w-4" />
                {t("cover_remove")}
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-500">{t("cover_hint")}</p>
        </div>

        {/* Blocks */}
        <div>
          <span className="mb-1 block text-sm font-medium text-ink-800">{t("blocks_title")}</span>
          <p className="mb-2 text-xs text-ink-500">{t("blocks_hint")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {blockDefs.map((b) => (
              <label
                key={b.key}
                className="inline-flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50/40 px-2 py-1.5 text-sm text-ink-700"
              >
                <input
                  type="checkbox"
                  checked={blocks[b.key]}
                  onChange={(e) => setBlocks({ ...blocks, [b.key]: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-300"
                />
                {b.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? t("saving") : t("save")}
          </button>
          {status === "saved" && <span className="text-sm text-grass-700">{t("saved")}</span>}
          {status === "error" && <span className="text-sm text-clay-700">{error ?? t("error")}</span>}
        </div>
      </div>
    </section>
  );
}

// ─── Rating settings + simulator ──────────────────────────────────────────────

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className={INPUT}
      />
    </label>
  );
}

function ClubRatingSection({
  clubId,
  initial,
}: {
  clubId: string;
  initial: ClubRatingSettingsData;
}) {
  const t = useTranslations("clubsOwned.detail.rating");
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [label, setLabel] = useState(initial.label ?? "");
  const [cfg, setCfg] = useState<ClubRatingConfig>(initial.config);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function setK(key: keyof ClubRatingConfig["k_factors"], n: number) {
    setCfg({ ...cfg, k_factors: { ...cfg.k_factors, [key]: n } });
  }
  function setMult(key: keyof ClubRatingConfig["multipliers"], n: number) {
    setCfg({ ...cfg, multipliers: { ...cfg.multipliers, [key]: n } });
  }

  function save() {
    startSave(async () => {
      setStatus("idle");
      setError(null);
      const r = await updateClubRatingSettings({
        club_id: clubId,
        enabled,
        label: label.trim() || null,
        config: cfg,
      });
      if (r.ok) {
        setStatus("saved");
        router.refresh();
      } else {
        setStatus("error");
        setError(r.error);
      }
    });
  }

  return (
    <section className={SECTION}>
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
        <TrendingUp className="h-5 w-5 text-grass-700" />
        {t("title")}
      </h2>
      <p className="mb-4 text-xs text-ink-500">{t("subtitle")}</p>

      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300"
        />
        {t("enabled")}
      </label>
      <p className="mb-4 text-xs text-ink-500">{t("enabled_hint")}</p>

      <label className="mb-4 block max-w-sm">
        <span className="mb-1 block text-sm font-medium text-ink-800">{t("label_field")}</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("label_placeholder")}
          maxLength={60}
          className={INPUT}
        />
      </label>

      <p className="mb-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{t("defaults_note")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label={t("start_rating")}
          value={cfg.start_rating}
          min={100}
          max={3000}
          onChange={(n) => setCfg({ ...cfg, start_rating: n })}
        />
        <NumberField
          label={t("floor")}
          value={cfg.floor}
          min={0}
          max={3000}
          onChange={(n) => setCfg({ ...cfg, floor: n })}
        />
      </div>

      <h3 className="mb-2 mt-4 text-sm font-semibold text-ink-800">{t("k_title")}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField label={t("k_provisional")} value={cfg.k_factors.provisional} min={8} max={80} onChange={(n) => setK("provisional", n)} />
        <NumberField label={t("k_intermediate")} value={cfg.k_factors.intermediate} min={8} max={80} onChange={(n) => setK("intermediate", n)} />
        <NumberField label={t("k_established")} value={cfg.k_factors.established} min={8} max={80} onChange={(n) => setK("established", n)} />
        <NumberField label={t("k_provisional_until")} value={cfg.k_factors.provisional_until_n_matches} min={0} max={50} onChange={(n) => setK("provisional_until_n_matches", n)} />
        <NumberField label={t("k_intermediate_until")} value={cfg.k_factors.intermediate_until_n_matches} min={1} max={200} onChange={(n) => setK("intermediate_until_n_matches", n)} />
      </div>

      <h3 className="mb-2 mt-4 text-sm font-semibold text-ink-800">{t("mult_title")}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField label={t("mult_friendly")} value={cfg.multipliers.friendly} min={0} max={3} step={0.05} onChange={(n) => setMult("friendly", n)} />
        <NumberField label={t("mult_tournament")} value={cfg.multipliers.tournament} min={0} max={3} step={0.05} onChange={(n) => setMult("tournament", n)} />
        <NumberField label={t("mult_final")} value={cfg.multipliers.tournament_final} min={0} max={3} step={0.05} onChange={(n) => setMult("tournament_final", n)} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? t("saving") : t("save")}
        </button>
        {status === "saved" && <span className="text-sm text-grass-700">{t("saved")}</span>}
        {status === "error" && <span className="text-sm text-clay-700">{error ?? t("error")}</span>}
      </div>

      <Simulator config={cfg} />
    </section>
  );
}

function Simulator({ config }: { config: ClubRatingConfig }) {
  const t = useTranslations("clubsOwned.detail.rating");
  const [p1, setP1] = useState(config.start_rating);
  const [p2, setP2] = useState(config.start_rating);
  const [m1, setM1] = useState(10);
  const [m2, setM2] = useState(10);
  const [winner, setWinner] = useState<"p1" | "p2">("p1");
  const [kind, setKind] = useState<"friendly" | "tournament" | "tournament_final">("tournament");
  const [out, setOut] = useState<{ p1New: number; p2New: number } | null>(null);
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const r = await simulateClubMatch({
        config,
        p1Rating: p1,
        p2Rating: p2,
        p1Matches: m1,
        p2Matches: m2,
        winnerSide: winner,
        kind,
      });
      if (r.ok) setOut({ p1New: r.data.p1New, p2New: r.data.p2New });
    });
  }

  return (
    <div className="mt-5 rounded-lg border border-ink-100 bg-ink-50/40 p-3">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
        <Calculator className="h-4 w-4 text-grass-700" />
        {t("sim_title")}
      </h3>
      <p className="mb-3 text-xs text-ink-500">{t("sim_hint")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label={t("sim_p1")} value={p1} onChange={setP1} />
        <NumberField label={t("sim_p2")} value={p2} onChange={setP2} />
        <NumberField label={t("sim_p1_matches")} value={m1} min={0} onChange={setM1} />
        <NumberField label={t("sim_p2_matches")} value={m2} min={0} onChange={setM2} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">{t("sim_winner")}</span>
          <select value={winner} onChange={(e) => setWinner(e.target.value as "p1" | "p2")} className={INPUT}>
            <option value="p1">{t("sim_winner_p1")}</option>
            <option value="p2">{t("sim_winner_p2")}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">{t("sim_kind")}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "friendly" | "tournament" | "tournament_final")}
            className={INPUT}
          >
            <option value="friendly">{t("sim_kind_friendly")}</option>
            <option value="tournament">{t("sim_kind_tournament")}</option>
            <option value="tournament_final">{t("sim_kind_final")}</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={pending} className={BTN_PRIMARY}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("sim_run")}
        </button>
        {out && (
          <span className="font-mono text-sm font-semibold tabular-nums text-ink-900">
            {t("sim_result", { p1: out.p1New, p2: out.p2New })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Manual adjustment ────────────────────────────────────────────────────────

function ManualAdjustSection({
  clubId,
  standings,
  members,
  startRating,
}: {
  clubId: string;
  standings: ClubRatingStandingRow[];
  members: MemberRow[];
  startRating: number;
}) {
  const t = useTranslations("clubsOwned.detail.rating");
  const router = useRouter();

  const ratingByPlayer = new Map(standings.map((s) => [s.player_id, s.rating]));
  // Union of approved members + anyone already in standings, de-duplicated.
  const rows = new Map<string, { id: string; name: string | null }>();
  for (const m of members) rows.set(m.user_id, { id: m.user_id, name: m.display_name });
  for (const s of standings) {
    if (!rows.has(s.player_id)) rows.set(s.player_id, { id: s.player_id, name: s.display_name });
  }
  const list = Array.from(rows.values());

  return (
    <section className={SECTION}>
      <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">{t("adjust_title")}</h2>
      <p className="mb-4 text-xs text-ink-500">{t("adjust_hint")}</p>
      {list.length === 0 ? (
        <p className="text-sm text-ink-500">{t("adjust_empty")}</p>
      ) : (
        <ul className="divide-y divide-ink-50">
          {list.map((p) => (
            <AdjustRow
              key={p.id}
              clubId={clubId}
              playerId={p.id}
              name={p.name}
              current={ratingByPlayer.get(p.id) ?? null}
              startRating={startRating}
              onDone={() => router.refresh()}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AdjustRow({
  clubId,
  playerId,
  name,
  current,
  startRating,
  onDone,
}: {
  clubId: string;
  playerId: string;
  name: string | null;
  current: number | null;
  startRating: number;
  onDone: () => void;
}) {
  const t = useTranslations("clubsOwned.detail.rating");
  const [value, setValue] = useState(current ?? startRating);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function apply() {
    start(async () => {
      setError(null);
      const r = await adjustClubRating({
        club_id: clubId,
        player_id: playerId,
        new_rating: value,
        note: note.trim() || null,
      });
      if (r.ok) {
        setNote("");
        onDone();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <span className="min-w-[8rem] flex-1 truncate text-sm font-medium text-ink-900">
        {name ?? "—"}
        <span className="ml-2 font-mono text-xs text-ink-500">
          {current != null ? t("adjust_current", { rating: current }) : t("adjust_unrated")}
        </span>
      </span>
      <input
        type="number"
        value={value}
        min={0}
        max={3000}
        onChange={(e) => setValue(Number(e.target.value))}
        className={`${INPUT} w-24`}
        aria-label={t("adjust_new")}
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("adjust_note_placeholder")}
        maxLength={300}
        className={`${INPUT} w-40 flex-1`}
      />
      <button type="button" onClick={apply} disabled={pending} className={BTN_PRIMARY}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? t("adjust_saving") : t("adjust_save")}
      </button>
      {error && <span className="w-full text-xs text-clay-700">{error}</span>}
    </li>
  );
}
