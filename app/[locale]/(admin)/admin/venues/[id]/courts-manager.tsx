"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Wrench,
  Building2,
  CloudSun,
} from "lucide-react";
import {
  COURT_SURFACES,
  COURT_STATUSES,
  type CourtSurface,
  type CourtStatus,
} from "@/lib/venues/schema";
import { createCourt, updateCourt, deleteCourt, type CourtRow } from "../actions";

export type CourtsManagerCopy = {
  title: string;
  intro: string;
  empty: string;
  add_title: string;
  number: string;
  name: string;
  name_placeholder: string;
  surface: string;
  indoor_label: string;
  indoor_yes: string;
  indoor_no: string;
  status: string;
  status_options: Record<CourtStatus, string>;
  surface_options: Record<CourtSurface, string>;
  none: string;
  add: string;
  adding: string;
  save: string;
  saving: string;
  saved: string;
  delete: string;
  delete_confirm: string;
  duplicate: string;
  error: string;
};

export function CourtsManager({
  venueId,
  initialCourts,
  copy,
}: {
  venueId: string;
  initialCourts: CourtRow[];
  copy: CourtsManagerCopy;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // New-court form state. New courts default to indoor=false (outdoor) — most
  // newly added courts at Belarusian venues are outdoor; the editor flips this
  // for indoor halls. The venue's overall indoor_status is recomputed
  // server-side via trigger after each insert.
  const [newNumber, setNewNumber] = useState<number>(nextFreeNumber(initialCourts));
  const [newName, setNewName] = useState("");
  const [newSurface, setNewSurface] = useState<CourtSurface | "">("");
  const [newStatus, setNewStatus] = useState<CourtStatus>("active");
  const [newIsIndoor, setNewIsIndoor] = useState<boolean>(false);

  function onAdd() {
    setErrMsg(null);
    startAdd(async () => {
      const r = await createCourt({
        venue_id: venueId,
        number: newNumber,
        name: newName.trim() || null,
        surface: newSurface === "" ? null : newSurface,
        status: newStatus,
        is_indoor: newIsIndoor,
      });
      if (!r.ok) {
        setErrMsg(r.error === "duplicate_number" ? copy.duplicate : r.error);
        return;
      }
      setNewNumber((n) => n + 1);
      setNewName("");
      setNewSurface("");
      setNewStatus("active");
      setNewIsIndoor(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink-900">{copy.title}</h2>
      </header>
      <p className="mb-4 text-sm text-ink-600">{copy.intro}</p>

      {errMsg && (
        <div className="mb-3 flex items-start gap-2 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-800">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>
            {copy.error}: {errMsg}
          </span>
        </div>
      )}

      {/* Existing courts */}
      {initialCourts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-200 bg-ink-50/40 px-4 py-6 text-center text-sm text-ink-500">
          {copy.empty}
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
          {initialCourts.map((c) => (
            <CourtRowEditor
              key={c.id}
              court={c}
              venueId={venueId}
              copy={copy}
              busy={pendingId === c.id}
              setBusy={(b) => setPendingId(b ? c.id : null)}
            />
          ))}
        </ul>
      )}

      {/* Add new */}
      <div className="mt-5 rounded-xl bg-grass-50/50 p-4 ring-1 ring-grass-100">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-grass-800">
          {copy.add_title}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[64px_1fr_120px_150px_120px_auto] sm:items-end">
          <NumberField label={copy.number} value={newNumber} onChange={setNewNumber} />
          <TextField
            label={copy.name}
            value={newName}
            onChange={setNewName}
            placeholder={copy.name_placeholder}
          />
          <SelectField
            label={copy.surface}
            value={newSurface}
            onChange={(v) => setNewSurface(v as CourtSurface | "")}
            options={[
              { value: "", label: copy.none },
              ...COURT_SURFACES.map((s) => ({ value: s, label: copy.surface_options[s] })),
            ]}
          />
          <IndoorField
            label={copy.indoor_label}
            yesLabel={copy.indoor_yes}
            noLabel={copy.indoor_no}
            value={newIsIndoor}
            onChange={setNewIsIndoor}
          />
          <SelectField
            label={copy.status}
            value={newStatus}
            onChange={(v) => setNewStatus(v as CourtStatus)}
            options={COURT_STATUSES.map((s) => ({
              value: s,
              label: copy.status_options[s],
            }))}
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={isAdding}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50"
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {copy.adding}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> {copy.add}
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Editable row ─────────────────────────────────────────────────────────────

function CourtRowEditor({
  court,
  venueId,
  copy,
  busy,
  setBusy,
}: {
  court: CourtRow;
  venueId: string;
  copy: CourtsManagerCopy;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const router = useRouter();
  const [number, setNumber] = useState(court.number);
  const [name, setName] = useState(court.name ?? "");
  const [surface, setSurface] = useState<CourtSurface | "">(court.surface ?? "");
  const [status, setStatus] = useState<CourtStatus>(court.status);
  const [isIndoor, setIsIndoor] = useState<boolean>(court.is_indoor);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [_, startT] = useTransition();

  const dirty =
    number !== court.number ||
    (name || null) !== (court.name ?? null) ||
    (surface || null) !== (court.surface ?? null) ||
    status !== court.status ||
    isIndoor !== court.is_indoor;

  function save() {
    setErrMsg(null);
    setBusy(true);
    startT(async () => {
      const r = await updateCourt({
        id: court.id,
        venue_id: venueId,
        number,
        name: name.trim() || null,
        surface: surface === "" ? null : surface,
        status,
        is_indoor: isIndoor,
      });
      setBusy(false);
      if (!r.ok) {
        setErrMsg(r.error === "duplicate_number" ? copy.duplicate : r.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
      setTimeout(() => setSavedAt(null), 1500);
    });
  }

  function remove() {
    if (!confirm(copy.delete_confirm)) return;
    setBusy(true);
    startT(async () => {
      const r = await deleteCourt(court.id);
      setBusy(false);
      if (!r.ok) {
        setErrMsg(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="grid grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-[64px_1fr_120px_150px_120px_auto] sm:items-center">
      <NumberField label={copy.number} value={number} onChange={setNumber} compact />
      <TextField label={copy.name} value={name} onChange={setName} compact />
      <SelectField
        label={copy.surface}
        compact
        value={surface}
        onChange={(v) => setSurface(v as CourtSurface | "")}
        options={[
          { value: "", label: copy.none },
          ...COURT_SURFACES.map((s) => ({ value: s, label: copy.surface_options[s] })),
        ]}
      />
      <IndoorField
        label={copy.indoor_label}
        yesLabel={copy.indoor_yes}
        noLabel={copy.indoor_no}
        value={isIndoor}
        onChange={setIsIndoor}
        compact
      />
      <SelectField
        label={copy.status}
        compact
        value={status}
        onChange={(v) => setStatus(v as CourtStatus)}
        options={COURT_STATUSES.map((s) => ({
          value: s,
          label: copy.status_options[s],
        }))}
        prefix={
          status === "maintenance" ? (
            <Wrench className="h-3 w-3 text-clay-700" />
          ) : (
            <CircleDot className="h-3 w-3 text-grass-700" />
          )
        }
      />
      <div className="flex items-center gap-2 sm:justify-end">
        {savedAt && <CheckCircle2 className="h-4 w-4 text-grass-700" />}
        {errMsg && <span className="text-[11px] text-clay-700">{errMsg}</span>}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-grass-500 px-3 text-xs font-medium text-white transition hover:bg-grass-600 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {busy ? copy.saving : copy.save}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="inline-flex h-8 items-center justify-center rounded-md border border-clay-200 px-2 text-clay-700 transition hover:bg-clay-50 disabled:opacity-40"
          aria-label={copy.delete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function NumberField({
  label,
  value,
  onChange,
  compact,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <div>
      {!compact && <Label>{label}</Label>}
      <input
        type="number"
        min={1}
        max={99}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 1)}
        className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-center font-mono text-sm outline-none transition focus:border-grass-500"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <div>
      {!compact && <Label>{label}</Label>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm outline-none transition focus:border-grass-500"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  compact,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  compact?: boolean;
  prefix?: React.ReactNode;
}) {
  return (
    <div>
      {!compact && <Label>{label}</Label>}
      <div className="flex h-9 items-center gap-1 rounded-md border border-ink-200 bg-white px-2 transition focus-within:border-grass-500">
        {prefix}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full flex-1 bg-transparent text-sm outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-500">
      {children}
    </label>
  );
}

// Segmented two-state toggle: «Крытый | Открытый». Lighter than a Select for
// a binary choice and reads well in the row layout next to Surface/Status.
function IndoorField({
  label,
  yesLabel,
  noLabel,
  value,
  onChange,
  compact,
}: {
  label: string;
  yesLabel: string;
  noLabel: string;
  value: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  const baseSeg =
    "inline-flex h-9 flex-1 items-center justify-center gap-1 px-2 text-xs font-medium transition";
  return (
    <div>
      {!compact && <Label>{label}</Label>}
      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white">
        <button
          type="button"
          onClick={() => onChange(false)}
          aria-pressed={!value}
          className={
            baseSeg +
            (!value
              ? " bg-ball-100 text-ball-900 ring-1 ring-inset ring-ball-300"
              : " text-ink-600 hover:bg-ink-50")
          }
        >
          <CloudSun className="h-3.5 w-3.5" />
          {noLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          aria-pressed={value}
          className={
            baseSeg +
            " border-l border-ink-200 " +
            (value
              ? "bg-grass-100 text-grass-900 ring-1 ring-inset ring-grass-300"
              : "text-ink-600 hover:bg-ink-50")
          }
        >
          <Building2 className="h-3.5 w-3.5" />
          {yesLabel}
        </button>
      </div>
    </div>
  );
}

function nextFreeNumber(courts: CourtRow[]): number {
  if (courts.length === 0) return 1;
  const used = new Set(courts.map((c) => c.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}
