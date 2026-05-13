"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOpenMatch } from "../actions";
import {
  OPEN_MATCH_FORMATS,
  OPEN_MATCH_LEVEL_BANDS,
  type OpenMatchFormat,
  type OpenMatchLevelBand,
} from "@/lib/open-matches/schema";

type Copy = {
  venue: string;
  district: string;
  starts_at: string;
  duration: string;
  format: string;
  format_singles: string;
  format_doubles: string;
  level: string;
  slots: string;
  notes: string;
  notes_placeholder: string;
  submit: string;
  submitting: string;
  err_invalid_payload: string;
  err_starts_in_past: string;
  err_singles_one_slot_only: string;
  err_location_required: string;
  err_not_authenticated: string;
  err_unknown: string;
  any_venue: string;
  any_district: string;
};

type Props = {
  locale: string;
  venues: Array<{ id: string; name: string; city: string | null }>;
  districts: Array<{ id: string; name: string; city: string }>;
  levelOptions: Array<{ id: OpenMatchLevelBand; label: string }>;
  initialVenueId?: string;
  copy: Copy;
};

const FIELD_ERR_KEYS: Record<string, keyof Copy> = {
  starts_in_past: "err_starts_in_past",
  singles_one_slot_only: "err_singles_one_slot_only",
  location_required: "err_location_required",
};

// One-off form for "post an open match". Kept deliberately simple — no react-
// hook-form here because the surface is small (8 fields) and our server-action
// envelope already returns Zod fieldErrors which we map straight to inline
// messages. If this grows, lift to RHF + zodResolver like /me/profile.
export function CreateOpenMatchForm({
  locale,
  venues,
  districts,
  levelOptions,
  initialVenueId,
  copy,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [venueId, setVenueId] = useState<string>(initialVenueId ?? "");
  const [districtId, setDistrictId] = useState<string>("");
  const [startsAt, setStartsAt] = useState<string>("");
  const [durationMin, setDurationMin] = useState<number>(90);
  const [format, setFormat] = useState<OpenMatchFormat>("singles");
  const [levelBand, setLevelBand] = useState<OpenMatchLevelBand>("any");
  const [slotsNeeded, setSlotsNeeded] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});

    // The <input type="datetime-local"> value has no timezone, so we attach
    // the user's local offset before sending. Zod requires `datetime({offset:
    // true})` so this is mandatory.
    const startsIso = startsAt ? new Date(startsAt).toISOString() : "";

    startTransition(async () => {
      const r = await createOpenMatch({
        venue_id: venueId || null,
        district_id: districtId || null,
        starts_at: startsIso,
        duration_min: durationMin,
        format,
        level_band: levelBand,
        slots_needed: slotsNeeded,
        notes,
      });
      if (r.ok) {
        router.replace(`/${locale}/open-matches/${r.data.id}`);
        return;
      }
      if (r.error === "not_authenticated") {
        setTopError(copy.err_not_authenticated);
        return;
      }
      if (r.error === "invalid_payload" && r.fieldErrors) {
        const next: Record<string, string> = {};
        for (const [field, errs] of Object.entries(r.fieldErrors)) {
          const code = errs?.[0];
          const copyKey = code && FIELD_ERR_KEYS[code];
          next[field] = copyKey ? copy[copyKey] : copy.err_invalid_payload;
        }
        setFieldErrors(next);
        setTopError(copy.err_invalid_payload);
        return;
      }
      setTopError(copy.err_unknown);
    });
  };

  const inputClass =
    "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500";
  const errorClass = "mt-1 text-xs text-clay-700";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {topError && (
        <div className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
          {topError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-800">{copy.venue}</span>
          <select
            className={inputClass}
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
          >
            <option value="">— {copy.any_venue} —</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.city ? ` · ${v.city}` : ""}
              </option>
            ))}
          </select>
          {fieldErrors.venue_id && <p className={errorClass}>{fieldErrors.venue_id}</p>}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-800">{copy.district}</span>
          <select
            className={inputClass}
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
          >
            <option value="">—</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.city} · {d.name}
              </option>
            ))}
          </select>
          {fieldErrors.district_id && <p className={errorClass}>{fieldErrors.district_id}</p>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-800">{copy.starts_at}</span>
          <input
            type="datetime-local"
            className={inputClass}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
          {fieldErrors.starts_at && <p className={errorClass}>{fieldErrors.starts_at}</p>}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-800">{copy.duration}</span>
          <input
            type="number"
            min={30}
            max={300}
            step={15}
            className={inputClass}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            required
          />
          {fieldErrors.duration_min && <p className={errorClass}>{fieldErrors.duration_min}</p>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-800">{copy.format}</span>
          <select
            className={inputClass}
            value={format}
            onChange={(e) => {
              const next = e.target.value as OpenMatchFormat;
              setFormat(next);
              if (next === "singles") setSlotsNeeded(1);
            }}
          >
            {OPEN_MATCH_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f === "singles" ? copy.format_singles : copy.format_doubles}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-800">{copy.level}</span>
          <select
            className={inputClass}
            value={levelBand}
            onChange={(e) => setLevelBand(e.target.value as OpenMatchLevelBand)}
          >
            {levelOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-800">{copy.slots}</span>
          <input
            type="number"
            min={1}
            max={3}
            className={inputClass}
            value={slotsNeeded}
            onChange={(e) => setSlotsNeeded(Number(e.target.value))}
            disabled={format === "singles"}
          />
          {fieldErrors.slots_needed && <p className={errorClass}>{fieldErrors.slots_needed}</p>}
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-800">{copy.notes}</span>
        <textarea
          className={inputClass}
          rows={3}
          maxLength={600}
          placeholder={copy.notes_placeholder}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {fieldErrors.notes && <p className={errorClass}>{fieldErrors.notes}</p>}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600 disabled:opacity-60"
      >
        {pending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}

void OPEN_MATCH_LEVEL_BANDS;
