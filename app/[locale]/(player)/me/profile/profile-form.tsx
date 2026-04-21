"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  CheckCircle2,
  Camera,
  Trash2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import {
  ProfileFormSchema,
  type ProfileForm,
  WEEKDAYS,
  TIME_SLOTS,
} from "@/lib/profile/schema";
import { HelpTooltip } from "@/components/help/help-tooltip";
import {
  updateMyProfile,
  uploadMyAvatar,
  removeMyAvatar,
  type ProfileSnapshot,
  type DistrictOption,
} from "./actions";

type Locale = "pl" | "en" | "ru";

type Copy = {
  save: string;
  saving: string;
  saved: string;
  error: string;
  sections: {
    personal: string;
    contacts: string;
    socials: string;
    location: string;
    sport: string;
    availability: string;
    privacy: string;
    notifications: string;
    health: string;
  };
  fields: Record<string, string>;
  hints: Record<string, string>;
  enums: {
    gender: Record<"m" | "f" | "other", string>;
    hand: Record<"R" | "L", string>;
    backhand: Record<"one_handed" | "two_handed", string>;
    surface: Record<"hard" | "clay" | "grass" | "carpet", string>;
    locale: Record<"pl" | "en" | "ru", string>;
    weekday: Record<(typeof WEEKDAYS)[number], string>;
    daypart: Record<(typeof TIME_SLOTS)[number], string>;
  };
  avatar: {
    upload: string;
    uploading: string;
    remove: string;
    too_large: string;
    bad_mime: string;
    requirements: string;
  };
  none: string;
};

type Props = {
  locale: Locale;
  profile: ProfileSnapshot;
  districts: DistrictOption[];
  copy: Copy;
};

export function ProfileForm({ profile, districts, copy }: Props) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      motto: profile.motto,
      favorite_player: profile.favorite_player,
      phone: profile.phone,
      whatsapp: profile.whatsapp,
      telegram_username: profile.telegram_username,
      social_links: profile.social_links,
      city: profile.city,
      district_id: profile.district_id,
      dominant_hand: profile.dominant_hand,
      backhand_style: profile.backhand_style,
      favorite_surface: profile.favorite_surface,
      availability: profile.availability,
      visible_in_find_player: profile.visible_in_find_player,
      visible_in_leaderboard: profile.visible_in_leaderboard,
      notification_email: profile.notification_email,
      notification_telegram: profile.notification_telegram,
      locale: profile.locale,
      health_notes: profile.health_notes,
      emergency_contact: profile.emergency_contact,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setErrMsg(null);
    startTransition(async () => {
      const result = await updateMyProfile(values);
      if (result.ok) {
        setSavedAt(Date.now());
        form.reset(values);
      } else {
        setErrMsg(`${copy.error}: ${result.error}`);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Avatar + sticky save */}
      <div className="sticky top-0 z-10 -mx-6 mb-2 flex items-center justify-between gap-4 border-b border-ink-100 bg-white/85 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <AvatarUploader
            initialUrl={profile.avatar_url}
            displayName={profile.display_name ?? profile.email ?? "?"}
            copy={copy.avatar}
            errLabel={copy.error}
          />
          <div>
            <p className="font-display text-lg font-semibold text-ink-900">
              {profile.display_name ?? profile.email}
            </p>
            <p className="text-xs text-ink-500">
              Elo {profile.current_elo} · {profile.rated_matches_count} matches
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !form.formState.isDirty && (
            <span className="inline-flex items-center gap-1 text-sm text-grass-700">
              <CheckCircle2 className="h-4 w-4" /> {copy.saved}
            </span>
          )}
          <button
            type="submit"
            disabled={isPending || !form.formState.isDirty}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-5 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {copy.saving}
              </>
            ) : (
              copy.save
            )}
          </button>
        </div>
      </div>

      {errMsg && (
        <div className="flex items-start gap-2 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-800">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{errMsg}</span>
        </div>
      )}

      {/* Personal */}
      <Section title={copy.sections.personal} defaultOpen>
        <Grid2>
          <Field label={copy.fields.first_name}>
            <Input {...form.register("first_name")} />
          </Field>
          <Field label={copy.fields.last_name}>
            <Input {...form.register("last_name")} />
          </Field>
          <Field
            label={copy.fields.date_of_birth}
            hint={copy.hints.date_of_birth}
          >
            <Input
              type="date"
              {...form.register("date_of_birth")}
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label={copy.fields.gender}>
            <Controller
              control={form.control}
              name="gender"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={(v) =>
                    field.onChange(
                      v === "" ? null : (v as ProfileForm["gender"]),
                    )
                  }
                  options={[
                    { value: "", label: copy.none },
                    { value: "m", label: copy.enums.gender.m },
                    { value: "f", label: copy.enums.gender.f },
                    { value: "other", label: copy.enums.gender.other },
                  ]}
                />
              )}
            />
          </Field>
          <Field label={copy.fields.favorite_player} className="col-span-2">
            <Input {...form.register("favorite_player")} />
          </Field>
          <Field
            label={copy.fields.motto}
            hint={copy.hints.motto}
            className="col-span-2"
          >
            <Input {...form.register("motto")} placeholder="Game. Set. Match." />
          </Field>
        </Grid2>
      </Section>

      {/* Contacts */}
      <Section title={copy.sections.contacts} defaultOpen>
        <Grid2>
          <Field
            label={copy.fields.whatsapp}
            hint={copy.hints.whatsapp}
            className="col-span-2"
          >
            <div className="flex items-center gap-2 rounded-lg border-2 border-grass-300 bg-grass-50/50 px-3 transition focus-within:border-grass-500 focus-within:ring-2 focus-within:ring-grass-500/30">
              <span className="inline-flex items-center gap-1 rounded-md bg-grass-100 px-2 py-0.5 text-[11px] font-semibold text-grass-800">
                {copy.fields.primary_badge}
              </span>
              <input
                {...form.register("whatsapp")}
                placeholder="+48 600 000 000"
                inputMode="tel"
                className="h-11 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </Field>
          <Field label={copy.fields.phone} hint={copy.hints.phone}>
            <Input
              {...form.register("phone")}
              placeholder="+48 600 000 000"
              inputMode="tel"
            />
          </Field>
          <Field
            label={copy.fields.telegram_username}
            hint={copy.hints.telegram_username}
          >
            <Input {...form.register("telegram_username")} placeholder="@username" />
          </Field>
        </Grid2>
      </Section>

      {/* Socials */}
      <Section title={copy.sections.socials}>
        <Grid2>
          {(
            ["instagram", "facebook", "x", "tiktok", "youtube", "website"] as const
          ).map((k) => (
            <Field key={k} label={copy.fields[`social_${k}`]}>
              <Input
                {...form.register(`social_links.${k}` as const)}
                placeholder="https://..."
              />
            </Field>
          ))}
        </Grid2>
      </Section>

      {/* Location */}
      <Section title={copy.sections.location}>
        <Grid2>
          <Field label={copy.fields.city}>
            <Input {...form.register("city")} placeholder="Warszawa" />
          </Field>
          <Field label={copy.fields.district} hint={copy.hints.district}>
            <Controller
              control={form.control}
              name="district_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(v === "" ? null : v)}
                  options={[
                    { value: "", label: copy.none },
                    ...districts.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                />
              )}
            />
          </Field>
        </Grid2>
      </Section>

      {/* Sport prefs */}
      <Section title={copy.sections.sport}>
        <Grid2>
          <Field label={copy.fields.dominant_hand}>
            <Controller
              control={form.control}
              name="dominant_hand"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={(v) =>
                    field.onChange(v === "" ? null : (v as "R" | "L"))
                  }
                  options={[
                    { value: "", label: copy.none },
                    { value: "R", label: copy.enums.hand.R },
                    { value: "L", label: copy.enums.hand.L },
                  ]}
                />
              )}
            />
          </Field>
          <Field
            label={copy.fields.backhand_style}
            hint={copy.hints.backhand_style}
          >
            <Controller
              control={form.control}
              name="backhand_style"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={(v) =>
                    field.onChange(
                      v === "" ? null : (v as "one_handed" | "two_handed"),
                    )
                  }
                  options={[
                    { value: "", label: copy.none },
                    { value: "one_handed", label: copy.enums.backhand.one_handed },
                    { value: "two_handed", label: copy.enums.backhand.two_handed },
                  ]}
                />
              )}
            />
          </Field>
          <Field label={copy.fields.favorite_surface}>
            <Controller
              control={form.control}
              name="favorite_surface"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={(v) =>
                    field.onChange(
                      v === ""
                        ? null
                        : (v as "hard" | "clay" | "grass" | "carpet"),
                    )
                  }
                  options={[
                    { value: "", label: copy.none },
                    { value: "hard", label: copy.enums.surface.hard },
                    { value: "clay", label: copy.enums.surface.clay },
                    { value: "grass", label: copy.enums.surface.grass },
                    { value: "carpet", label: copy.enums.surface.carpet },
                  ]}
                />
              )}
            />
          </Field>
        </Grid2>
      </Section>

      {/* Availability */}
      <Section title={copy.sections.availability}>
        <p className="mb-3 text-sm text-ink-600">{copy.hints.availability}</p>
        <AvailabilityGrid
          control={form.control}
          weekdayLabels={copy.enums.weekday}
          daypartLabels={copy.enums.daypart}
        />
      </Section>

      {/* Privacy */}
      <Section title={copy.sections.privacy}>
        <Toggle
          label={copy.fields.visible_in_find_player}
          hint={copy.hints.visible_in_find_player}
          control={form.control}
          name="visible_in_find_player"
        />
        <Toggle
          label={copy.fields.visible_in_leaderboard}
          hint={copy.hints.visible_in_leaderboard}
          control={form.control}
          name="visible_in_leaderboard"
        />
      </Section>

      {/* Notifications */}
      <Section title={copy.sections.notifications}>
        <Toggle
          label={copy.fields.notification_email}
          hint={copy.hints.notification_email}
          control={form.control}
          name="notification_email"
        />
        <Toggle
          label={copy.fields.notification_whatsapp}
          hint={copy.hints.notification_whatsapp}
          control={form.control}
          name="notification_whatsapp"
        />
        <Toggle
          label={copy.fields.notification_telegram}
          hint={copy.hints.notification_telegram}
          control={form.control}
          name="notification_telegram"
        />
        <Field label={copy.fields.locale} className="mt-3 max-w-xs">
          <Controller
            control={form.control}
            name="locale"
            render={({ field }) => (
              <Select
                value={field.value}
                onChange={(v) => field.onChange(v as "pl" | "en" | "ru")}
                options={[
                  { value: "pl", label: copy.enums.locale.pl },
                  { value: "en", label: copy.enums.locale.en },
                  { value: "ru", label: copy.enums.locale.ru },
                ]}
              />
            )}
          />
        </Field>
      </Section>

      {/* Health */}
      <Section title={copy.sections.health}>
        <p className="mb-2 text-sm text-ink-600">{copy.hints.health_notes}</p>
        <Field label={copy.fields.health_notes}>
          <textarea
            {...form.register("health_notes")}
            rows={3}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
            placeholder="—"
          />
        </Field>
        <Field label={copy.fields.emergency_contact} className="mt-3">
          <Input {...form.register("emergency_contact")} />
        </Field>
      </Section>
    </form>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl2 border border-ink-100 bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl2 px-5 py-4 text-left transition hover:bg-ink-50"
      >
        <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
        <ChevronDown
          className={`h-4 w-4 text-ink-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && <div className="border-t border-ink-100 px-5 py-4">{children}</div>}
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 flex items-center gap-1 text-sm font-medium text-ink-800">
        {label}
        {hint && <HelpTooltip term={label} description={hint} />}
      </span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      value={(props.value as string | number | undefined) ?? ""}
      onChange={(e) => props.onChange?.(e)}
      className={`h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30 ${
        props.className ?? ""
      }`}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  hint,
  control,
  name,
}: {
  label: string;
  hint?: string;
  control: ReturnType<typeof useForm<ProfileForm>>["control"];
  name:
    | "visible_in_find_player"
    | "visible_in_leaderboard"
    | "notification_email"
    | "notification_whatsapp"
    | "notification_telegram";
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex cursor-pointer items-start justify-between gap-3 py-2">
          <div className="flex-1">
            <div className="flex items-center gap-1 text-sm font-medium text-ink-800">
              {label}
              {hint && <HelpTooltip term={label} description={hint} />}
            </div>
          </div>
          <button
            type="button"
            onClick={() => field.onChange(!field.value)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
              field.value ? "bg-grass-500" : "bg-ink-200"
            }`}
            aria-pressed={field.value}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                field.value ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      )}
    />
  );
}

function AvailabilityGrid({
  control,
  weekdayLabels,
  daypartLabels,
}: {
  control: ReturnType<typeof useForm<ProfileForm>>["control"];
  weekdayLabels: Record<(typeof WEEKDAYS)[number], string>;
  daypartLabels: Record<(typeof TIME_SLOTS)[number], string>;
}) {
  return (
    <Controller
      control={control}
      name="availability"
      render={({ field }) => {
        const value = field.value ?? {};
        const toggle = (
          day: (typeof WEEKDAYS)[number],
          slot: (typeof TIME_SLOTS)[number],
        ) => {
          const current = value[day] ?? [];
          const next = current.includes(slot)
            ? current.filter((s) => s !== slot)
            : [...current, slot];
          field.onChange({ ...value, [day]: next });
        };

        return (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th></th>
                  {TIME_SLOTS.map((s) => (
                    <th key={s} className="text-xs font-medium text-ink-600">
                      {daypartLabels[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((d) => (
                  <tr key={d}>
                    <td className="pr-2 text-right text-xs font-medium text-ink-600">
                      {weekdayLabels[d]}
                    </td>
                    {TIME_SLOTS.map((s) => {
                      const on = (value[d] ?? []).includes(s);
                      return (
                        <td key={s} className="text-center">
                          <button
                            type="button"
                            onClick={() => toggle(d, s)}
                            className={`h-9 w-full rounded-md border text-xs font-medium transition ${
                              on
                                ? "border-grass-500 bg-grass-100 text-grass-800"
                                : "border-ink-200 bg-white text-ink-500 hover:border-grass-300"
                            }`}
                            aria-pressed={on}
                          >
                            {on ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    />
  );
}

function AvatarUploader({
  initialUrl,
  displayName,
  copy,
  errLabel,
}: {
  initialUrl: string | null;
  displayName: string;
  copy: Copy["avatar"];
  errLabel: string;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (file.size > 2 * 1024 * 1024) {
      setErr(copy.too_large);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setErr(copy.bad_mime);
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadMyAvatar(fd);
    setBusy(false);
    if (res.ok) setUrl(res.avatar_url);
    else setErr(`${errLabel}: ${res.error}`);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onRemove() {
    setBusy(true);
    setErr(null);
    const res = await removeMyAvatar();
    setBusy(false);
    if (res.ok) setUrl(null);
    else setErr(`${errLabel}: ${res.error}`);
  }

  const initial = (displayName ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14 overflow-hidden rounded-full bg-grass-100 ring-2 ring-grass-200">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-grass-700">
            {initial}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-grass-700" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-3 text-xs font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            {busy ? copy.uploading : copy.upload}
          </button>
          {url && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-clay-200 px-3 text-xs font-medium text-clay-700 transition hover:bg-clay-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {copy.remove}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onPick}
          />
        </div>
        {err && <p className="text-xs text-clay-700">{err}</p>}
        <p className="text-[11px] text-ink-500">{copy.requirements}</p>
      </div>
    </div>
  );
}
