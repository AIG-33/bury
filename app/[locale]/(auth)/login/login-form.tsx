"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  signInWithApple,
  signInWithGoogle,
  oauthErrorLabelKey,
  type OAuthProvider,
} from "@/lib/auth/oauth";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Mail, Lock, ArrowRight, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

export type LoginLabels = {
  email: string;
  password: string;
  cta_password: string;
  cta_signup: string;
  cta_forgot: string;
  sending: string;
  sent: string;
  help_signup_confirm: string;
  error: string;
  tab_password: string;
  tab_signup: string;
  forgot: string;
  forgot_sent_title: string;
  forgot_sent_body: string;
  back: string;
  password_min_hint: string;
  show_password: string;
  hide_password: string;
  auth_error_missing_token: string;
  auth_error_missing_code: string;
  auth_error_no_session: string;
  auth_error_oauth_provider: string;
  auth_error_generic: string;
  or_divider: string;
  continue_google: string;
  continue_apple: string;
  oauth_error: string;
  oauth_unavailable: string;
};

type Mode = "password" | "signup" | "forgot";

export function LoginForm({ labels, locale }: { labels: LoginLabels; locale: string }) {
  // The mobile start screen deep-links to /login?mode=signup for its
  // "Создать аккаунт" CTA; any other value falls back to the sign-in tab.
  const initialMode = useSearchParams().get("mode") === "signup" ? "signup" : "password";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "signup" | "forgot">(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const [oauthErrMsg, setOauthErrMsg] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  // /api/auth/callback and /api/auth/confirm bounce back here with
  // ?error=<code> when a link is broken or expired. Known codes get a
  // specific message; anything else (e.g. raw Supabase error text) falls
  // back to the generic "link invalid or expired".
  const authErrorParam = searchParams.get("error");
  // Provider-side OAuth failures (bad client secret, consent denied, DB error
  // on signup) arrive as error=oauth_provider with the raw GoTrue description
  // in error_detail — shown verbatim so the real cause is debuggable.
  const authErrorDetail = searchParams.get("error_detail");
  const knownAuthErrors: Record<string, string> = {
    missing_token: labels.auth_error_missing_token,
    missing_code: labels.auth_error_missing_code,
    no_session: labels.auth_error_no_session,
    oauth_provider: labels.auth_error_oauth_provider,
  };
  const authErrorMsg = authErrorParam
    ? [
        knownAuthErrors[authErrorParam] ?? labels.auth_error_generic,
        authErrorParam === "oauth_provider" && authErrorDetail ? `(${authErrorDetail})` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  // Client-side auth flows MUST use window.location.origin, not
  // NEXT_PUBLIC_SITE_URL, because the env var is baked at build time and
  // can drift behind the actual deployment URL (e.g. when the Vercel
  // project is renamed). window.location.origin is always exactly the
  // host the user is currently on, so it survives any rename and avoids
  // dead-link confirmation emails.
  function siteBase() {
    if (typeof window !== "undefined") return window.location.origin;
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  }

  // Used as `emailRedirectTo` for sign-up / recovery emails.
  // With the token_hash email templates (see Supabase Dashboard → Auth →
  // Email Templates), this URL is what `{{ .RedirectTo }}` resolves to,
  // and the link Supabase actually sends points at /api/auth/confirm with
  // the token_hash attached. /api/auth/callback (PKCE) is kept as a
  // fallback for OAuth providers.
  function confirmRedirectUrl(targetNext?: string): string {
    const cb = new URL(`${siteBase()}/api/auth/confirm`);
    const n = targetNext ?? next;
    if (n) cb.searchParams.set("next", n);
    return cb.toString();
  }

  function postLoginUrl(): string {
    const url = new URL(`${siteBase()}/api/auth/post-login`);
    if (next) url.searchParams.set("next", next);
    return url.toString();
  }

  // Web OAuth redirects back through the existing PKCE callback route, which
  // runs `exchangeCodeForSession` and the profile-based redirect.
  function oauthRedirectUrl(): string {
    const url = new URL(`${siteBase()}/api/auth/callback`);
    if (next) url.searchParams.set("next", next);
    return url.toString();
  }

  async function handleOAuth(provider: OAuthProvider) {
    setErrMsg(null);
    setOauthErrMsg(null);
    setOauthBusy(provider);
    const opts = {
      redirectTo: oauthRedirectUrl(),
      postLoginUrl: postLoginUrl(),
    };
    const result =
      provider === "google" ? await signInWithGoogle(opts) : await signInWithApple(opts);
    // On success the web flow redirects to the provider and the native flow
    // hard-navigates to /api/auth/post-login, so we only reset on failure.
    if (!result.ok) {
      setOauthBusy(null);
      setOauthErrMsg(
        oauthErrorLabelKey(result.error) === "oauth_unavailable"
          ? labels.oauth_unavailable
          : labels.oauth_error,
      );
    }
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
    // Hard navigate through /api/auth/post-login so the server decides between
    // onboarding quiz (first login) and the rating / coach dashboard.
    window.location.assign(postLoginUrl());
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // `locale` lands in raw_user_meta_data so the handle_new_user trigger
      // seeds profiles.locale with the language the user signed up in.
      options: { emailRedirectTo: confirmRedirectUrl(), data: { locale } },
    });
    setBusy(false);
    if (error) {
      setErrMsg(error.message);
      return;
    }
    // If email confirmations are disabled in Supabase, we get a session straight
    // away — fresh accounts must go through the onboarding quiz, so route via
    // /api/auth/post-login which enforces that.
    if (data.session) {
      window.location.assign(postLoginUrl());
      return;
    }
    setDone("signup");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: confirmRedirectUrl("/auth/update-password"),
    });
    setBusy(false);
    if (error) {
      setErrMsg(error.message);
      return;
    }
    setDone("forgot");
  }

  if (done === "signup") {
    return <SuccessNote title={labels.sent} body={labels.help_signup_confirm} />;
  }
  if (done === "forgot") {
    return <SuccessNote title={labels.forgot_sent_title} body={labels.forgot_sent_body} />;
  }

  return (
    <div className="space-y-4">
      {authErrorMsg && (
        <p role="alert" className="rounded-2xl bg-clay-50 px-4 py-3 text-sm text-clay-700">
          {authErrorMsg}
        </p>
      )}
      {mode !== "forgot" && (
        <>
          <OAuthButtons
            labels={{
              or_divider: labels.or_divider,
              continue_google: labels.continue_google,
              continue_apple: labels.continue_apple,
            }}
            onProvider={handleOAuth}
            busyProvider={oauthBusy}
            disabled={busy || oauthBusy !== null}
          />
          {oauthErrMsg && (
            <p role="alert" className="rounded-2xl bg-clay-50 px-4 py-3 text-sm text-clay-700">
              {oauthErrMsg}
            </p>
          )}
        </>
      )}

      <div
        role="tablist"
        aria-label="Login mode"
        className="grid grid-cols-2 gap-1 rounded-full border border-ink-200/70 bg-white/70 p-1 font-mono text-[12px] uppercase tracking-[0.14em]"
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
      </div>

      {mode === "forgot" ? (
        <form onSubmit={handleForgot} className="space-y-4">
          <EmailField label={labels.email} value={email} onChange={setEmail} />
          <ErrorNote show={!!errMsg} prefix={labels.error} message={errMsg} />
          <PrimaryButton busy={busy} sendingLabel={labels.sending}>
            {labels.cta_forgot}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setMode("password")}
            className="block w-full text-center font-mono text-[12px] uppercase tracking-[0.14em] text-ink-500 hover:text-grass-700"
          >
            ← {labels.back}
          </button>
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
            showLabel={labels.show_password}
            hideLabel={labels.hide_password}
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
            showLabel={labels.show_password}
            hideLabel={labels.hide_password}
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
            className="block w-full text-center font-mono text-[12px] uppercase tracking-[0.14em] text-ink-500 hover:text-grass-700"
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
          : "text-ink-600 hover:bg-grass-50 hover:text-grass-800",
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
  showLabel,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  toggleVisible: () => void;
  autoComplete: "new-password" | "current-password";
  minHint?: string;
  showLabel: string;
  hideLabel: string;
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
          aria-label={visible ? hideLabel : showLabel}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {minHint && <p className="mt-1.5 text-[11px] text-ink-500">{minHint}</p>}
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
    <p className="animate-letCordShake rounded-2xl bg-clay-50 px-4 py-3 text-sm text-clay-700">
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
      className="duration-400 ease-followthrough group inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-grass-700 font-mono text-[12.5px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_44px_-18px_rgba(21,94,54,0.6)] transition-all hover:-translate-y-0.5 hover:bg-grass-800 hover:shadow-[0_24px_60px_-20px_rgba(21,94,54,0.7)] disabled:translate-y-0 disabled:opacity-60"
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
