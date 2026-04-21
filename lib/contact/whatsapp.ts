// =============================================================================
// WhatsApp deep-link helpers (wa.me).
//
// In Poland WhatsApp is the de-facto messenger of choice, so we treat
// it as the primary contact channel. We don't (yet) integrate WhatsApp
// Business API for automated notifications — those go via email/Resend.
// Phase 2 plan: Twilio/Meta Business Cloud API integration.
// =============================================================================

/**
 * Normalize a WhatsApp number for use in a wa.me link:
 * strip everything that isn't a digit, drop leading zeros.
 * If the user typed without country code we assume PL (+48).
 */
export function normalizeWhatsAppNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Strip everything except digits and leading +.
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);

  // Drop leading zeros (e.g. "0048..." → "48...").
  digits = digits.replace(/^0+/, "");

  // If 9 digits, assume PL local number → prepend country code 48.
  if (digits.length === 9) digits = `48${digits}`;

  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/**
 * Build a wa.me click-to-chat URL with optional pre-filled text.
 * Returns null if the number can't be normalized.
 */
export function whatsappLink(
  number: string | null | undefined,
  message?: string,
): string | null {
  const normalized = normalizeWhatsAppNumber(number);
  if (!normalized) return null;
  const base = `https://wa.me/${normalized}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a tel: link from a phone number (used as a fallback when WhatsApp
 * is not available). Returns null when the number is empty.
 */
export function telLink(number: string | null | undefined): string | null {
  if (!number) return null;
  const cleaned = number.trim().replace(/[^\d+]/g, "");
  return cleaned.length === 0 ? null : `tel:${cleaned}`;
}

/**
 * Format a normalized number for display: split into groups of 3.
 * E.g. "48600123456" → "+48 600 123 456".
 */
export function formatPhoneForDisplay(input: string | null | undefined): string | null {
  const normalized = normalizeWhatsAppNumber(input);
  if (!normalized) return null;
  // PL: country (2) + 3+3+3
  if (normalized.startsWith("48") && normalized.length === 11) {
    return `+48 ${normalized.slice(2, 5)} ${normalized.slice(5, 8)} ${normalized.slice(8)}`;
  }
  return `+${normalized}`;
}
