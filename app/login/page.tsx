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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, email, password }) });
      const payload = await response.json() as { error?: string; code?: string };
      if (!response.ok) throw new Error(payload.code === "NOT_CONFIGURED" ? "Add DATABASE_URL to .env.local and run npm run migrate." : payload.error ?? "Unable to sign in.");
      router.replace("/decide");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  };

  return <main><SiteHeader /><section className="login-page page-shell"><div className="login-copy"><div className="kicker"><span /> Your decisions, remembered</div><h1>{mode === "login" ? "Welcome" : "Make it"}<br /><em>{mode === "login" ? "back." : "personal."}</em></h1><p>Sign in so your conversations, evidence, and decisions belong to you—not to a browser tab.</p><form className="login-form" onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" required /></label>{error && <p className="chat-error" role="alert">{error}</p>}<div className="actions"><button className="primary" disabled={pending} type="submit">{pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"} <Arrow /></button><button className="text-button" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "I already have an account"}</button></div></form></div><BalanceVisual cost="private · server-side" upside="history · continuity" label="YOURS" /></section></main>;
}
