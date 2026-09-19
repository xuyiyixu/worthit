"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Arrow } from "../../components/arrow";
import { SiteHeader } from "../../components/site-header";
import { questions } from "../../lib/questions";

export function OnboardingClient() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const question = questions[index];

  const choose = async (answer: number) => {
    if (pending) return;
    const next = [...answers, answer]; setAnswers(next); setError("");
    if (index < questions.length - 1) { setIndex(current => current + 1); return; }
    setPending(true);
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: next }) });
      const payload = await response.json() as { error?: string };
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(payload.error ?? "Could not save your answers.");
      router.replace("/decide"); router.refresh();
    } catch (reason) {
      setAnswers(current => current.slice(0, -1));
      setError(reason instanceof Error ? reason.message : "Could not save your answers.");
      setPending(false);
    }
  };

  const back = () => { if (!pending && index > 0) { setAnswers(current => current.slice(0, -1)); setIndex(current => current - 1); } };

  return <main><SiteHeader signedIn progress={Math.round((index / questions.length) * 100)} /><section className="question-page page-shell"><div className="step-caption"><span>BUILD YOUR BASELINE</span><b>{String(index + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}</b></div><div className="question-wrap" key={index}><p className="question-eyebrow">{question.eyebrow}</p><h2>{question.prompt}</h2><div className="option-list">{question.options.map((option, optionIndex) => <button disabled={pending} key={option.label} onClick={() => choose(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option.label}<Arrow /></button>)}</div>{index > 0 && <button className="back-link" disabled={pending} onClick={back}>← Back</button>}{error && <p className="chat-error onboarding-error" role="alert">{error}</p>}<p className="privacy-note">Your answers stay private and give WorthIt a starting point for future decisions.</p></div></section></main>;
}
