"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { adminDeletePlayer, type AdminDeletePlayerResult } from "../actions";

// =============================================================================
// Admin-initiated full player deletion (profiles table).
//
// Mirrors the self-deletion dialog (components/account/delete-account.tsx):
// names the real consequences of lib/account/perform-deletion.ts and requires
// typing the confirmation word before the destructive action (AGENTS.md §3.8).
// =============================================================================

type BlockedState = { clubs: string[]; tournaments: string[] };

export function DeletePlayerButton({
  userId,
  playerName,
  variant,
  onDeleted,
}: {
  userId: string;
  /** Shown in the dialog title so the admin knows exactly who is deleted. */
  playerName: string;
  /** "icon" — trash button in the table row; "button" — labeled button in the row editor. */
  variant: "icon" | "button";
  onDeleted: () => void;
}) {
  const t = useTranslations("adminDb.delete_player");
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<BlockedState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmWord = t("confirm_word");
  const wordMatches = word.trim().toUpperCase() === confirmWord.toUpperCase();

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
    let res: AdminDeletePlayerResult;
    try {
      res = await adminDeletePlayer({ userId, confirmation: word });
    } catch {
      res = { ok: false, error: "db_error" };
    }
    setBusy(false);
    if (res.ok) {
      close();
      onDeleted();
      return;
    }
    if (res.error === "blocked") {
      setBlocked({ clubs: res.clubs, tournaments: res.tournaments });
    } else if (res.error === "cannot_delete_self") {
      setError(t("errors.cannot_delete_self"));
    } else {
      setError(t("error_generic"));
    }
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-clay-700 transition hover:border-clay-400 hover:bg-clay-50"
          title={t("trigger")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-clay-300 bg-white px-4 py-2 text-sm font-semibold text-clay-700 transition hover:bg-clay-50"
        >
          <Trash2 className="h-4 w-4" />
          {t("trigger")}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("dialog_title", { name: playerName })}
          onClick={close}
        >
          <div
            className="max-h-[85dvh] w-full max-w-[440px] overflow-y-auto rounded-[20px] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay-50 text-clay-700">
                <AlertTriangle className="h-5 w-5" strokeWidth={2} />
              </span>
              <h2 className="min-w-0 font-display text-[18px] font-extrabold leading-tight text-ink-900">
                {blocked ? t("blocked_title") : t("dialog_title", { name: playerName })}
              </h2>
            </div>

            {blocked ? (
              <div className="mt-3 space-y-3 text-sm text-ink-700">
                <p>{t("blocked_body")}</p>
                {blocked.clubs.length > 0 && (
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wide text-ink-500">
                      {t("blocked_clubs_label")}
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
                      {t("blocked_tournaments_label")}
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
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm font-semibold text-ink-800">{t("dialog_warning")}</p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
                  {(["1", "2", "3", "4"] as const).map((k) => (
                    <li key={k} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-clay-600"
                      />
                      <span>{t(`consequences.${k}`)}</span>
                    </li>
                  ))}
                </ul>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-600">
                    {t("confirm_hint", { word: confirmWord })}
                  </span>
                  <input
                    type="text"
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder={confirmWord}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 w-full rounded-[12px] border border-ink-200 bg-white px-3 font-mono text-[15px] font-bold tracking-widest text-ink-900 outline-none placeholder:font-sans placeholder:text-[13px] placeholder:font-medium placeholder:tracking-normal placeholder:text-ink-300 focus:border-clay-600 focus:ring-2 focus:ring-clay-600/25"
                  />
                </label>

                {error && (
                  <p className="mt-3 rounded-[12px] bg-clay-50 px-3 py-2 text-[13px] font-semibold text-clay-800">
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
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!wordMatches || busy}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[13px] bg-clay-700 font-display text-[14px] font-bold text-white transition-opacity active:opacity-85 disabled:opacity-40"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("deleting")}
                      </>
                    ) : (
                      t("confirm_cta")
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
