"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Lock, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

type Labels = {
  password: string;
  confirm: string;
  cta: string;
  sending: string;
  done_title: string;
  done_body: string;
  go_home: string;
  error: string;
  mismatch: string;
  no_session: string;
  password_min_hint: string;
};

export function UpdatePasswordForm({
  labels,
  locale,
}: {
  labels: Labels;
  locale: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    // The recovery deep link sets a session via the Supabase auth client.
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    if (password.length < 8) {
      setErrMsg(labels.password_min_hint);
      return;
    }
    if (password !== confirm) {
      setErrMsg(labels.mismatch);
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErrMsg(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push(`/${locale}`);
      router.refresh();
    }, 1500);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-grass-200 bg-grass-50 p-5 text-sm text-grass-800">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-grass-600" />
          <span className="font-semibold">{labels.done_title}</span>
        </div>
        <p className="text-grass-700">{labels.done_body}</p>
        <Link
          href={`/${locale}`}
          className="mt-4 inline-flex h-10 items-center rounded-full bg-grass-700 px-5 text-[12px] font-mono uppercase tracking-[0.14em] text-white hover:bg-grass-800"
        >
          {labels.go_home}
        </Link>
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <div className="rounded-2xl bg-clay-50 px-4 py-4 text-sm text-clay-700">
        {labels.no_session}
        <div className="mt-3">
          <Link
            href={`/${locale}/login`}
            className="inline-flex h-9 items-center rounded-full bg-grass-700 px-4 text-[11.5px] font-mono uppercase tracking-[0.14em] text-white hover:bg-grass-800"
          >
            {labels.go_home}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PwdField
        label={labels.password}
        value={password}
        onChange={setPassword}
        visible={show}
        toggleVisible={() => setShow((v) => !v)}
        autoComplete="new-password"
        minHint={labels.password_min_hint}
      />
      <PwdField
        label={labels.confirm}
        value={confirm}
        onChange={setConfirm}
        visible={show}
        toggleVisible={() => setShow((v) => !v)}
        autoComplete="new-password"
      />

      {errMsg && (
        <p className="rounded-2xl bg-clay-50 px-4 py-3 text-sm text-clay-700 animate-letCordShake">
          {labels.error}: {errMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || hasSession === null}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-grass-700 font-mono text-[12.5px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_44px_-18px_rgba(21,94,54,0.6)] transition-all hover:bg-grass-800 disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {labels.sending}
          </>
        ) : (
          labels.cta
        )}
      </button>
    </form>
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
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-full border border-ink-200/80 bg-white/90 px-4 transition focus-within:border-grass-500 focus-within:ring-2 focus-within:ring-grass-500/30">
        <Lock className="h-4 w-4 text-ink-400" />
        <input
          type={visible ? "text" : "password"}
          required
          minLength={8}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-400"
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
      {minHint && <p className="mt-1.5 text-[11px] text-ink-500">{minHint}</p>}
    </label>
  );
}
