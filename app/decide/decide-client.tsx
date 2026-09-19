"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Arrow } from "../../components/arrow";
import { BalanceVisual } from "../../components/balance-visual";
import { SiteHeader } from "../../components/site-header";
import type { ChatAttachment, ChatMessage, DecisionMetric, DecisionReply } from "../../lib/decision-chat";

const welcome: ChatMessage = { role: "assistant", content: "Tell me what you’re considering. I’ll ask for any decision-critical detail that’s missing, then give you a full scorecard—not just a yes or no." };
const emptyDecision: DecisionReply = { reply: "", score: null, confidence: "low", summary: "", cost: [], upside: [], verdict: "undecided", reasons: [], choices: [], event: null };
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]);
const benefitOptions = ["Learned something", "Meaningful connection", "Useful opportunity", "Had fun", "Tried something new", "Strengthened a relationship"];
const costOptions = ["Travel", "Money", "Waiting", "Crowd", "Social effort", "Lost sleep", "Time commitment", "Nothing significant"];

function meterText(metrics: DecisionMetric[], fallback: string) {
  return metrics.length ? metrics.slice(0, 2).map(item => `${item.label} ${item.value}`).join(" · ") : fallback;
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read file"));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function DecideClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<DecisionReply>(emptyDecision);
  const [threadId, setThreadId] = useState<string>();
  const [marked, setMarked] = useState<"going" | "skip" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const conversation = useMemo(() => messages.slice(1), [messages]);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError("");
    const selected = Array.from(files).slice(0, 4 - attachments.length);
    try {
      const next = await Promise.all(selected.map(async file => {
        const extension = file.name.split(".").pop()?.toLowerCase();
        const inferredType = extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : extension === "pdf" ? "application/pdf" : extension === "txt" ? "text/plain" : file.type;
        if (!allowedTypes.has(inferredType)) throw new Error(`${file.name} is not a supported file type.`);
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10 MB.`);
        const dataUrl = (await readFile(file)).replace(/^data:[^;]*;/, `data:${inferredType};`);
        return { name: file.name, type: inferredType, size: file.size, dataUrl };
      }));
      setAttachments(current => [...current, ...next]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not attach that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim() || (attachments.length ? "Please use the attached event information to help me decide." : "");
    if (!content || pending) return;
    const userMessage: ChatMessage = { role: "user", content, attachments: attachments.length ? attachments : undefined };
    const next = [...conversation, userMessage];
    setMessages(current => [...current, userMessage]);
    setInput(""); setAttachments([]); setError(""); setPending(true);
    try {
      const response = await fetch("/api/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, threadId }) });
      const payload = await response.json() as DecisionReply & { error?: string; code?: string };
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (payload.code === "PROFILE_NOT_CONFIGURED") { window.location.assign("/onboarding"); return; }
      if (!response.ok) {
        const setup = payload.code === "NVIDIA_NOT_CONFIGURED" ? "Add NVIDIA_API_KEY to .env.local, then restart the server." : payload.code === "DATABASE_NOT_CONFIGURED" ? "Add DATABASE_URL and run npm run migrate." : payload.error;
        throw new Error(setup ?? "The AI is unavailable right now.");
      }
      setDecision(payload); setThreadId(payload.threadId);
      setMessages(current => [...current, { role: "assistant", content: payload.reply }]);
    } catch (reason) {
      setMessages(current => current.slice(0, -1));
      setInput(content.startsWith("Please use the attached") ? "" : content);
      setAttachments(userMessage.attachments ?? []);
      setError(reason instanceof Error ? reason.message : "The AI is unavailable right now.");
    } finally { setPending(false); }
  };

  const reset = () => {
    setMessages([welcome]); setDecision(emptyDecision); setInput(""); setAttachments([]); setError(""); setMarked(null); setThreadId(undefined);
  };

  const markDecision = async (choice: "going" | "skip") => {
    if (!threadId) return;
    const response = await fetch("/api/decide/mark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, choice }) });
    if (response.ok) setMarked(choice); else setError("Could not save this decision. Please try again.");
  };

  return <main>
    <SiteHeader signedIn progress={decision.verdict === "undecided" ? Math.min(80, conversation.length * 18) : 100} />
    <section className="decide-page page-shell">
      <div className="decide-heading"><div className="kicker"><span /> Let&apos;s talk it through</div><h1>Let&apos;s figure out<br /><em>if it&apos;s worth it.</em></h1></div>
      <div className="decide-grid">
        <div className="chat-panel">
          <div className="chat-thread" aria-live="polite">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>{message.role === "assistant" && <div className="chat-avatar" aria-label="WorthIt AI">?</div>}<div className="chat-bubble">{message.content}{message.attachments?.map(file => <span className="message-file" key={file.name}><Paperclip />{file.name}</span>)}</div></div>)}{pending && <div className="chat-message assistant"><div className="chat-avatar">?</div><div className="chat-bubble thinking">Checking what matters and whether anything important is still missing…</div></div>}</div>
          {error && <p className="chat-error" role="alert">{error}</p>}
          <form className="chat-input" onSubmit={send}><label htmlFor="decision-message">Your message</label>{attachments.length > 0 && <div className="attachment-list">{attachments.map((file, index) => <span key={`${file.name}-${index}`}><Paperclip />{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div>}<div><button className="attach-button" type="button" aria-label="Attach image, PDF, or Word document" onClick={() => fileRef.current?.click()}><Paperclip /></button><input ref={fileRef} hidden multiple type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.txt" onChange={event => addFiles(event.target.files)} /><textarea id="decision-message" value={input} onChange={event => setInput(event.target.value)} placeholder="Tell WorthIt what you're weighing…" rows={2} /><button className="primary" disabled={(!input.trim() && !attachments.length) || pending} type="submit">Send <Arrow /></button></div><small>PNG · JPG · WEBP · PDF · DOCX · TXT · 10 MB each</small></form>
        </div>
        <div className="decision-meter"><BalanceVisual cost={meterText(decision.cost, "still listening")} upside={meterText(decision.upside, "still listening")} verdict={decision.verdict} label={decision.verdict === "undecided" ? "DECIDING" : decision.verdict === "going" ? "GO" : "SKIP"} /><p className="meter-note"><span>AI-INFERRED</span> from this conversation · possibilities, not promises</p></div>
      </div>
      {decision.verdict !== "undecided" && <Scorecard decision={decision} marked={marked} threadId={threadId} onMark={markDecision} onReset={reset} />}
    </section>
  </main>;
}

function Scorecard({ decision, marked, threadId, onMark, onReset }: { decision: DecisionReply; marked: "going" | "skip" | null; threadId?: string; onMark: (choice: "going" | "skip") => void; onReset: () => void }) {
  const fallback = decision.verdict === "going" ? ["The upside matches what matters to you", "The real-world costs look manageable", "The balance is strong enough to act on"] : ["The costs currently outweigh the likely upside", "The timing or effort does not fit well", "Skipping preserves room for a better match"];
  const items = decision.reasons.length === 3 ? decision.reasons : fallback;
  return <section className="scorecard" aria-label="WorthIt scorecard">
    <div className="scorecard-head"><div><div className="kicker"><span /> Your decision scorecard</div><h2>{decision.verdict === "going" ? "Worth" : "Not worth"}<br /><em>going.</em></h2><p>{decision.summary || decision.reply}</p></div><div className="score-result"><span>WORTH IT SCORE</span><div><strong>{decision.score ?? "—"}</strong><i>/100</i></div><b>{decision.confidence.toUpperCase()} CONFIDENCE</b></div></div>
    <div className="metric-grid"><MetricGroup title="YOUR UPSIDE" metrics={decision.upside} positive /><div className="metric-divider">VS</div><MetricGroup title="YOUR COST" metrics={decision.cost} /></div>
    <div className="decision-reasons">{items.map((reason, index) => <div key={`${reason}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{reason}</p></div>)}</div>
    <div className="verdict-actions"><button className="primary" onClick={() => onMark("going")}>Mark as going <Arrow /></button><button className="text-button" onClick={() => onMark("skip")}>Mark as not going</button><button className="text-button" onClick={onReset}>Ask something else</button></div>
    {marked && threadId && <FeedbackSurvey threadId={threadId} choice={marked} />}
  </section>;
}

function MetricGroup({ title, metrics, positive = false }: { title: string; metrics: DecisionMetric[]; positive?: boolean }) {
  return <div className={`score-metrics ${positive ? "positive" : "negative"}`}><h3>{title}</h3>{metrics.map(item => <div className="score-metric" key={item.label}><span>{item.label}</span><div><i style={{ width: `${item.value}%` }} /></div><b>{item.value}</b></div>)}</div>;
}

function FeedbackSurvey({ threadId, choice }: { threadId: string; choice: "going" | "skip" }) {
  const [rating, setRating] = useState(0);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [costs, setCosts] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  const save = async () => {
    setError("");
    const response = await fetch("/api/decide/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, responseType: choice === "going" ? "went" : "skipped", rating, benefits, costs, note }) });
    if (response.ok) setSaved(true); else setError((await response.json().catch(() => null))?.error ?? "Could not save your feedback.");
  };
  if (saved) return <div className="feedback-inline saved"><span>FEEDBACK SAVED</span><h3>That makes the next score more personal.</h3><p>WorthIt will treat this outcome as soft evidence when it weighs future decisions.</p></div>;
  return <div className="feedback-inline"><div className="kicker"><span /> Close the loop</div><h3>{choice === "going" ? "After you go, how worth it was it in reality?" : "How good does skipping feel in hindsight?"}</h3><div className="rating-row"><span>NOT AT ALL</span>{[1,2,3,4,5].map(value => <button className={value <= rating ? "active" : ""} key={value} onClick={() => setRating(value)} aria-label={`${value} out of 5`}>●</button>)}<span>VERY</span></div><fieldset><legend>{choice === "going" ? "What paid off?" : "What did skipping protect?"}</legend>{benefitOptions.map(option => <button type="button" className={benefits.includes(option) ? "selected" : ""} key={option} onClick={() => toggle(option, benefits, setBenefits)}>{option}</button>)}</fieldset><fieldset><legend>{choice === "going" ? "What cost more than expected?" : "What do you think you missed?"}</legend>{costOptions.map(option => <button type="button" className={costs.includes(option) ? "selected" : ""} key={option} onClick={() => toggle(option, costs, setCosts)}>{option}</button>)}</fieldset><label>Anything WorthIt should remember?<textarea value={note} onChange={event => setNote(event.target.value)} rows={3} placeholder="A short note about what felt right or wrong…" /></label>{error && <p className="chat-error" role="alert">{error}</p>}<button className="primary" disabled={!rating} onClick={save}>Save feedback <Arrow /></button></div>;
}

function Paperclip() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12.5 14 7a3 3 0 0 1 4.2 4.2l-7.1 7.1a5 5 0 0 1-7.1-7.1l7.4-7.4" /></svg>; }
