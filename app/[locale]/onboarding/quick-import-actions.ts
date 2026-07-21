"use server";

import {
  confirmImportFromLt as confirmImportFromLtImpl,
  type ImportResult,
} from "@/lib/rating/external/actions-impl";

export type { ImportResult } from "@/lib/rating/external/actions-impl";

/**
 * Confirm action for the inline onboarding widget. Same impl as the full
 * /onboarding/import-lt page, but with NO revalidatePath calls: any
 * revalidation inside a server action makes the router refresh the current
 * route in the same round trip, and the freshly re-rendered /onboarding
 * server page sees onboarding_completed_at set and instantly redirects to
 * /me/rating — yanking the success card away before the player can read it
 * (and dropping them onto a long page that needs scrolling). The success
 * CTA is a plain <a> full-page load, so /me/rating and the profile render
 * fresh anyway.
 */
export async function confirmImportFromLtQuick(
  externalId: number,
  copyEmptyFields: boolean,
): Promise<ImportResult> {
  return confirmImportFromLtImpl(externalId, copyEmptyFields);
}
