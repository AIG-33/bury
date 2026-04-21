"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  MapPin,
  Building2,
  Trash2,
  Pencil,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { deleteVenue, type DistrictOption, type VenueRow } from "./actions";
import {
  VenueFormDialog,
  type VenueDialogCopy,
} from "./venue-form-dialog";
import type { VenueAmenity } from "@/lib/venues/schema";

export type VenuesListCopy = {
  empty_title: string;
  empty_description: string;
  empty_cta: string;
  add: string;
  edit: string;
  delete: string;
  delete_confirm: string;
  deleting: string;
  open: string;
  courts: (n: number) => string;
  indoor: string;
  outdoor: string;
  no_district: string;
  amenity_labels: Record<VenueAmenity, string>;
  dialog: VenueDialogCopy;
};

export function VenuesClient({
  locale,
  venues,
  districts,
  copy,
}: {
  locale: string;
  venues: VenueRow[];
  districts: DistrictOption[];
  copy: VenuesListCopy;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VenueRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startT] = useTransition();
  const router = useRouter();

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(v: VenueRow) {
    setEditing(v);
    setOpen(true);
  }

  function onDelete(id: string) {
    if (!confirm(copy.delete_confirm)) return;
    setDeletingId(id);
    startT(async () => {
      const r = await deleteVenue(id);
      setDeletingId(null);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white shadow-card transition hover:bg-grass-600"
        >
          <Plus className="h-4 w-4" /> {copy.add}
        </button>
      </div>

      {venues.length === 0 ? (
        <EmptyState
          title={copy.empty_title}
          description={copy.empty_description}
          action={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white shadow-card transition hover:bg-grass-600"
            >
              <Plus className="h-4 w-4" /> {copy.empty_cta}
            </button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {venues.map((v) => (
            <li
              key={v.id}
              className="flex flex-col rounded-xl2 border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-pop"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-ink-900">
                    {v.name}
                  </h3>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-600">
                    <MapPin className="h-3 w-3" />
                    {[v.city, v.district_name].filter(Boolean).join(" · ") ||
                      copy.no_district}
                  </p>
                </div>
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                    (v.is_indoor
                      ? "bg-grass-100 text-grass-800 ring-1 ring-grass-200"
                      : "bg-ball-100 text-ball-800 ring-1 ring-ball-200")
                  }
                >
                  {v.is_indoor ? copy.indoor : copy.outdoor}
                </span>
              </div>

              {v.address && (
                <p className="mt-2 text-xs text-ink-500">{v.address}</p>
              )}

              {v.amenities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {v.amenities.slice(0, 6).map((a) => (
                    <span
                      key={a}
                      className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-700"
                    >
                      {copy.amenity_labels[a]}
                    </span>
                  ))}
                  {v.amenities.length > 6 && (
                    <span className="text-[10px] text-ink-400">
                      +{v.amenities.length - 6}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-grass-50 px-2 py-1 text-xs font-semibold text-grass-800">
                  <Building2 className="h-3.5 w-3.5" />
                  {copy.courts(v.courts_count)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                  >
                    <Pencil className="h-3 w-3" /> {copy.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(v.id)}
                    disabled={pending && deletingId === v.id}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-clay-200 px-2 text-xs font-medium text-clay-700 transition hover:bg-clay-50 disabled:opacity-50"
                  >
                    {pending && deletingId === v.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    {pending && deletingId === v.id ? copy.deleting : copy.delete}
                  </button>
                  <Link
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    href={`/${locale}/coach/venues/${v.id}` as any}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-ink-900 px-3 text-xs font-semibold text-white transition hover:bg-ink-700"
                  >
                    {copy.open} <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <VenueFormDialog
        open={open}
        onClose={() => setOpen(false)}
        initial={editing}
        districts={districts}
        copy={copy.dialog}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
