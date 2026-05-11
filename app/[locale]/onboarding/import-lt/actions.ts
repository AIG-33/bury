"use server";

import { revalidatePath } from "next/cache";
import {
  searchLtCandidates as searchLtCandidatesImpl,
  previewLtPlayer as previewLtPlayerImpl,
  confirmImportFromLt as confirmImportFromLtImpl,
  type SearchResult,
  type PreviewResult,
  type ImportResult,
} from "@/lib/rating/external/actions-impl";

export type { SearchResult, PreviewResult, ImportResult } from "@/lib/rating/external/actions-impl";

export async function searchLtCandidates(
  query: string,
  city?: string | null,
): Promise<SearchResult> {
  return searchLtCandidatesImpl(query, city ?? null);
}

export async function previewLtPlayer(externalId: number): Promise<PreviewResult> {
  return previewLtPlayerImpl(externalId);
}

export async function confirmImportFromLt(
  externalId: number,
  copyEmptyFields: boolean,
): Promise<ImportResult> {
  const result = await confirmImportFromLtImpl(externalId, copyEmptyFields);
  if (result.ok) {
    revalidatePath("/", "layout");
    revalidatePath("/me/profile");
    revalidatePath("/me/rating");
  }
  return result;
}
