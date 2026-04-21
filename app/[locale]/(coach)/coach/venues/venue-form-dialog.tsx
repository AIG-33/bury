"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  X,
  Loader2,
  AlertCircle,
  Building2,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import {
  VenueFormSchema,
  VENUE_AMENITIES,
  type VenueAmenity,
  type VenueForm,
} from "@/lib/venues/schema";
import { createVenue, updateVenue, type DistrictOption, type VenueRow } from "./actions";

export type VenueDialogCopy = {
  create_title: string;
  edit_title: string;
  fields: {
    name: string;
    city: string;
    district: string;
    district_placeholder: string;
    address: string;
    lat: string;
    lng: string;
    is_indoor: string;
    amenities: string;
  };
  hints: { lat_lng: string; address: string; amenities: string };
  amenity_labels: Record<VenueAmenity, string>;
  save: string;
  saving: string;
  cancel: string;
  saved: string;
  error: string;
  none: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: VenueRow | null;
  districts: DistrictOption[];
  copy: VenueDialogCopy;
  onSaved: () => void;
};

export function VenueFormDialog({
  open,
  onClose,
  initial,
  districts,
  copy,
  onSaved,
}: Props) {
  const isEdit = Boolean(initial?.id);
  const [pending, startT] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const form = useForm<VenueForm>({
    resolver: zodResolver(VenueFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      city: initial?.city ?? null,
      district_id: initial?.district_id ?? null,
      address: initial?.address ?? null,
      lat: initial?.lat ?? null,
      lng: initial?.lng ?? null,
      is_indoor: initial?.is_indoor ?? false,
      amenities: (initial?.amenities ?? []) as VenueAmenity[],
    },
  });

  // Reset form when initial changes (switching between create/edit).
  useEffect(() => {
    form.reset({
      name: initial?.name ?? "",
      city: initial?.city ?? null,
      district_id: initial?.district_id ?? null,
      address: initial?.address ?? null,
      lat: initial?.lat ?? null,
      lng: initial?.lng ?? null,
      is_indoor: initial?.is_indoor ?? false,
      amenities: (initial?.amenities ?? []) as VenueAmenity[],
    });
    setErrMsg(null);
    setSavedTick(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id, open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = form.handleSubmit((values) => {
    setErrMsg(null);
    startT(async () => {
      const r = isEdit
        ? await updateVenue({ id: initial!.id, ...values })
        : await createVenue(values);
      if (r.ok) {
        setSavedTick(true);
        onSaved();
        setTimeout(onClose, 350);
      } else {
        setErrMsg(r.error);
      }
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-pop"
        role="dialog"
        aria-modal="true"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-grass-700" />
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {isEdit ? copy.edit_title : copy.create_title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-500 hover:bg-ink-50 hover:text-ink-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-5">
          {errMsg && (
            <div className="flex items-start gap-2 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-800">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>
                {copy.error}: {errMsg}
              </span>
            </div>
          )}

          <Field label={copy.fields.name} required>
            <Input
              {...form.register("name")}
              placeholder="Bury Tennis Centre — Mokotów"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={copy.fields.city}>
              <Input {...form.register("city")} placeholder="Warszawa" />
            </Field>
            <Field label={copy.fields.district} hint={copy.hints.address}>
              <Controller
                control={form.control}
                name="district_id"
                render={({ field }) => (
                  <select
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : e.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
                  >
                    <option value="">{copy.none}</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </Field>
          </div>

          <Field label={copy.fields.address} hint={copy.hints.address}>
            <Input
              {...form.register("address")}
              placeholder="ul. Puławska 100, 02-595 Warszawa"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={copy.fields.lat} hint={copy.hints.lat_lng}>
              <Input
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                placeholder="52.193"
                {...form.register("lat")}
              />
            </Field>
            <Field label={copy.fields.lng}>
              <Input
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                placeholder="21.022"
                {...form.register("lng")}
              />
            </Field>
          </div>

          <Toggle
            label={copy.fields.is_indoor}
            control={form.control}
            name="is_indoor"
          />

          <div>
            <label className="mb-2 block text-xs font-medium text-ink-700">
              {copy.fields.amenities}
            </label>
            <p className="mb-2 text-[11px] text-ink-500">{copy.hints.amenities}</p>
            <Controller
              control={form.control}
              name="amenities"
              render={({ field }) => {
                const set = new Set<VenueAmenity>(field.value ?? []);
                return (
                  <div className="flex flex-wrap gap-2">
                    {VENUE_AMENITIES.map((a) => {
                      const on = set.has(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => {
                            const next = new Set(set);
                            if (on) next.delete(a);
                            else next.add(a);
                            field.onChange(Array.from(next));
                          }}
                          className={
                            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition " +
                            (on
                              ? "bg-grass-500 text-white shadow-sm"
                              : "bg-ink-100 text-ink-700 hover:bg-ink-200")
                          }
                        >
                          {copy.amenity_labels[a]}
                        </button>
                      );
                    })}
                  </div>
                );
              }}
            />
          </div>

          <footer className="sticky bottom-0 -mx-6 flex items-center justify-end gap-3 border-t border-ink-100 bg-white/95 px-6 pb-1 pt-4 backdrop-blur">
            {savedTick && (
              <span className="inline-flex items-center gap-1 text-sm text-grass-700">
                <CheckCircle2 className="h-4 w-4" /> {copy.saved}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-5 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {copy.saving}
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4" /> {copy.save}
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-700">
        {label}
        {required && <span className="ml-1 text-clay-600">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
    />
  );
}

function Toggle({
  label,
  control,
  name,
}: {
  label: string;
  control: ReturnType<typeof useForm<VenueForm>>["control"];
  name: "is_indoor";
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-ink-100 bg-ink-50/40 px-3 py-2.5">
          <span className="text-sm text-ink-800">{label}</span>
          <button
            type="button"
            role="switch"
            aria-checked={field.value}
            onClick={() => field.onChange(!field.value)}
            className={
              "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition " +
              (field.value ? "bg-grass-500" : "bg-ink-300")
            }
          >
            <span
              className={
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
                (field.value ? "translate-x-5" : "translate-x-0.5")
              }
            />
          </button>
        </label>
      )}
    />
  );
}
