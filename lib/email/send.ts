import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export type SendResult =
  | { ok: true; id: string; mode: "resend" | "console" }
  | { ok: false; error: string };

let cachedResend: Resend | null = null;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cachedResend) cachedResend = new Resend(key);
  return cachedResend;
}

/**
 * Send an email through Resend. Falls back to console.log in dev when
 * RESEND_API_KEY is not configured — this keeps local-dev workflows working.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const from = message.from ?? process.env.RESEND_FROM ?? "Bury Tennis <noreply@example.com>";
  const resend = getResend();

  if (!resend) {
    const id = `dev-${Date.now()}`;
    console.warn(
      `[email:dev] RESEND_API_KEY missing — printing email to console instead.\n` +
        `from: ${from}\nto: ${message.to}\nsubject: ${message.subject}\nhtml:\n${message.html}\n`,
    );
    return { ok: true, id, mode: "console" };
  }

  try {
    const result = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id ?? "unknown", mode: "resend" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
