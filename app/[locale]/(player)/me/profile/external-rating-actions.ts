"use server";

import { revalidatePath } from "next/cache";
import {
  refreshExternalRating as refreshExternalRatingImpl,
  disconnectExternalRating as disconnectExternalRatingImpl,
  type RefreshResult,
  type DisconnectResult,
} from "@/lib/rating/external/actions-impl";

export type { RefreshResult, DisconnectResult } from "@/lib/rating/external/actions-impl";

export async function refreshExternalRating(): Promise<RefreshResult> {
  const result = await refreshExternalRatingImpl();
  if (result.ok) {
    revalidatePath("/me/profile");
    revalidatePath("/me/rating");
  }
  return result;
}

export async function disconnectExternalRating(): Promise<DisconnectResult> {
  const result = await disconnectExternalRatingImpl();
  if (result.ok) {
    revalidatePath("/me/profile");
    revalidatePath("/", "layout");
  }
  return result;
}
