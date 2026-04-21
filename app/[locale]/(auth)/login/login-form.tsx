"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

type Labels = {
  email: string;
  cta: string;
  sending: string;
  sent: string;
  help: string;
  error: string;
};

export function LoginForm({ labels }: { labels: Labels }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setErrMsg(null);

    const supabase = createSupabaseBrowserClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const callback = new URL(`${siteUrl}/api/auth/callback`);
    if (next) callback.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback.toString() },
    });

    if (error) {
      setState("error");
      setErrMsg(error.message);
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-grass-200 bg-grass-50 p-5 text-sm text-grass-800">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-grass-600" />
          <span className="font-semibold">{labels.sent}</span>
        </div>
        <p className="text-grass-700">{labels.help}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
          {labels.email}
        </span>
        <div className="flex items-center gap-2 rounded-full border border-ink-200/80 bg-white/90 px-4 transition focus-within:border-grass-500 focus-within:ring-2 focus-within:ring-grass-500/30">
          <Mail className="h-4 w-4 text-ink-400" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-400"
            placeholder="you@example.com"
          />
        </div>
      </label>

      {state === "error" && errMsg && (
        <p className="rounded-2xl bg-clay-50 px-4 py-3 text-sm text-clay-700 animate-letCordShake">
          {labels.error}: {errMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-grass-700 font-mono text-[12.5px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_44px_-18px_rgba(21,94,54,0.6)] transition-all duration-400 ease-followthrough hover:-translate-y-0.5 hover:bg-grass-800 hover:shadow-[0_24px_60px_-20px_rgba(21,94,54,0.7)] disabled:translate-y-0 disabled:opacity-60"
      >
        {state === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {labels.sending}
          </>
        ) : (
          <>
            {labels.cta}
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:translate-x-0.5">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </>
        )}
      </button>
    </form>
  );
}
