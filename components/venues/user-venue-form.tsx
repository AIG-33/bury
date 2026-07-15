"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { AlertCircle, Building2, ImagePlus, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { CoachLocationPicker } from "@/components/map/coach-location-picker";
import { HelpTooltip } from "@/components/help/help-tooltip";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  UserVenueFormSchema,
  VENUE_AMENITIES,
  COURT_SURFACES,
  type UserVenueForm,
  type VenueAmenity,
} from "@/lib/venues/schema";
import {
  createUserVenue,
  updateUserVenue,
  type DistrictOption,
} from "@/app/[locale]/venues/user-actions";

type Props = {
  userId: string;
  districts: DistrictOption[];
  /** Present in the edit flow; absent when creating. */
  initial?: (UserVenueForm & { id: string }) | null;
};

const INPUT =
  "h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30";

export function UserVenueForm({ userId, districts, initial }: Props) {
  const t = useTranslations("venuesCatalog.form");
  const tAmenities = useTranslations("venues.amenities");
  const tSurfaces = useTranslations("venues.detail.courts.surface_options");
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [pending, startT] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<UserVenueForm>({
    resolver: zodResolver(UserVenueFormSchema),
    defaultValues: initial ?? {
      name: "",
      city: null,
      district_id: null,
      address: null,
      lat: null,
      lng: null,
      amenities: [],
      website: null,
      phone: null,
      photo_url: null,
      courts: [],
    },
  });

  const courtsArray = useFieldArray({ control: form.control, name: "courts" });
  const lat = form.watch("lat");
  const lng = form.watch("lng");
  const photoUrl = form.watch("photo_url");

  async function uploadPhoto(file: File) {
    setErrMsg(null);
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/venue-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("venue-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        setErrMsg(error.message);
        return;
      }
      const { data } = supabase.storage.from("venue-photos").getPublicUrl(path);
      form.setValue("photo_url", data.publicUrl, { shouldDirty: true });
    } finally {
      setUploading(false);
    }
  }

  function removeCourt(index: number) {
    const court = form.getValues(`courts.${index}`);
    if (court.id && !confirm(t("courts.remove_confirm"))) return;
    courtsArray.remove(index);
  }

  const onSubmit = form.handleSubmit((values) => {
    setErrMsg(null);
    startT(async () => {
      const r = isEdit
        ? await updateUserVenue({ id: initial!.id, ...values })
        : await createUserVenue(values);
      if (r.ok) {
        router.push(`/venues/${r.id}` as never);
        router.refresh();
      } else {
        let msg: string;
        try {
          msg = t(`errors.${r.error}` as never);
        } catch {
          msg = r.error;
        }
        setErrMsg(msg);
      }
    });
  });

  const fieldErrors = form.formState.errors;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {errMsg && (
        <div className="flex items-start gap-2 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}

      <section className="space-y-4 rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
        <h2 className="font-display text-base font-semibold text-ink-900">
          {t("sections.basics")}
        </h2>

        <Field label={t("fields.name")} required error={fieldErrors.name?.message}>
          <input {...form.register("name")} className={INPUT} placeholder="Аква-Минск" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.city")}>
            <input {...form.register("city")} className={INPUT} placeholder="Минск" />
          </Field>
          <Field label={t("fields.district")}>
            <Controller
              control={form.control}
              name="district_id"
              render={({ field }) => (
                <select
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                  className={INPUT}
                >
                  <option value="">{t("none")}</option>
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

        <Field label={t("fields.address")} hint={t("hints.address")}>
          <input
            {...form.register("address")}
            className={INPUT}
            placeholder="пр. Победителей 120, Минск"
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center gap-1">
            <span className="text-xs font-medium text-ink-700">{t("fields.location")}</span>
            <HelpTooltip
              term="venue_location"
              title={t("fields.location")}
              description={t("hints.location")}
            />
          </div>
          <CoachLocationPicker
            lat={lat ?? null}
            lng={lng ?? null}
            onPick={(la, ln) => {
              form.setValue("lat", la, { shouldDirty: true });
              form.setValue("lng", ln, { shouldDirty: true });
            }}
            onClear={() => {
              form.setValue("lat", null, { shouldDirty: true });
              form.setValue("lng", null, { shouldDirty: true });
            }}
            labels={{
              search_placeholder: t("map.search_placeholder"),
              picked: t("map.picked"),
              clear: t("map.clear"),
              hint: t("map.hint"),
              none: t("map.none"),
            }}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
        <h2 className="font-display text-base font-semibold text-ink-900">
          {t("sections.details")}
        </h2>

        <div>
          <label className="mb-2 block text-xs font-medium text-ink-700">
            {t("fields.amenities")}
          </label>
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
                        {tAmenities(a)}
                      </button>
                    );
                  })}
                </div>
              );
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t("fields.website")}
            error={fieldErrors.website?.message ? t("errors.invalid_website") : undefined}
          >
            <input
              {...form.register("website")}
              className={INPUT}
              inputMode="url"
              placeholder="https://example.by"
            />
          </Field>
          <Field label={t("fields.phone")}>
            <input
              {...form.register("phone")}
              className={INPUT}
              inputMode="tel"
              placeholder="+375 29 000-00-00"
            />
          </Field>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-700">
            {t("fields.photo")}
          </label>
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="mb-2 h-36 w-full max-w-md rounded-lg border border-ink-100 object-cover"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              {uploading ? t("photo.uploading") : t("photo.upload")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadPhoto(f);
                  e.target.value = "";
                }}
              />
            </label>
            {photoUrl && (
              <button
                type="button"
                onClick={() => form.setValue("photo_url", null, { shouldDirty: true })}
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-ink-500 transition hover:bg-ink-50 hover:text-clay-700"
              >
                {t("photo.remove")}
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-ink-500">{t("hints.photo")}</p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <h2 className="font-display text-base font-semibold text-ink-900">
              {t("sections.courts")}
            </h2>
            <HelpTooltip
              term="venue_courts"
              title={t("sections.courts")}
              description={t("hints.courts")}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              courtsArray.append({
                number: nextCourtNumber(form.getValues("courts")),
                name: null,
                surface: null,
                is_indoor: false,
              })
            }
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
          >
            <Plus className="h-4 w-4" />
            {t("courts.add")}
          </button>
        </div>

        {typeof fieldErrors.courts?.message === "string" && (
          <p className="text-xs text-clay-700">{t("errors.duplicate_court_numbers")}</p>
        )}

        {courtsArray.fields.length === 0 ? (
          <p className="text-sm text-ink-500">{t("courts.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {courtsArray.fields.map((f, i) => (
              <li
                key={f.id}
                className="grid grid-cols-[64px_1fr] items-end gap-2 rounded-lg border border-ink-100 bg-ink-50/30 p-2.5 sm:grid-cols-[64px_1fr_130px_auto_auto] sm:items-center"
              >
                <label className="block">
                  <span className="mb-1 block text-[11px] text-ink-500">{t("courts.number")}</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    {...form.register(`courts.${i}.number`)}
                    className={INPUT + " tabular-nums"}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-ink-500">{t("courts.name")}</span>
                  <input
                    {...form.register(`courts.${i}.name`)}
                    className={INPUT}
                    placeholder={t("courts.name_placeholder")}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-ink-500">{t("courts.surface")}</span>
                  <Controller
                    control={form.control}
                    name={`courts.${i}.surface`}
                    render={({ field }) => (
                      <select
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : e.target.value)
                        }
                        className={INPUT}
                      >
                        <option value="">{t("none")}</option>
                        {COURT_SURFACES.map((s) => (
                          <option key={s} value={s}>
                            {tSurfaces(s)}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </label>
                <label className="inline-flex h-10 items-center gap-2 text-sm text-ink-700">
                  <Controller
                    control={form.control}
                    name={`courts.${i}.is_indoor`}
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-ink-300 text-grass-600 focus:ring-grass-500"
                      />
                    )}
                  />
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-ink-400" />
                    {t("courts.indoor")}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => removeCourt(i)}
                  className="inline-flex h-9 items-center gap-1 justify-self-end rounded-lg px-2 text-sm text-ink-500 transition hover:bg-clay-50 hover:text-clay-700"
                  aria-label={t("courts.remove")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-11 items-center rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending || uploading}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-grass-500 px-6 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {pending ? t("saving") : isEdit ? t("save_edit") : t("save_create")}
        </button>
      </div>
    </form>
  );
}

function nextCourtNumber(courts: Array<{ number: number }>): number {
  const max = courts.reduce((m, c) => Math.max(m, Number(c.number) || 0), 0);
  return Math.min(max + 1, 99);
}

function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-700">
        {label}
        {required && <span className="ml-1 text-clay-600">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-clay-700">{error}</p>}
    </div>
  );
}
