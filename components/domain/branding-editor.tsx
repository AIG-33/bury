"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Trash2,
  Palette,
  Image as ImageIcon,
  Sparkles,
  Plus,
  ExternalLink,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { HelpPanel } from "@/components/help/help-panel";
import { HelpTooltip } from "@/components/help/help-tooltip";
import { buildRoomTheme } from "@/lib/tournaments/branding";
import {
  THEME_PRESETS,
  CORNER_STYLES,
  FONT_PAIRINGS,
  type TournamentBranding,
  type Sponsor,
} from "@/lib/validators/tournament-branding";

// =============================================================================
// Shared branding editor for the tournament room AND the club page — the two
// surfaces store the exact same branding blob (tournaments.branding /
// clubs.branding), so one editor keeps the vocabulary identical.
// The caller wires the entity specifics: storage bucket, save action,
// i18n namespace and help-panel id.
// =============================================================================

const SECTION = "rounded-xl2 border border-ink-100 bg-white p-4 shadow-card";
const INPUT =
  "h-9 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-2 text-sm text-ink-900 focus:border-grass-500 focus:outline-none";
const BTN_PRIMARY =
  "inline-flex h-9 items-center gap-1 rounded-lg bg-grass-700 px-3 text-sm font-semibold text-white transition hover:bg-grass-800 disabled:cursor-not-allowed disabled:opacity-60";
const BTN_GHOST =
  "inline-flex h-9 cursor-pointer items-center gap-1 rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50";

const DEFAULT_ACCENT = "#16a34a";
const DEFAULT_BG = "#0f1b14";
const DEFAULT_GRADIENT = "#1f3a2b";

type Kind = "logo" | "banner" | "sponsor";

type SaveResult = { ok: true } | { ok: false; error: string };

export function BrandingEditor({
  entityId,
  bucket,
  namespace,
  helpPageId,
  publicHref,
  initial,
  onSave,
}: {
  /** Owning row id — used as the storage folder prefix (RLS-checked). */
  entityId: string;
  /** Storage bucket for uploaded assets (logo / banner / sponsor logos). */
  bucket: string;
  /** i18n namespace with the editor copy (same key set for both surfaces). */
  namespace: "tournamentsOrganized.branding" | "clubsOwned.detail.branding";
  helpPageId: string;
  publicHref: string;
  initial: TournamentBranding;
  onSave: (branding: TournamentBranding) => Promise<SaveResult>;
}) {
  const t = useTranslations(namespace);
  const router = useRouter();

  const [b, setB] = useState<TournamentBranding>(initial);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Kind | null>(null);
  const [saving, startSave] = useTransition();

  function patch(next: Partial<TournamentBranding>) {
    setB((prev) => ({ ...prev, ...next }));
    setStatus("idle");
  }

  async function upload(file: File, kind: Kind): Promise<string | null> {
    setError(null);
    setUploading(kind);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "png";
      const path = `${entityId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        setError(upErr.message);
        return null;
      }
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      return pub.publicUrl;
    } finally {
      setUploading(null);
    }
  }

  function save() {
    startSave(async () => {
      setStatus("idle");
      setError(null);
      const r = await onSave(b);
      if (r.ok) {
        setStatus("saved");
        router.refresh();
      } else {
        setStatus("error");
        setError(r.error);
      }
    });
  }

  const preview = buildRoomTheme(b);

  return (
    <section className={SECTION}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
          <Palette className="h-5 w-5 text-grass-700" />
          {t("title")}
        </h2>
        <HelpPanel
          pageId={helpPageId}
          variant="inline"
          why={t("help.why")}
          what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
          result={[t("help.result.1"), t("help.result.2")]}
        />
      </div>
      <p className="mb-4 text-xs text-ink-500">{t("subtitle")}</p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Logo */}
          <Field
            label={t("logo")}
            hint={t("logo_hint")}
            icon={<ImageIcon className="h-3.5 w-3.5" />}
          >
            <div className="flex flex-wrap items-center gap-3">
              {b.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.logo_url}
                  alt=""
                  className="h-12 w-12 rounded-lg border border-ink-100 object-contain"
                />
              )}
              <UploadButton
                label={uploading === "logo" ? t("uploading") : t("upload")}
                busy={uploading === "logo"}
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onFile={async (f) => {
                  const url = await upload(f, "logo");
                  if (url) patch({ logo_url: url });
                }}
              />
              {b.logo_url && (
                <RemoveButton label={t("remove")} onClick={() => patch({ logo_url: null })} />
              )}
            </div>
          </Field>

          {/* Banner */}
          <Field
            label={t("banner")}
            hint={t("banner_hint")}
            icon={<ImageIcon className="h-3.5 w-3.5" />}
          >
            {b.banner_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.banner_url}
                alt=""
                className="mb-2 h-24 w-full max-w-md rounded-lg border border-ink-100 object-cover"
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <UploadButton
                label={uploading === "banner" ? t("uploading") : t("upload")}
                busy={uploading === "banner"}
                accept="image/jpeg,image/png,image/webp"
                onFile={async (f) => {
                  const url = await upload(f, "banner");
                  if (url) patch({ banner_url: url });
                }}
              />
              {b.banner_url && (
                <RemoveButton label={t("remove")} onClick={() => patch({ banner_url: null })} />
              )}
            </div>
            {b.banner_url && (
              <label className="mt-3 block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-600">
                  {t("scrim")}
                  <HelpTooltip term="scrim" />
                  <span className="tabular-nums text-ink-400">
                    {Math.round(b.banner_overlay_opacity * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(b.banner_overlay_opacity * 100)}
                  onChange={(e) => patch({ banner_overlay_opacity: Number(e.target.value) / 100 })}
                  className="w-full accent-grass-700"
                />
              </label>
            )}
          </Field>

          {/* Colors */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label={t("background_color")}
              value={b.background_color}
              fallback={DEFAULT_BG}
              onChange={(v) => patch({ background_color: v })}
              enableLabel={t("use_custom")}
            />
            <ColorField
              label={t("accent_color")}
              value={b.accent_color}
              fallback={DEFAULT_ACCENT}
              onChange={(v) => patch({ accent_color: v })}
              enableLabel={t("use_custom")}
              tooltip={<HelpTooltip term="accent_color" />}
            />
          </div>

          {/* Gradient — only meaningful when a background color is set */}
          {b.background_color && (
            <ColorField
              label={t("gradient_to")}
              hint={t("gradient_hint")}
              value={b.background_gradient_to}
              fallback={DEFAULT_GRADIENT}
              onChange={(v) => patch({ background_gradient_to: v })}
              enableLabel={t("gradient_enable")}
            />
          )}

          {/* Preset selects */}
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label={t("theme_preset")}
              tooltip={<HelpTooltip term="theme_preset" />}
              value={b.theme_preset}
              options={THEME_PRESETS.map((v) => ({ value: v, label: t(`theme_presets.${v}`) }))}
              onChange={(v) => patch({ theme_preset: v as TournamentBranding["theme_preset"] })}
            />
            <SelectField
              label={t("corner_style")}
              value={b.corner_style}
              options={CORNER_STYLES.map((v) => ({ value: v, label: t(`corner_styles.${v}`) }))}
              onChange={(v) => patch({ corner_style: v as TournamentBranding["corner_style"] })}
            />
            <SelectField
              label={t("font_pairing")}
              value={b.font_pairing}
              options={FONT_PAIRINGS.map((v) => ({ value: v, label: t(`font_pairings.${v}`) }))}
              onChange={(v) => patch({ font_pairing: v as TournamentBranding["font_pairing"] })}
            />
          </div>

          {/* Text */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink-800">
                {t("title_override")}
              </span>
              <input
                type="text"
                value={b.title_override ?? ""}
                maxLength={120}
                placeholder={t("title_override_placeholder")}
                onChange={(e) => patch({ title_override: e.target.value })}
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink-800">{t("tagline")}</span>
              <input
                type="text"
                value={b.tagline ?? ""}
                maxLength={200}
                placeholder={t("tagline_placeholder")}
                onChange={(e) => patch({ tagline: e.target.value })}
                className={INPUT}
              />
            </label>
          </div>

          {/* Sponsors */}
          <SponsorEditor
            sponsors={b.sponsors}
            onChange={(sponsors) => patch({ sponsors })}
            upload={(f) => upload(f, "sponsor")}
            uploading={uploading === "sponsor"}
            labels={{
              title: t("sponsors"),
              hint: t("sponsors_hint"),
              add: t("sponsors_add"),
              name: t("sponsors_name"),
              url: t("sponsors_url"),
              logo: t("upload"),
              remove: t("remove"),
              empty: t("sponsors_empty"),
            }}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || uploading != null}
              className={BTN_PRIMARY}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {saving ? t("saving") : t("save")}
            </button>
            <a href={publicHref} target="_blank" rel="noreferrer" className={BTN_GHOST}>
              <ExternalLink className="h-4 w-4" />
              {t("view_public")}
            </a>
            {status === "saved" && <span className="text-sm text-grass-700">{t("saved")}</span>}
            {status === "error" && (
              <span className="text-sm text-clay-700">{error ?? t("error")}</span>
            )}
          </div>
        </div>

        {/* ── Live preview ─────────────────────────────────────── */}
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-500">
            {t("preview")}
          </span>
          <BrandingPreview
            theme={preview}
            branding={b}
            emptyLabel={t("preview_empty")}
            sampleTitle={t("preview_title")}
          />
        </div>
      </div>
    </section>
  );
}

// ─── Live preview ─────────────────────────────────────────────────────────────

function BrandingPreview({
  theme,
  branding,
  emptyLabel,
  sampleTitle,
}: {
  theme: ReturnType<typeof buildRoomTheme>;
  branding: TournamentBranding;
  emptyLabel: string;
  sampleTitle: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 shadow-inner">
      <div className={theme.fontClass} style={{ ...theme.backgroundStyle, color: theme.textColor }}>
        {/* Banner with scrim */}
        <div className="relative flex h-28 items-end p-3">
          {theme.bannerImageStyle ? (
            <>
              <div
                aria-hidden
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: theme.bannerImageStyle }}
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, rgba(0,0,0,${theme.scrimOpacity}), rgba(0,0,0,${Math.max(
                    0,
                    theme.scrimOpacity - 0.25,
                  )}))`,
                }}
              />
            </>
          ) : (
            !theme.themed && (
              <span className="absolute inset-0 grid place-items-center text-xs text-ink-400">
                {emptyLabel}
              </span>
            )
          )}
          <div className="relative flex items-center gap-2">
            {theme.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.logoUrl}
                alt=""
                className="h-9 w-9 rounded-md border-2 object-contain"
                style={{
                  borderColor: theme.accentColor ?? "transparent",
                  background: "rgba(255,255,255,0.9)",
                }}
              />
            )}
            <span
              className="text-sm font-bold drop-shadow"
              style={{ color: theme.bannerImageStyle ? "#fff" : theme.textColor }}
            >
              {branding.title_override || sampleTitle}
            </span>
          </div>
        </div>
        <div className="space-y-2 p-3">
          {branding.tagline && (
            <p className="text-xs" style={{ color: theme.mutedTextColor }}>
              {branding.tagline}
            </p>
          )}
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: theme.accentColor ?? DEFAULT_ACCENT,
              color: theme.onAccentColor,
            }}
          >
            CTA
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Small building blocks ──────────────────────────────────────────────────

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 flex items-center gap-1 text-sm font-medium text-ink-800">
        {icon}
        {label}
      </span>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

function UploadButton({
  label,
  busy,
  accept,
  onFile,
}: {
  label: string;
  busy: boolean;
  accept: string;
  onFile: (f: File) => void;
}) {
  return (
    <label className={BTN_GHOST}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      {label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1 rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm font-medium text-ink-700 transition hover:bg-clay-50 hover:text-clay-700"
    >
      <Trash2 className="h-4 w-4" />
      {label}
    </button>
  );
}

function ColorField({
  label,
  hint,
  value,
  fallback,
  onChange,
  enableLabel,
  tooltip,
}: {
  label: string;
  hint?: string;
  value: string | null;
  fallback: string;
  onChange: (v: string | null) => void;
  enableLabel: string;
  tooltip?: React.ReactNode;
}) {
  const on = value != null;
  return (
    <div>
      <span className="mb-1 flex items-center gap-1 text-sm font-medium text-ink-800">
        {label}
        {tooltip}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => onChange(e.target.checked ? fallback : null)}
            className="h-4 w-4 rounded border-ink-300"
          />
          {enableLabel}
        </label>
        {on && (
          <>
            <input
              type="color"
              value={value ?? fallback}
              onChange={(e) => onChange(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-ink-200"
            />
            <input
              type="text"
              value={value ?? fallback}
              onChange={(e) => onChange(e.target.value)}
              className={`${INPUT} w-28 font-mono`}
              maxLength={7}
            />
          </>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

function SelectField({
  label,
  tooltip,
  value,
  options,
  onChange,
}: {
  label: string;
  tooltip?: React.ReactNode;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-sm font-medium text-ink-800">
        {label}
        {tooltip}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SponsorEditor({
  sponsors,
  onChange,
  upload,
  uploading,
  labels,
}: {
  sponsors: Sponsor[];
  onChange: (s: Sponsor[]) => void;
  upload: (f: File) => Promise<string | null>;
  uploading: boolean;
  labels: {
    title: string;
    hint: string;
    add: string;
    name: string;
    url: string;
    logo: string;
    remove: string;
    empty: string;
  };
}) {
  function add() {
    if (sponsors.length >= 12) return;
    onChange([...sponsors, { name: "", logo_url: null, url: null }]);
  }
  function update(i: number, next: Partial<Sponsor>) {
    onChange(sponsors.map((s, idx) => (idx === i ? { ...s, ...next } : s)));
  }
  function remove(i: number) {
    onChange(sponsors.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-ink-800">{labels.title}</span>
      <p className="mb-2 text-xs text-ink-500">{labels.hint}</p>
      {sponsors.length === 0 ? (
        <p className="mb-2 text-xs text-ink-400">{labels.empty}</p>
      ) : (
        <ul className="mb-2 space-y-2">
          {sponsors.map((s, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-100 bg-ink-50/40 p-2"
            >
              {s.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.logo_url}
                  alt=""
                  className="h-8 w-8 rounded border border-ink-100 bg-white object-contain"
                />
              )}
              <input
                type="text"
                value={s.name}
                maxLength={80}
                placeholder={labels.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className={`${INPUT} w-36 flex-1`}
              />
              <input
                type="url"
                value={s.url ?? ""}
                maxLength={1000}
                placeholder={labels.url}
                onChange={(e) =>
                  update(i, { url: e.target.value.trim() === "" ? null : e.target.value })
                }
                className={`${INPUT} w-44 flex-1 font-mono text-xs`}
              />
              <UploadButton
                label={labels.logo}
                busy={uploading}
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onFile={async (f) => {
                  const url = await upload(f);
                  if (url) update(i, { logo_url: url });
                }}
              />
              <RemoveButton label={labels.remove} onClick={() => remove(i)} />
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={add} disabled={sponsors.length >= 12} className={BTN_GHOST}>
        <Plus className="h-4 w-4" />
        {labels.add}
      </button>
    </div>
  );
}
