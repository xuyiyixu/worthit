"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Arrow } from "../../components/arrow";
import { BalanceVisual } from "../../components/balance-visual";
import { SiteHeader } from "../../components/site-header";
import type { ChatAttachment, ChatMessage, DecisionMetric, DecisionReply, DecisionVerdict } from "../../lib/decision-chat";

const welcome: ChatMessage = { role: "assistant", content: "Tell me what you’re considering. Add the event details—or attach a flyer, PDF, or Word document—and tell me what draws you in or makes you hesitate." };
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]);

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
  const [decision, setDecision] = useState<DecisionReply>({ reply: "", cost: [], upside: [], verdict: "undecided", reasons: [] });
  const [threadId, setThreadId] = useState<string>();
  const [marked, setMarked] = useState(false);
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
        const rawDataUrl = await readFile(file);
        const dataUrl = rawDataUrl.replace(/^data:[^;]*;/, `data:${inferredType};`);
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
    setMessages([welcome]); setDecision({ reply: "", cost: [], upside: [], verdict: "undecided", reasons: [] }); setInput(""); setAttachments([]); setError(""); setMarked(false); setThreadId(undefined);
  };

  const markGoing = async () => {
    if (!threadId || marked) return;
    const response = await fetch("/api/decide/mark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId }) });
    if (response.ok) setMarked(true); else setError("Could not save this decision. Please try again.");
  };

  return <main><SiteHeader progress={decision.verdict === "undecided" ? Math.min(80, conversation.length * 18) : 100} /><section className="decide-page page-shell"><div className="decide-heading"><div className="kicker"><span /> Let&apos;s talk it through</div><h1>Let&apos;s figure out<br /><em>if it&apos;s worth it.</em></h1></div><div className="decide-grid"><div className="chat-panel"><div className="chat-thread" aria-live="polite">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>{message.role === "assistant" && <div className="chat-avatar" aria-label="WorthIt AI">?</div>}<div className="chat-bubble">{message.content}{message.attachments?.map(file => <span className="message-file" key={file.name}><Paperclip />{file.name}</span>)}</div></div>)}{pending && <div className="chat-message assistant"><div className="chat-avatar">?</div><div className="chat-bubble thinking">Reading the details and weighing both sides…</div></div>}</div>{error && <p className="chat-error" role="alert">{error}</p>}<form className="chat-input" onSubmit={send}><label htmlFor="decision-message">Your message</label>{attachments.length > 0 && <div className="attachment-list">{attachments.map((file, index) => <span key={`${file.name}-${index}`}><Paperclip />{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div>}<div><button className="attach-button" type="button" aria-label="Attach image, PDF, or Word document" onClick={() => fileRef.current?.click()}><Paperclip /></button><input ref={fileRef} hidden multiple type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.txt" onChange={event => addFiles(event.target.files)} /><textarea id="decision-message" value={input} onChange={event => setInput(event.target.value)} placeholder="Tell WorthIt what you're weighing…" rows={2} /><button className="primary" disabled={(!input.trim() && !attachments.length) || pending} type="submit">Send <Arrow /></button></div><small>PNG · JPG · WEBP · PDF · DOCX · TXT · 10 MB each</small></form></div><div className="decision-meter"><BalanceVisual cost={meterText(decision.cost, "still listening")} upside={meterText(decision.upside, "still listening")} verdict={decision.verdict} label={decision.verdict === "undecided" ? "DECIDING" : decision.verdict === "going" ? "GO" : "SKIP"} /><p className="meter-note"><span>AI-INFERRED</span> from this conversation · possibilities, not promises</p></div></div>{decision.verdict !== "undecided" && <Verdict reasons={decision.reasons} verdict={decision.verdict} marked={marked} onMark={markGoing} onReset={reset} />}</section></main>;
}

function Verdict({ reasons, verdict, marked, onMark, onReset }: { reasons: string[]; verdict: Exclude<DecisionVerdict, "undecided">; marked: boolean; onMark: () => void; onReset: () => void }) {
  const fallback = verdict === "going" ? ["The upside matches what matters to you", "The real-world costs look manageable", "The balance is strong enough to act on"] : ["The costs currently outweigh the likely upside", "The timing or effort does not fit well", "Skipping preserves room for a better match"];
  const items = reasons.length === 3 ? reasons : fallback;
  return <div className="verdict-section"><div className="decision-reasons">{items.map((reason, index) => <div key={reason}><span>{String(index + 1).padStart(2, "0")}</span><p>{reason}</p></div>)}</div><div className="verdict-actions"><button className="primary" disabled={marked} onClick={onMark}>{marked ? "Marked as going" : "Mark as going"} <Arrow /></button><button className="text-button" onClick={onReset}>Ask something else</button></div></div>;
}

function Paperclip() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12.5 14 7a3 3 0 0 1 4.2 4.2l-7.1 7.1a5 5 0 0 1-7.1-7.1l7.4-7.4" /></svg>; }
