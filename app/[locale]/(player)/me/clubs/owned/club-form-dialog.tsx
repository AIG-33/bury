"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { ClubFormSchema, type ClubForm, JOIN_POLICIES, type JoinPolicy } from "@/lib/clubs/schema";
import { nameToSlug } from "@/lib/clubs/slug";
import { createClub, updateClub, type OwnedClubDetail } from "./actions";

type DialogLabels = {
  create_title: string;
  edit_title: string;
  fields: {
    name: string;
    slug: string;
    slug_hint: string;
    description: string;
    description_hint: string;
    city: string;
    district: string;
    district_any: string;
    join_policy: string;
  };
  hints: Record<JoinPolicy, string>;
  save: string;
  saving: string;
  cancel: string;
  errors: Record<string, string>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initial: OwnedClubDetail | null;
  districts: Array<{ id: string; name: string; city: string }>;
  labels: DialogLabels;
  joinPolicyLabels: Record<JoinPolicy, string>;
};

export function ClubFormDialog({
  open,
  onClose,
  initial,
  districts,
  labels,
  joinPolicyLabels,
}: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClubForm>({
    resolver: zodResolver(ClubFormSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          slug: initial.slug,
          description: initial.description,
          logo_url: initial.logo_url,
          city: initial.city,
          district_id: initial.district_id,
          join_policy: initial.join_policy,
        }
      : {
          name: "",
          slug: "",
          description: null,
          logo_url: null,
          city: null,
          district_id: null,
          join_policy: "approval",
        },
  });

  // Auto-suggest slug from the name while the user types — but only if
  // they haven't manually touched the slug field yet.
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const nameValue = watch("name");
  useEffect(() => {
    if (!slugTouched && nameValue) {
      setValue("slug", nameToSlug(nameValue), { shouldValidate: true });
    }
  }, [nameValue, slugTouched, setValue]);

  useEffect(() => {
    if (open) {
      setSubmitError(null);
      reset(
        initial
          ? {
              name: initial.name,
              slug: initial.slug,
              description: initial.description,
              logo_url: initial.logo_url,
              city: initial.city,
              district_id: initial.district_id,
              join_policy: initial.join_policy,
            }
          : {
              name: "",
              slug: "",
              description: null,
              logo_url: null,
              city: null,
              district_id: null,
              join_policy: "approval",
            },
      );
      setSlugTouched(!!initial);
    }
  }, [open, initial, reset]);

  if (!open) return null;

  const onSubmit = (values: ClubForm) => {
    setSubmitError(null);
    startTransition(async () => {
      const res = initial ? await updateClub(initial.id, values) : await createClub(values);
      if (res.ok) {
        onClose();
        router.refresh();
      } else {
        setSubmitError(res.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8"
      onClick={() => !isPending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="shadow-pop max-h-full w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            {initial ? labels.edit_title : labels.create_title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md p-1 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Field label={labels.fields.name}>
            <input
              {...register("name")}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
              maxLength={80}
            />
            <FieldError msg={errors.name?.message} labels={labels.errors} />
          </Field>

          <Field label={labels.fields.slug} hint={labels.fields.slug_hint}>
            <input
              {...register("slug")}
              onChange={(e) => {
                setSlugTouched(true);
                register("slug").onChange(e);
              }}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
              maxLength={40}
            />
            <FieldError msg={errors.slug?.message} labels={labels.errors} />
          </Field>

          <Field label={labels.fields.description} hint={labels.fields.description_hint}>
            <textarea
              {...register("description")}
              rows={4}
              maxLength={4000}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={labels.fields.city}>
              <input
                {...register("city")}
                maxLength={80}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
              />
            </Field>
            <Field label={labels.fields.district}>
              <Controller
                name="district_id"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
                  >
                    <option value="">{labels.fields.district_any}</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.city})
                      </option>
                    ))}
                  </select>
                )}
              />
            </Field>
          </div>

          <Field label={labels.fields.join_policy}>
            <Controller
              name="join_policy"
              control={control}
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-3">
                  {JOIN_POLICIES.map((p) => (
                    <label
                      key={p}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition ${
                        field.value === p
                          ? "border-grass-500 bg-grass-50"
                          : "border-ink-200 bg-white hover:border-grass-300"
                      }`}
                    >
                      <input
                        type="radio"
                        value={p}
                        checked={field.value === p}
                        onChange={() => field.onChange(p)}
                        className="sr-only"
                      />
                      <span className="font-semibold text-ink-900">{joinPolicyLabels[p]}</span>
                      <span className="text-[11px] text-ink-500">{labels.hints[p]}</span>
                    </label>
                  ))}
                </div>
              )}
            />
          </Field>

          {submitError && (
            <p className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
              {labels.errors[submitError] ?? labels.errors.unknown}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="inline-flex h-9 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? labels.saving : labels.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-500">{hint}</span>}
    </label>
  );
}

function FieldError({ msg, labels }: { msg: string | undefined; labels: Record<string, string> }) {
  if (!msg) return null;
  return <span className="mt-1 block text-[11px] text-clay-700">{labels[msg] ?? msg}</span>;
}
