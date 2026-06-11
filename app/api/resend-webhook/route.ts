/**
 * Resend webhook (delivery events).
 *
 * Resend signs webhooks with Svix: headers `svix-id`, `svix-timestamp`,
 * `svix-signature`; secret `RESEND_WEBHOOK_SECRET` (`whsec_` + base64 key).
 * We verify the signature manually with node:crypto — no extra dependency.
 *
 * On valid events we update the matching `notifications_outbox` row by
 * `provider_message_id` (stored when the outbox drain sends via Resend):
 *   - email.bounced / email.complained → status 'failed' + last_error
 *   - email.delivered                  → no-op beyond logging (row already 'sent')
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const TIMESTAMP_TOLERANCE_SEC = 5 * 60;

const eventSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string().optional(),
  }),
});

function verifySvixSignature(args: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  rawBody: string;
}): boolean {
  const key = Buffer.from(args.secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${args.id}.${args.timestamp}.${args.rawBody}`;
  const expected = createHmac("sha256", key).update(signedContent).digest();

  // Header may contain several space-separated entries like "v1,<base64sig>".
  for (const entry of args.signatureHeader.split(" ")) {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) continue;
    const candidate = Buffer.from(sig, "base64");
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[resend-webhook] RESEND_WEBHOOK_SECRET is not configured — rejecting event",
    );
    return NextResponse.json(
      { ok: false, error: "webhook_not_configured" },
      { status: 503 },
    );
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 401 });
  }

  const timestampSec = Number(svixTimestamp);
  if (
    !Number.isFinite(timestampSec) ||
    Math.abs(Date.now() / 1000 - timestampSec) > TIMESTAMP_TOLERANCE_SEC
  ) {
    return NextResponse.json({ ok: false, error: "timestamp_out_of_range" }, { status: 401 });
  }

  const rawBody = await req.text();
  if (
    !verifySvixSignature({
      secret,
      id: svixId,
      timestamp: svixTimestamp,
      signatureHeader: svixSignature,
      rawBody,
    })
  ) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(parsedJson);
  if (!parsed.success) {
    // Signed and well-formed enough — ack so Resend doesn't retry forever.
    return NextResponse.json({ ok: true, ignored: "unrecognized_payload" });
  }

  const { type, data } = parsed.data;
  const messageId = data.email_id;
  if (!messageId) return NextResponse.json({ ok: true, ignored: "no_email_id" });

  if (type === "email.bounced" || type === "email.complained") {
    const service = createSupabaseServiceClient();
    const { error } = await service
      .from("notifications_outbox")
      .update({ status: "failed", last_error: type } as never)
      .eq("provider_message_id", messageId);
    if (error) {
      console.error(`[resend-webhook] failed to mark outbox row for ${type}`, error.message);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (type === "email.delivered") {
    // Row is already 'sent' after the drain — nothing to change.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: type });
}
