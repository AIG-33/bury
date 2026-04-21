"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Loader2,
  Save,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  AlgorithmConfigSchema,
  type AlgorithmConfig,
} from "@/lib/quiz/schema";
import {
  activateRatingConfig,
  simulateMatch,
  updateRatingConfig,
} from "../actions";

type Props = {
  id: string;
  isActive: boolean;
  initialConfig: AlgorithmConfig;
  initialNotes: string | null;
};

type SimResult = {
  p1Delta: number;
  p2Delta: number;
  k1: number;
  k2: number;
  multiplier: number;
  p1Expected: number;
};

export function RatingEditor({ id, isActive, initialConfig, initialNotes }: Props) {
  const t = useTranslations("adminRating.editor");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState<AlgorithmConfig>(initialConfig);
  const [notes, setNotes] = useState(initialNotes ?? "");

  // Track validation errors across the form so we can highlight inline.
  const validation = useMemo(
    () => AlgorithmConfigSchema.safeParse(config),
    [config],
  );

  function patchStart(field: keyof AlgorithmConfig["start_elo"], value: number) {
    setConfig((c) => ({
      ...c,
      start_elo: { ...c.start_elo, [field]: value } as AlgorithmConfig["start_elo"],
    }));
    setSaved(false);
  }
  function patchClamp(idx: 0 | 1, value: number) {
    setConfig((c) => {
      const cl = [...c.start_elo.clamp] as [number, number];
      cl[idx] = value;
      return { ...c, start_elo: { ...c.start_elo, clamp: cl } };
    });
    setSaved(false);
  }
  function patchK(field: keyof AlgorithmConfig["k_factors"], value: number) {
    setConfig((c) => ({
      ...c,
      k_factors: { ...c.k_factors, [field]: value },
    }));
    setSaved(false);
  }
  function patchMul(field: keyof AlgorithmConfig["multipliers"], value: number) {
    setConfig((c) => ({
      ...c,
      multipliers: { ...c.multipliers, [field]: value },
    }));
    setSaved(false);
  }
  function patchSeason(
    field: "default_length_days" | "top_n_for_prizes",
    value: number,
  ) {
    setConfig((c) => ({
      ...c,
      season: { ...c.season, [field]: value },
    }));
    setSaved(false);
  }
  function patchScoring(key: string, value: number) {
    setConfig((c) => ({
      ...c,
      season: {
        ...c.season,
        scoring: { ...c.season.scoring, [key]: value },
      },
    }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "invalid");
      return;
    }
    start(async () => {
      const res = await updateRatingConfig({
        id,
        config: validation.data,
        notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function handleActivate() {
    setError(null);
    if (!confirm(t("confirm_activate"))) return;
    start(async () => {
      const res = await activateRatingConfig(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {isActive && (
        <div className="flex items-start gap-2 rounded-lg border border-grass-200 bg-grass-50 px-3 py-2 text-sm text-grass-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("locked_active")}</p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <SectionCard title={t("section_start_elo")} hint={t("section_start_elo_hint")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label={t("base")}
                value={config.start_elo.base}
                onChange={(v) => patchStart("base", v)}
                disabled={isActive}
              />
              <NumberField
                label={t("experience_per_year")}
                value={config.start_elo.experience_per_year}
                onChange={(v) => patchStart("experience_per_year", v)}
                disabled={isActive}
              />
              <NumberField
                label={t("clamp_min")}
                value={config.start_elo.clamp[0]}
                onChange={(v) => patchClamp(0, v)}
                disabled={isActive}
              />
              <NumberField
                label={t("clamp_max")}
                value={config.start_elo.clamp[1]}
                onChange={(v) => patchClamp(1, v)}
                disabled={isActive}
              />
              <NumberField
                label={t("tournaments_bonus_per_5")}
                value={config.start_elo.tournaments_bonus_per_5}
                onChange={(v) => patchStart("tournaments_bonus_per_5", v)}
                disabled={isActive}
              />
            </div>
          </SectionCard>

          <SectionCard title={t("section_k_factors")} hint={t("section_k_factors_hint")}>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label={t("k_provisional")}
                value={config.k_factors.provisional}
                onChange={(v) => patchK("provisional", v)}
                disabled={isActive}
              />
              <NumberField
                label={t("k_intermediate")}
                value={config.k_factors.intermediate}
                onChange={(v) => patchK("intermediate", v)}
                disabled={isActive}
              />
              <NumberField
                label={t("k_established")}
                value={config.k_factors.established}
                onChange={(v) => patchK("established", v)}
                disabled={isActive}
              />
              <NumberField
                label={t("k_provisional_until")}
                value={config.k_factors.provisional_until_n_matches}
                onChange={(v) => patchK("provisional_until_n_matches", v)}
                disabled={isActive}
              />
              <NumberField
                label={t("k_intermediate_until")}
                value={config.k_factors.intermediate_until_n_matches}
                onChange={(v) => patchK("intermediate_until_n_matches", v)}
                disabled={isActive}
              />
            </div>
          </SectionCard>

          <SectionCard title={t("section_multipliers")} hint={t("section_multipliers_hint")}>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label={t("m_friendly")}
                value={config.multipliers.friendly}
                step={0.05}
                onChange={(v) => patchMul("friendly", v)}
                disabled={isActive}
              />
              <NumberField
                label={t("m_tournament")}
                value={config.multipliers.tournament}
                step={0.05}
                onChange={(v) => patchMul("tournament", v)}
                disabled={isActive}
              />
              <NumberField
                label={t("m_tournament_final")}
                value={config.multipliers.tournament_final}
                step={0.05}
                onChange={(v) => patchMul("tournament_final", v)}
                disabled={isActive}
              />
            </div>
          </SectionCard>

          <SectionCard title={t("section_season")} hint={t("section_season_hint")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label={t("season_length")}
                value={config.season.default_length_days}
                onChange={(v) => patchSeason("default_length_days", v)}
                disabled={isActive}
              />
              <NumberField
                label={t("season_top_n")}
                value={config.season.top_n_for_prizes}
                onChange={(v) => patchSeason("top_n_for_prizes", v)}
                disabled={isActive}
              />
            </div>
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-700">
                {t("season_scoring")}
              </h4>
              <div className="space-y-2">
                {Object.entries(config.season.scoring).map(([k, v]) => (
                  <div key={k} className="grid gap-2 sm:grid-cols-[1fr_120px]">
                    <code className="inline-flex items-center rounded-md bg-ink-50 px-2 text-sm font-mono text-ink-700">
                      {k}
                    </code>
                    <input
                      type="number"
                      value={v}
                      onChange={(e) => patchScoring(k, Number(e.target.value) || 0)}
                      disabled={isActive}
                      className="h-9 rounded-md border border-ink-200 px-2 text-sm font-mono disabled:bg-ink-50"
                    />
                  </div>
                ))}
                <p className="text-xs text-ink-500">{t("season_scoring_hint")}</p>
              </div>
            </div>
          </SectionCard>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink-700">
              {t("notes_label")}
            </span>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
              disabled={isActive}
              rows={2}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm disabled:bg-ink-50"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3 shadow-card">
            <div>
              {!validation.success && (
                <p className="text-xs text-clay-700">
                  {t("invalid", {
                    msg: validation.error.issues[0]?.message ?? "invalid",
                  })}
                </p>
              )}
              {saved && validation.success && (
                <p className="inline-flex items-center gap-1 text-xs text-grass-700">
                  <CheckCircle2 className="h-3 w-3" /> {t("saved")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {!isActive && (
                <button
                  onClick={handleActivate}
                  disabled={pending || !validation.success}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-grass-300 bg-grass-50 px-4 text-sm font-medium text-grass-800 hover:bg-grass-100 disabled:opacity-50"
                >
                  {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t("activate")}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isActive || pending || !validation.success}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-clay-500 px-4 text-sm font-medium text-white shadow-card hover:bg-clay-600 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {t("save")}
              </button>
            </div>
          </div>
        </div>

        <Simulator config={validation.success ? validation.data : null} />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      {hint && <p className="mb-3 text-xs text-ink-500">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  step?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-700">{label}</span>
      <input
        type="number"
        value={value}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm font-mono disabled:bg-ink-50"
      />
    </label>
  );
}

function Simulator({ config }: { config: AlgorithmConfig | null }) {
  const t = useTranslations("adminRating.simulator");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [p1Elo, setP1Elo] = useState(1200);
  const [p2Elo, setP2Elo] = useState(1500);
  const [p1Matches, setP1Matches] = useState(2);
  const [p2Matches, setP2Matches] = useState(40);
  const [winner, setWinner] = useState<"p1" | "p2">("p1");
  const [kind, setKind] = useState<
    "friendly" | "tournament" | "tournament_final" | "league"
  >("tournament");

  function run() {
    if (!config) return;
    setError(null);
    setResult(null);
    start(async () => {
      const res = await simulateMatch({
        config,
        p1Elo,
        p2Elo,
        p1Matches,
        p2Matches,
        winnerSide: winner,
        kind,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({
        p1Delta: res.p1Delta,
        p2Delta: res.p2Delta,
        k1: res.k1,
        k2: res.k2,
        multiplier: res.multiplier,
        p1Expected: res.p1Expected,
      });
    });
  }

  return (
    <aside className="rounded-xl2 border border-ink-100 bg-gradient-to-br from-ball-50 via-white to-grass-50 p-5 shadow-card">
      <h3 className="inline-flex items-center gap-1.5 font-display text-lg font-semibold text-ink-900">
        <Sparkles className="h-4 w-4 text-ball-700" />
        {t("title")}
      </h3>
      <p className="mb-4 text-xs text-ink-600">{t("hint")}</p>

      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <PlayerInputs
            label={t("p1")}
            elo={p1Elo}
            matches={p1Matches}
            onElo={setP1Elo}
            onMatches={setP1Matches}
            icon={<Users className="h-3 w-3 text-grass-700" />}
          />
          <PlayerInputs
            label={t("p2")}
            elo={p2Elo}
            matches={p2Matches}
            onElo={setP2Elo}
            onMatches={setP2Matches}
            icon={<Users className="h-3 w-3 text-clay-700" />}
          />
        </div>

        <label className="block">
          <span className="mb-1 block text-ink-700">{t("winner")}</span>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-ink-200 p-1">
            {(["p1", "p2"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setWinner(s)}
                className={
                  winner === s
                    ? "rounded-md bg-grass-500 py-1.5 text-xs font-medium text-white"
                    : "rounded-md py-1.5 text-xs text-ink-600 hover:bg-ink-50"
                }
              >
                {t(`winner_${s}`)}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-ink-700">{t("kind")}</span>
          <select
            value={kind}
            onChange={(e) =>
              setKind(
                e.target.value as
                  | "friendly"
                  | "tournament"
                  | "tournament_final"
                  | "league",
              )
            }
            className="h-9 w-full rounded-md border border-ink-200 px-2 text-sm"
          >
            <option value="friendly">{t("kind_friendly")}</option>
            <option value="tournament">{t("kind_tournament")}</option>
            <option value="tournament_final">{t("kind_final")}</option>
            <option value="league">{t("kind_league")}</option>
          </select>
        </label>

        <button
          onClick={run}
          disabled={!config || pending}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trophy className="h-3.5 w-3.5" />
          )}
          {t("run")}
        </button>

        {error && (
          <p className="rounded-md border border-clay-200 bg-clay-50 px-2 py-1.5 text-xs text-clay-800">
            {error}
          </p>
        )}

        {result && (
          <div className="rounded-lg border border-ink-100 bg-white p-3 text-sm">
            <ResultRow label={t("p1")} delta={result.p1Delta} />
            <ResultRow label={t("p2")} delta={result.p2Delta} />
            <hr className="my-2 border-ink-100" />
            <p className="text-[11px] text-ink-500">
              K = {result.k1} / {result.k2} · m = {result.multiplier} · E(P1) ={" "}
              {(result.p1Expected * 100).toFixed(0)}%
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function PlayerInputs({
  label,
  elo,
  matches,
  onElo,
  onMatches,
  icon,
}: {
  label: string;
  elo: number;
  matches: number;
  onElo: (n: number) => void;
  onMatches: (n: number) => void;
  icon: React.ReactNode;
}) {
  const t = useTranslations("adminRating.simulator");
  return (
    <div className="space-y-1.5 rounded-lg border border-ink-100 bg-white p-2">
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-700">
        {icon} {label}
      </p>
      <label className="block text-xs">
        <span className="text-ink-500">{t("elo")}</span>
        <input
          type="number"
          value={elo}
          onChange={(e) => onElo(Number(e.target.value) || 0)}
          className="mt-0.5 h-8 w-full rounded-md border border-ink-200 px-2 text-sm font-mono"
        />
      </label>
      <label className="block text-xs">
        <span className="text-ink-500">{t("matches")}</span>
        <input
          type="number"
          value={matches}
          onChange={(e) => onMatches(Number(e.target.value) || 0)}
          className="mt-0.5 h-8 w-full rounded-md border border-ink-200 px-2 text-sm font-mono"
        />
      </label>
    </div>
  );
}

function ResultRow({ label, delta }: { label: string; delta: number }) {
  const cls =
    delta > 0
      ? "text-grass-700"
      : delta < 0
        ? "text-clay-700"
        : "text-ink-500";
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-600">{label}</span>
      <span className={`font-mono text-base font-semibold ${cls}`}>
        {delta > 0 ? "+" : ""}
        {delta}
      </span>
    </div>
  );
}
