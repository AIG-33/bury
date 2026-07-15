"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteAccount, type DeleteAccountResult } from "@/lib/account/actions";

// =============================================================================
// Account deletion entry point + confirmation dialog (App Store 5.1.1(v)).
// Two triggers share one dialog:
//   * variant="row"  — danger row on the mobile settings screen;
//   * variant="card" — danger-zone card on the web profile page.
// The dialog names the consequences and requires typing the confirmation
// word before the destructive server action can be called (AGENTS.md §3.8).
// =============================================================================

export type DeleteAccountCopy = {
  trigger: string;
  card_title: string;
  card_body: string;
  dialog_title: string;
  dialog_warning: string;
  consequences: string[];
  confirm_hint: string;
  confirm_word: string;
  cancel: string;
  confirm_cta: string;
  deleting: string;
  blocked_title: string;
  blocked_body: string;
  blocked_clubs_label: string;
  blocked_tournaments_label: string;
  error_generic: string;
};

type BlockedState = { clubs: string[]; tournaments: string[] };

export function DeleteAccountSection({
  variant,
  redirectTo,
  copy,
}: {
  variant: "row" | "card";
  /** Where to land after successful deletion (session is already gone). */
  redirectTo: string;
  copy: DeleteAccountCopy;
}) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<BlockedState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordMatches = word.trim().toUpperCase() === copy.confirm_word.toUpperCase();

  function close() {
    if (busy) return;
    setOpen(false);
    setWord("");
    setBlocked(null);
    setError(null);
  }

  async function handleDelete() {
    if (!wordMatches || busy) return;
    setBusy(true);
    setError(null);
    let res: DeleteAccountResult;
    try {
      res = await deleteAccount({ confirmation: word });
    } catch {
      res = { ok: false, error: "db_error" };
    }
    if (res.ok) {
      // Session cookies are cleared server-side; full navigation resets
      // every client cache.
      window.location.assign(redirectTo);
      return;
    }
    setBusy(false);
    if (res.error === "blocked") {
      setBlocked({ clubs: res.clubs, tournaments: res.tournaments });
    } else {
      setError(copy.error_generic);
    }
  }

  return (
    <>
      {variant === "row" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] border border-[#F3C9C0] bg-white font-display text-[14px] font-bold text-[#C0392B] transition-opacity active:opacity-85"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
          {copy.trigger}
        </button>
      ) : (
        <section className="surface-card border border-[#F3C9C0]">
          <header className="mb-3 flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FBEAE6] text-[#C0392B]">
              <Trash2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-ink-900">{copy.card_title}</h2>
              <p className="mt-1 text-sm text-ink-600">{copy.card_body}</p>
            </div>
          </header>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5A79B] bg-white px-5 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-[#FBEAE6]"
          >
            <Trash2 className="h-4 w-4" />
            {copy.trigger}
          </button>
        </section>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={copy.dialog_title}
          onClick={close}
        >
          <div
            className="max-h-[85dvh] w-full max-w-[420px] overflow-y-auto rounded-[20px] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FBEAE6] text-[#C0392B]">
                <AlertTriangle className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-[18px] font-extrabold leading-tight text-ink-900">
                  {blocked ? copy.blocked_title : copy.dialog_title}
                </h2>
              </div>
            </div>

            {blocked ? (
              <div className="mt-3 space-y-3 text-sm text-ink-700">
                <p>{copy.blocked_body}</p>
                {blocked.clubs.length > 0 && (
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wide text-ink-500">
                      {copy.blocked_clubs_label}
                    </p>
                    <ul className="mt-1 list-inside list-disc">
                      {blocked.clubs.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {blocked.tournaments.length > 0 && (
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wide text-ink-500">
                      {copy.blocked_tournaments_label}
                    </p>
                    <ul className="mt-1 list-inside list-disc">
                      {blocked.tournaments.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="mt-2 flex h-11 w-full items-center justify-center rounded-[13px] bg-ink-900 font-display text-[14px] font-bold text-white transition-opacity active:opacity-85"
                >
                  {copy.cancel}
                </button>
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm font-semibold text-ink-800">{copy.dialog_warning}</p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
                  {copy.consequences.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C0392B]"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-600">
                    {copy.confirm_hint}
                  </span>
                  <input
                    type="text"
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder={copy.confirm_word}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 w-full rounded-[12px] border border-ink-200 bg-white px-3 font-mono text-[15px] font-bold tracking-widest text-ink-900 outline-none placeholder:font-sans placeholder:text-[13px] placeholder:font-medium placeholder:tracking-normal placeholder:text-ink-300 focus:border-[#C0392B] focus:ring-2 focus:ring-[#C0392B]/25"
                  />
                </label>

                {error && (
                  <p className="mt-3 rounded-[12px] bg-[#FBEAE6] px-3 py-2 text-[13px] font-semibold text-[#C0392B]">
                    {error}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="flex h-12 flex-1 items-center justify-center rounded-[13px] border border-ink-200 bg-white font-display text-[14px] font-bold text-ink-700 transition-opacity active:opacity-85 disabled:opacity-50"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!wordMatches || busy}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[13px] bg-[#C0392B] font-display text-[14px] font-bold text-white transition-opacity active:opacity-85 disabled:opacity-40"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {copy.deleting}
                      </>
                    ) : (
                      copy.confirm_cta
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
