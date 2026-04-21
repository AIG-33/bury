"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

export type LoginLabels = {
  email: string;
  password: string;
  cta_password: string;
  cta_signup: string;
  cta_magic: string;
  sending: string;
  sent: string;
  help_magic: string;
  help_signup_confirm: string;
  error: string;
  tab_password: string;
  tab_signup: string;
  tab_magic: string;
  forgot: string;
  forgot_sent_title: string;
  forgot_sent_body: string;
  back: string;
  password_min_hint: string;
};

type Mode = "password" | "signup" | "magic" | "forgot";

export function LoginForm({ labels, locale }: { labels: LoginLabels; locale: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "magic" | "signup" | "forgot">(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  function siteBase() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  }

  function callbackUrl(): string {
    const cb = new URL(`${siteBase()}/api/auth/callback`);
    if (next) cb.searchParams.set("next", next);
    return cb.toString();
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErrMsg(error.message);
      return;
    }
    // Hard navigate so server middleware/cookies refresh and post-login redirect logic kicks in.
    const target = next && next.startsWith("/") ? `/${locale}${next}` : `/${locale}`;
    router.push(target);
    router.refresh();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl() },
    });
    setBusy(false);
    if (error) {
      setErrMsg(error.message);
      return;
    }
    // If email confirmations are disabled in Supabase, we get a session straight away.
    if (data.session) {
      const target = next && next.startsWith("/") ? `/${locale}${next}` : `/${locale}`;
      router.push(target);
      router.refresh();
      return;
    }
    setDone("signup");
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setBusy(false);
    if (error) {
      setErrMsg(error.message);
      return;
    }
    setDone("magic");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const cb = new URL(`${siteBase()}/api/auth/callback`);
    cb.searchParams.set("next", "/auth/update-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: cb.toString(),
    });
    setBusy(false);
    if (error) {
      setErrMsg(error.message);
      return;
    }
    setDone("forgot");
  }

  if (done === "magic") {
    return <SuccessNote title={labels.sent} body={labels.help_magic} />;
  }
  if (done === "signup") {
    return <SuccessNote title={labels.sent} body={labels.help_signup_confirm} />;
  }
  if (done === "forgot") {
    return (
      <SuccessNote title={labels.forgot_sent_title} body={labels.forgot_sent_body} />
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Login mode"
        className="grid grid-cols-3 gap-1 rounded-full border border-ink-200/70 bg-white/70 p-1 text-[12px] font-mono uppercase tracking-[0.14em]"
      >
        <TabButton
          active={mode === "password"}
          onClick={() => {
            setMode("password");
            setErrMsg(null);
          }}
        >
          {labels.tab_password}
        </TabButton>
        <TabButton
          active={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setErrMsg(null);
          }}
        >
          {labels.tab_signup}
        </TabButton>
        <TabButton
          active={mode === "magic"}
          onClick={() => {
            setMode("magic");
            setErrMsg(null);
          }}
        >
          {labels.tab_magic}
        </TabButton>
      </div>

      {mode === "forgot" ? (
        <form onSubmit={handleForgot} className="space-y-4">
          <EmailField label={labels.email} value={email} onChange={setEmail} />
          <ErrorNote show={!!errMsg} prefix={labels.error} message={errMsg} />
          <PrimaryButton busy={busy} sendingLabel={labels.sending}>
            {labels.cta_magic}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setMode("password")}
            className="block w-full text-center text-[12px] font-mono uppercase tracking-[0.14em] text-ink-500 hover:text-grass-700"
          >
            ← {labels.back}
          </button>
        </form>
      ) : mode === "magic" ? (
        <form onSubmit={handleMagic} className="space-y-4">
          <EmailField label={labels.email} value={email} onChange={setEmail} />
          <ErrorNote show={!!errMsg} prefix={labels.error} message={errMsg} />
          <PrimaryButton busy={busy} sendingLabel={labels.sending}>
            {labels.cta_magic}
          </PrimaryButton>
        </form>
      ) : mode === "signup" ? (
        <form onSubmit={handleSignUp} className="space-y-4">
          <EmailField label={labels.email} value={email} onChange={setEmail} />
          <PasswordField
            label={labels.password}
            value={password}
            onChange={setPassword}
            visible={showPwd}
            toggleVisible={() => setShowPwd((v) => !v)}
            autoComplete="new-password"
            minHint={labels.password_min_hint}
          />
          <ErrorNote show={!!errMsg} prefix={labels.error} message={errMsg} />
          <PrimaryButton busy={busy} sendingLabel={labels.sending}>
            {labels.cta_signup}
          </PrimaryButton>
        </form>
      ) : (
        <form onSubmit={handlePasswordSignIn} className="space-y-4">
          <EmailField label={labels.email} value={email} onChange={setEmail} />
          <PasswordField
            label={labels.password}
            value={password}
            onChange={setPassword}
            visible={showPwd}
            toggleVisible={() => setShowPwd((v) => !v)}
            autoComplete="current-password"
          />
          <ErrorNote show={!!errMsg} prefix={labels.error} message={errMsg} />
          <PrimaryButton busy={busy} sendingLabel={labels.sending}>
            {labels.cta_password}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setErrMsg(null);
            }}
            className="block w-full text-center text-[12px] font-mono uppercase tracking-[0.14em] text-ink-500 hover:text-grass-700"
          >
            {labels.forgot}
          </button>
        </form>
      )}
    </div>
  );
}

function SuccessNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-grass-200 bg-grass-50 p-5 text-sm text-grass-800">
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-grass-600" />
        <span className="font-semibold">{title}</span>
      </div>
      <p className="text-grass-700">{body}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "h-9 rounded-full transition",
        active
          ? "bg-grass-700 text-white shadow-[0_8px_20px_-10px_rgba(21,94,54,0.6)]"
          : "text-ink-600 hover:text-grass-800 hover:bg-grass-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EmailField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-full border border-ink-200/80 bg-white/90 px-4 transition focus-within:border-grass-500 focus-within:ring-2 focus-within:ring-grass-500/30">
        <Mail className="h-4 w-4 text-ink-400" />
        <input
          type="email"
          required
          autoComplete="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-400"
          placeholder="you@example.com"
        />
      </div>
    </label>
  );
}

function PasswordField({
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
      {minHint && (
        <p className="mt-1.5 text-[11px] text-ink-500">{minHint}</p>
      )}
    </label>
  );
}

function ErrorNote({
  show,
  prefix,
  message,
}: {
  show: boolean;
  prefix: string;
  message: string | null;
}) {
  if (!show || !message) return null;
  return (
    <p className="rounded-2xl bg-clay-50 px-4 py-3 text-sm text-clay-700 animate-letCordShake">
      {prefix}: {message}
    </p>
  );
}

function PrimaryButton({
  busy,
  sendingLabel,
  children,
}: {
  busy: boolean;
  sendingLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-grass-700 font-mono text-[12.5px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_44px_-18px_rgba(21,94,54,0.6)] transition-all duration-400 ease-followthrough hover:-translate-y-0.5 hover:bg-grass-800 hover:shadow-[0_24px_60px_-20px_rgba(21,94,54,0.7)] disabled:translate-y-0 disabled:opacity-60"
    >
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> {sendingLabel}
        </>
      ) : (
        <>
          {children}
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:translate-x-0.5">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </>
      )}
    </button>
  );
}
