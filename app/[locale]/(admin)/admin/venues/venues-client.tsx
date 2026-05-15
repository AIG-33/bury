"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, MapPin, Building2, Trash2, Pencil, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/help/empty-state";
import { IndoorStatusBadge } from "@/components/venues/indoor-status-badge";
import { deleteVenue, type DistrictOption, type VenueRow } from "./actions";
import { VenueFormDialog, type VenueDialogCopy } from "./venue-form-dialog";
import type { VenueAmenity, VenueIndoorStatus } from "@/lib/venues/schema";

// All copy props are plain strings (no function callbacks) so this object can
// cross the Server → Client boundary; pluralized strings are resolved on the
// client via `useTranslations` below.
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
  indoor_status_labels: Record<VenueIndoorStatus, string>;
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
  const tList = useTranslations("venues.list");

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
        <Button type="button" variant="primary" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> {copy.add}
        </Button>
      </div>

      {venues.length === 0 ? (
        <EmptyState
          title={copy.empty_title}
          description={copy.empty_description}
          action={
            <Button type="button" variant="primary" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> {copy.empty_cta}
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {venues.map((v) => (
            <Surface key={v.id} as="li" variant="row" className="lift-on-hover flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-ink-900">{v.name}</h3>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-600">
                    <MapPin className="h-3 w-3" />
                    {[v.city, v.district_name].filter(Boolean).join(" · ") || copy.no_district}
                  </p>
                </div>
                <IndoorStatusBadge
                  status={v.indoor_status}
                  label={copy.indoor_status_labels[v.indoor_status]}
                  size="xs"
                />
              </div>

              {v.address && <p className="mt-2 text-xs text-ink-500">{v.address}</p>}

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
                    <span className="text-[10px] text-ink-400">+{v.amenities.length - 6}</span>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-grass-50 px-2 py-1 text-xs font-semibold text-grass-800">
                  <Building2 className="h-3.5 w-3.5" />
                  {tList("courts", { n: v.courts_count })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => openEdit(v)}
                  >
                    <Pencil className="h-3 w-3" /> {copy.edit}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(v.id)}
                    disabled={pending && deletingId === v.id}
                  >
                    {pending && deletingId === v.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    {pending && deletingId === v.id ? copy.deleting : copy.delete}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      href={`/${locale}/admin/venues/${v.id}` as any}
                      className="inline-flex items-center gap-1"
                    >
                      {copy.open} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Surface>
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
