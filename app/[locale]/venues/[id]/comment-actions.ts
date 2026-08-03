"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications/notify";
import { VenueCommentSchema } from "@/lib/venues/schema";

// =============================================================================
// Venue comments («Заметили неточность? Напишите»).
//
// Insert/delete go through the user's session client — RLS enforces
// author_id = auth.uid() on insert and author-or-admin on delete. The
// notification to the venue creator uses the service client because
// notifications_outbox is admin-write-only.
// =============================================================================

export type VenueCommentRow = {
  id: string;
  venue_id: string;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
  body: string;
  created_at: string;
};

export async function loadVenueComments(venueId: string): Promise<VenueCommentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data: rows } = (await supabase
    .from("venue_comments")
    .select("id, venue_id, author_id, body, created_at")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(100)) as {
    data: Array<Omit<VenueCommentRow, "author_name" | "author_avatar">> | null;
  };
  const comments = rows ?? [];
  if (comments.length === 0) return [];

  const authorIds = Array.from(new Set(comments.map((c) => c.author_id)));
  const { data: authors } = (await supabase
    .from("public_profile_basic")
    .select("id, display_name, avatar_url")
    .in("id", authorIds)) as {
    data: Array<{ id: string; display_name: string | null; avatar_url: string | null }> | null;
  };
  const byId = new Map((authors ?? []).map((a) => [a.id, a]));

  return comments.map((c) => ({
    ...c,
    author_name: byId.get(c.author_id)?.display_name ?? null,
    author_avatar: byId.get(c.author_id)?.avatar_url ?? null,
  }));
}

export type AddCommentResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function addVenueComment(input: unknown): Promise<AddCommentResult> {
  const parsed = VenueCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { venue_id, body } = parsed.data;

  const { data: inserted, error } = (await supabase
    .from("venue_comments")
    .insert({ venue_id, author_id: user.id, body } as never)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };
  if (error || !inserted) return { ok: false, error: error?.message ?? "db_error" };

  await notifyVenueCreator({ venueId: venue_id, authorId: user.id, body });

  revalidatePath(`/venues/${venue_id}`);
  return { ok: true, id: inserted.id };
}

export async function deleteVenueComment(
  commentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(commentId).success) {
    return { ok: false, error: "invalid_id" };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: comment } = (await supabase
    .from("venue_comments")
    .select("id, venue_id")
    .eq("id", commentId)
    .maybeSingle()) as { data: { id: string; venue_id: string } | null };
  if (!comment) return { ok: false, error: "not_found" };

  // RLS allows the delete only for the author or an admin; a forbidden
  // delete silently affects 0 rows, so re-check afterwards.
  const { error } = await supabase.from("venue_comments").delete().eq("id", commentId);
  if (error) return { ok: false, error: error.message };

  const { data: still } = (await supabase
    .from("venue_comments")
    .select("id")
    .eq("id", commentId)
    .maybeSingle()) as { data: { id: string } | null };
  if (still) return { ok: false, error: "not_allowed" };

  revalidatePath(`/venues/${comment.venue_id}`);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Notify the venue creator (best-effort; never blocks the comment itself).
// -----------------------------------------------------------------------------

async function notifyVenueCreator(opts: {
  venueId: string;
  authorId: string;
  body: string;
}): Promise<void> {
  try {
    const service = createSupabaseServiceClient();

    const { data: venue } = (await service
      .from("venues")
      .select("id, name, created_by")
      .eq("id", opts.venueId)
      .maybeSingle()) as {
      data: { id: string; name: string; created_by: string | null } | null;
    };
    if (!venue?.created_by || venue.created_by === opts.authorId) return;

    const { data: author } = (await service
      .from("profiles")
      .select("display_name")
      .eq("id", opts.authorId)
      .maybeSingle()) as { data: { display_name: string | null } | null };

    const excerpt = opts.body.length > 140 ? `${opts.body.slice(0, 140)}…` : opts.body;

    await notifyUser(service, {
      recipientId: venue.created_by,
      template: "venue_comment_added",
      payload: {
        venue_id: venue.id,
        venue_name: venue.name,
        author_name: author?.display_name ?? "",
        excerpt,
      },
      linkUrl: `/venues/${venue.id}`,
    });
  } catch (e) {
    console.error("notifyVenueCreator failed", { venueId: opts.venueId, error: e });
  }
}
