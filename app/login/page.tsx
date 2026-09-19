"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Arrow } from "../../components/arrow";
import { BalanceVisual } from "../../components/balance-visual";
import { SiteHeader } from "../../components/site-header";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const chooseMode = (next: "login" | "register") => { setMode(next); setError(""); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, email, password }) });
      const payload = await response.json() as { error?: string; code?: string; destination?: string };
      if (!response.ok) throw new Error(payload.code === "NOT_CONFIGURED" ? "Add DATABASE_URL to .env.local and run npm run migrate." : payload.error ?? "Unable to sign in.");
      router.replace(payload.destination ?? (mode === "register" ? "/onboarding" : "/history"));
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in."); }
    finally { setPending(false); }
  };

  return <main><SiteHeader /><section className="login-page page-shell"><div className="login-copy"><div className="kicker"><span /> Your decisions, remembered</div><h1>{mode === "login" ? "Welcome" : "Make it"}<br /><em>{mode === "login" ? "back." : "personal."}</em></h1><p>{mode === "login" ? "Sign in to see your previous conversations, scores, outcomes, and saved feedback." : "Sign up, then answer eight short questions so every score starts with useful personal context."}</p><div className="auth-tabs" role="tablist" aria-label="Account action"><button className={mode === "login" ? "active" : ""} type="button" onClick={() => chooseMode("login")}>Sign in</button><button className={mode === "register" ? "active" : ""} type="button" onClick={() => chooseMode("register")}>Sign up</button></div><form className="login-form" onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" required /></label>{error && <p className="chat-error" role="alert">{error}</p>}<div className="actions"><button className="primary" disabled={pending} type="submit">{pending ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"} <Arrow /></button><button className="text-button" type="button" onClick={() => chooseMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "New here? Sign up" : "Already registered? Sign in"}</button></div></form></div><BalanceVisual cost="private · server-side" upside="history · continuity" label="YOURS" /></section></main>;
}
