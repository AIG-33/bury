"use client";

import { useState } from "react";
import { Lock, Loader2, CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ChangePasswordCopy = {
  title: string;
  subtitle: string;
  email_label: string;
  current_password: string;
  new_password: string;
  confirm_password: string;
  cta_change: string;
  cta_send_link: string;
  link_mode_hint: string;
  toggle_to_link: string;
  toggle_to_direct: string;
  sending: string;
  saving: string;
  success_changed: string;
  success_link_sent: string;
  error: string;
  mismatch: string;
  min_hint: string;
  wrong_current: string;
};

export function ChangePasswordCard({
  email,
  copy,
}: {
  email: string;
  copy: ChangePasswordCopy;
}) {
  const [mode, setMode] = useState<"direct" | "link">("direct");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<null | "changed" | "link_sent">(null);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setCurrentPwd("");
    setNewPwd("");
    setConfirm("");
    setErr(null);
  }

  async function handleDirectChange(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (newPwd.length < 8) {
      setErr(copy.min_hint);
      return;
    }
    if (newPwd !== confirm) {
      setErr(copy.mismatch);
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    // 1. Verify current password by re-authenticating.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPwd,
    });
    if (signInErr) {
      setBusy(false);
      setErr(copy.wrong_current);
      return;
    }
    // 2. Rotate to the new password.
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPwd,
    });
    setBusy(false);
    if (updateErr) {
      setErr(updateErr.message);
      return;
    }
    reset();
    setOk("changed");
  }

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const siteBase =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const cb = new URL(`${siteBase}/api/auth/callback`);
    cb.searchParams.set("next", "/auth/update-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: cb.toString(),
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setOk("link_sent");
  }

  return (
    <section className="surface-card">
      <header className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-grass-100 text-grass-700">
          <Lock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink-900">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm text-ink-600">{copy.subtitle}</p>
        </div>
      </header>

      <div className="mb-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
        <span className="font-mono uppercase tracking-wider text-ink-500">
          {copy.email_label}:
        </span>{" "}
        <span className="font-medium text-ink-800">{email}</span>
      </div>

      {ok === "changed" && (
        <SuccessNote text={copy.success_changed} />
      )}
      {ok === "link_sent" && (
        <SuccessNote text={copy.success_link_sent} />
      )}

      {mode === "direct" ? (
        <form onSubmit={handleDirectChange} className="space-y-3">
          <PwdField
            label={copy.current_password}
            value={currentPwd}
            onChange={setCurrentPwd}
            visible={show}
            toggleVisible={() => setShow((v) => !v)}
            autoComplete="current-password"
          />
          <PwdField
            label={copy.new_password}
            value={newPwd}
            onChange={setNewPwd}
            visible={show}
            toggleVisible={() => setShow((v) => !v)}
            autoComplete="new-password"
            minHint={copy.min_hint}
          />
          <PwdField
            label={copy.confirm_password}
            value={confirm}
            onChange={setConfirm}
            visible={show}
            toggleVisible={() => setShow((v) => !v)}
            autoComplete="new-password"
          />

          {err && (
            <p className="rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700">
              {copy.error}: {err}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-700 px-5 text-sm font-semibold text-white hover:bg-grass-800 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {copy.saving}
                </>
              ) : (
                copy.cta_change
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("link");
                reset();
                setOk(null);
              }}
              className="text-[12px] font-mono uppercase tracking-[0.12em] text-ink-500 hover:text-grass-700"
            >
              {copy.toggle_to_link}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSendLink} className="space-y-3">
          <p className="text-sm text-ink-600">
            <Mail className="mr-1.5 inline h-4 w-4 text-ink-400" />
            {copy.link_mode_hint}
          </p>
          {err && (
            <p className="rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700">
              {copy.error}: {err}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-700 px-5 text-sm font-semibold text-white hover:bg-grass-800 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {copy.sending}
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" /> {copy.cta_send_link}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("direct");
                reset();
                setOk(null);
              }}
              className="text-[12px] font-mono uppercase tracking-[0.12em] text-ink-500 hover:text-grass-700"
            >
              {copy.toggle_to_direct}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function SuccessNote({ text }: { text: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-grass-100 bg-grass-50 p-3 text-sm text-grass-800">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-grass-600" />
      <span>{text}</span>
    </div>
  );
}

function PwdField({
  label,
  value,
  onChange,
  visible,
  toggleVisible,
  autoComplete,
  minHint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  toggleVisible: () => void;
  autoComplete: "new-password" | "current-password";
  minHint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-lg border border-ink-200/80 bg-white px-3 transition focus-within:border-grass-500 focus-within:ring-2 focus-within:ring-grass-500/30">
        <Lock className="h-4 w-4 text-ink-400" />
        <input
          type={visible ? "text" : "password"}
          required
          minLength={autoComplete === "new-password" ? 8 : undefined}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={toggleVisible}
          className="text-ink-400 hover:text-ink-700"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {minHint && <p className="mt-1 text-[11px] text-ink-500">{minHint}</p>}
    </label>
  );
}
