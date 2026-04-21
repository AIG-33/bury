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
      <div className="rounded-xl border border-grass-100 bg-grass-50 p-4 text-sm text-grass-800">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-grass-600" />
          <span className="font-medium">{labels.sent}</span>
        </div>
        <p className="text-grass-700">{labels.help}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-800">{labels.email}</span>
        <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 transition focus-within:ring-2 focus-within:ring-grass-500">
          <Mail className="h-4 w-4 text-ink-400" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 flex-1 bg-transparent text-sm outline-none"
            placeholder="you@example.com"
          />
        </div>
      </label>

      {state === "error" && errMsg && (
        <p className="rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-700 animate-letCordShake">
          {labels.error}: {errMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-grass-500 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-60"
      >
        {state === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {labels.sending}
          </>
        ) : (
          <>
            {labels.cta} <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
