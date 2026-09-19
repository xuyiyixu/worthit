"use client";

import { useEffect, useRef, useState } from "react";
import { Arrow } from "../components/arrow";
import { BalanceVisual } from "../components/balance-visual";
import { SiteHeader } from "../components/site-header";
import { demoText, understandEvent } from "../lib/event-understanding";
import { inferProfile, questions } from "../lib/questions";
import { calculateWorth, formatTime } from "../lib/worth-engine";
import type { EventUnderstanding, SocialPatternProfile, WorthAnalysis } from "../lib/types";

type Stage = "landing" | "questions" | "event" | "context" | "analysis" | "feedback";

const emptyProfile = inferProfile([]);

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [profile, setProfile] = useState<SocialPatternProfile>(emptyProfile);
  const [eventText, setEventText] = useState("");
  const [event, setEvent] = useState<EventUnderstanding | null>(null);
  const [travel, setTravel] = useState(25);
  const [knownPeople, setKnownPeople] = useState(1);
  const [analysis, setAnalysis] = useState<WorthAnalysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileMessage, setFileMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("worthit-session");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.profile && parsed.eventText) {
        setProfile(parsed.profile);
        setEventText(parsed.eventText);
      }
    } catch { /* A broken local draft should never block the core flow. */ }
  }, []);

  const chooseAnswer = (option: number) => {
    const next = [...answers, option];
    setAnswers(next);
    if (questionIndex === questions.length - 1) {
      const nextProfile = inferProfile(next);
      setProfile(nextProfile);
      setTimeout(() => setStage("event"), 220);
    } else {
      setTimeout(() => setQuestionIndex(questionIndex + 1), 180);
    }
  };

  const parseEvent = (demo = false) => {
    const text = demo ? demoText : eventText.trim();
    if (!text) return;
    if (demo) setEventText(text);
    const parsed = understandEvent(text, demo);
    setEvent(parsed);
    localStorage.setItem("worthit-session", JSON.stringify({ profile, eventText: text }));
    setStage("context");
  };

  const runAnalysis = () => {
    if (!event) return;
    setAnalysis(calculateWorth(event, profile, travel, knownPeople));
    setStage("analysis");
  };

  const reset = () => {
    setStage("landing"); setQuestionIndex(0); setAnswers([]); setEvent(null); setAnalysis(null); setEventText(""); setFileName("");
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!allowed.includes(file.type) && !file.name.endsWith(".docx")) { setFileMessage("That file type isn’t supported yet."); return; }
    if (file.size > 10 * 1024 * 1024) { setFileMessage("Please choose a file smaller than 10 MB."); return; }
    setFileName(file.name);
    if (file.type === "text/plain") {
      setEventText(await file.text()); setFileMessage("Text extracted. Review it below before continuing.");
    } else {
      setFileMessage("File attached. For this MVP, add or paste the key event details below so you can verify the analysis.");
    }
  };

  return (
    <main>
      <SiteHeader progress={{ landing: 0, questions: 25, event: 50, context: 75, analysis: 100, feedback: 100 }[stage]} onHome={reset} />
      {stage === "landing" && <Landing onStart={() => setStage("questions")} onDemo={() => { setProfile(inferProfile([1,1,1,2,0,1,2,0])); setTimeout(() => { setEventText(demoText); const e = understandEvent(demoText, true); setEvent(e); setAnalysis(calculateWorth(e, inferProfile([1,1,1,2,0,1,2,0]), 25, 1)); setStage("analysis"); }, 100); }} />}
      {stage === "questions" && <Questionnaire index={questionIndex} onChoose={chooseAnswer} onBack={() => { if (questionIndex > 0) { setAnswers(answers.slice(0, -1)); setQuestionIndex(questionIndex - 1); } else setStage("landing"); }} />}
      {stage === "event" && <EventInput text={eventText} setText={setEventText} fileName={fileName} fileMessage={fileMessage} fileRef={fileRef} handleFile={handleFile} onContinue={() => parseEvent(false)} onDemo={() => parseEvent(true)} />}
      {stage === "context" && event && <QuickContext event={event} travel={travel} setTravel={setTravel} knownPeople={knownPeople} setKnownPeople={setKnownPeople} onBack={() => setStage("event")} onAnalyze={runAnalysis} />}
      {stage === "analysis" && event && analysis && <Analysis event={event} analysis={analysis} onFeedback={() => setStage("feedback")} onAnother={() => { setEvent(null); setAnalysis(null); setEventText(""); setStage("event"); }} />}
      {stage === "feedback" && event && <Feedback eventName={event.name} onDone={() => setStage("analysis")} />}
    </main>
  );
}

function Landing({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return <section className="landing page-shell">
    <div className="landing-copy"><div className="kicker"><span /> A clearer yes or no</div><h1>Is it actually<br /><em>worth going?</em></h1><p>See what an event may ask of you, what it may give back, and when the balance is best.</p><div className="actions"><button className="primary" onClick={onStart}>Find out <Arrow /></button><button className="text-button" onClick={onDemo}>See a 30-second demo</button></div></div>
    <BalanceVisual />
    <div className="trust-line"><span>01</span> Personal, not generic <span>02</span> Balanced, not pessimistic <span>03</span> Explainable, not magic</div>
  </section>;
}

function Questionnaire({ index, onChoose, onBack }: { index: number; onChoose: (n: number) => void; onBack: () => void }) {
  const question = questions[index];
  return <section className="question-page page-shell"><div className="step-caption"><span>UNDERSTAND ME</span><b>{String(index + 1).padStart(2,"0")} / {String(questions.length).padStart(2,"0")}</b></div><div className="question-wrap" key={index}><p className="question-eyebrow">{question.eyebrow}</p><h2>{question.prompt}</h2><div className="option-list">{question.options.map((option, i) => <button key={option.label} onClick={() => onChoose(i)}><span>{String.fromCharCode(65 + i)}</span>{option.label}<Arrow /></button>)}</div><button className="back-link" onClick={onBack}>← Back</button><p className="privacy-note">No labels. No personality score. Just better context for this decision.</p></div></section>;
}

function EventInput({ text, setText, fileName, fileMessage, fileRef, handleFile, onContinue, onDemo }: { text: string; setText: (s: string) => void; fileName: string; fileMessage: string; fileRef: React.RefObject<HTMLInputElement | null>; handleFile: (f?: File) => void; onContinue: () => void; onDemo: () => void }) {
  return <section className="input-page page-shell"><div className="step-caption"><span>ADD EVENT</span><b>02 / 04</b></div><div className="input-heading"><p className="kicker"><span /> Bring us the messy details</p><h2>What are you<br /><em>considering?</em></h2><p>Paste the listing, invitation, or anything you have. You can clean it up before we analyze it.</p></div><div className="event-entry" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}><button className="drop-zone" onClick={() => fileRef.current?.click()}><Upload /><strong>{fileName || "Drop an event here"}</strong><span>Image · PDF · Word · up to 10 MB</span></button><input ref={fileRef} hidden type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.txt" onChange={e => handleFile(e.target.files?.[0])} /><div className="or"><span />or<span /></div><label><span>PASTE EVENT INFORMATION</span><textarea value={text} onChange={e => setText(e.target.value)} placeholder={'Event name\nDate and time\nLocation\nWhat’s happening…'} /></label>{fileMessage && <p className="file-message">{fileMessage}</p>}<div className="entry-actions"><button className="text-button" onClick={onDemo}>Use demo event</button><button className="primary" disabled={!text.trim()} onClick={onContinue}>Understand this event <Arrow /></button></div></div></section>;
}

function QuickContext({ event, travel, setTravel, knownPeople, setKnownPeople, onBack, onAnalyze }: { event: EventUnderstanding; travel: number; setTravel: (n: number) => void; knownPeople: number; setKnownPeople: (n: number) => void; onBack: () => void; onAnalyze: () => void }) {
  const people = ["No one", "Maybe one person", "A few people", "A lot of people"];
  return <section className="context-page page-shell"><div className="step-caption"><span>QUICK CONTEXT</span><b>03 / 04</b></div><div className="context-grid"><div><p className="kicker"><span /> Two things we can’t infer</p><h2>Make it<br /><em>yours.</em></h2><div className="event-summary"><small>INFERRED FROM YOUR TEXT</small><strong>{event.name}</strong><span>{formatTime(event.startHour)} — {formatTime(event.endHour)} · {event.location}</span></div></div><div className="context-form"><label>How long would it take you to get there?<div className="number-input"><input type="number" min="0" max="240" value={travel} onChange={e => setTravel(Number(e.target.value))} /><span>minutes</span></div><small>USER PROVIDED · We won’t guess your travel.</small></label><fieldset><legend>Would you know anyone there?</legend>{people.map((p, i) => <button className={knownPeople === i ? "selected" : ""} onClick={() => setKnownPeople(i)} key={p}>{p}<span>{knownPeople === i ? "●" : "○"}</span></button>)}</fieldset><div className="form-actions"><button className="back-link" onClick={onBack}>← Back</button><button className="primary" onClick={onAnalyze}>Show me if it’s worth it <Arrow /></button></div></div></div></section>;
}

function Analysis({ event, analysis, onFeedback, onAnother }: { event: EventUnderstanding; analysis: WorthAnalysis; onFeedback: () => void; onAnother: () => void }) {
  return <section className="analysis-page"><div className="analysis-hero page-shell"><div className="analysis-title"><div><span className="provenance">{event.provenance} ANALYSIS</span><h1>{event.name}</h1><p>{formatTime(event.startHour)} — {formatTime(event.endHour)} · {event.location}</p></div><Score score={analysis.score} verdict={analysis.verdict} /></div><div className="balance-grid"><Breakdown title="WHAT YOU MAY GET" items={analysis.upside} positive /><div className="versus">VS</div><Breakdown title="WHAT IT MAY COST" items={analysis.costs} /></div></div><div className="window-section"><div className="page-shell window-grid"><div className="window-copy"><span className="section-number">THE SWEET SPOT</span><h2>{formatTime(analysis.bestStart)}<br /><em>to {formatTime(analysis.bestEnd)}</em></h2><p>Arriving a little after the start lets the initial rush ease while most of the event’s potential value is still ahead.</p><div className="why-grid"><div><span>WHY THEN</span><strong>Less friction</strong><p>Predicted wait and crowd pressure are lower than at doors-open.</p></div><div><span>WHY NOT LATER</span><strong>Value starts fading</strong><p>You begin losing time, main activities, and connection opportunities.</p></div></div></div><WorthCurve analysis={analysis} event={event} /></div></div><div className="analysis-footer page-shell"><p>WorthIt estimates possibilities, not promises. Traits are inferred from the details you provided.</p><div><button className="text-button" onClick={onAnother}>Analyze another event</button><button className="primary dark" onClick={onFeedback}>I went — tell WorthIt how it was <Arrow /></button></div></div></section>;
}

function Score({ score, verdict }: { score: number; verdict: string }) { return <div className="score"><span>YOUR WORTH SCORE</span><div><strong>{score}</strong><i>/ 100</i></div><b>{verdict}</b></div>; }

function Breakdown({ title, items, positive = false }: { title: string; items: WorthAnalysis["upside"]; positive?: boolean }) {
  const total = items.reduce((sum, item) => sum + item.points, 0);
  return <div className={`breakdown ${positive ? "positive" : "negative"}`}><h3>{title}</h3><div className="breakdown-total"><strong>{positive ? "+" : "−"}{total}</strong><span>weighted points</span></div>{items.map(item => <div className="breakdown-row" key={item.key}><div><strong>{item.label}</strong><small>{item.note}</small></div><div className="bar"><i style={{ width: `${Math.min(100, item.points / 24 * 100)}%` }} /></div><b>{positive ? "+" : "−"}{item.points}</b></div>)}</div>;
}

function WorthCurve({ analysis, event }: { analysis: WorthAnalysis; event: EventUnderstanding }) {
  const width = 600, height = 250, pad = 34;
  const minScore = Math.max(0, Math.min(...analysis.curve.map(p => p.score)) - 8);
  const maxScore = Math.min(100, Math.max(...analysis.curve.map(p => p.score)) + 8);
  const points = analysis.curve.map((point, i) => `${pad + i / (analysis.curve.length - 1) * (width - pad * 2)},${height - pad - (point.score - minScore) / Math.max(1, maxScore - minScore) * (height - pad * 2)}`).join(" ");
  const bestIndex = analysis.curve.findIndex(p => p.hour === analysis.bestStart);
  const best = analysis.curve[Math.max(0, bestIndex)];
  const bx = pad + Math.max(0, bestIndex) / (analysis.curve.length - 1) * (width - pad * 2);
  const by = height - pad - (best.score - minScore) / Math.max(1, maxScore - minScore) * (height - pad * 2);
  return <div className="curve"><div className="curve-head"><div><span>PREDICTED WORTH OVER TIME</span><strong>The balance changes as the night unfolds.</strong></div><span className="legend"><i /> BEST WINDOW</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Predicted worth by arrival time"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff5a36" stopOpacity=".28"/><stop offset="1" stopColor="#ff5a36" stopOpacity="0"/></linearGradient></defs><line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} className="axis"/><polygon points={`${pad},${height-pad} ${points} ${width-pad},${height-pad}`} fill="url(#fill)"/><polyline points={points} className="curve-line"/><line x1={bx} y1={30} x2={bx} y2={height-pad} className="best-line"/><circle cx={bx} cy={by} r="8" className="best-dot"/><text x={bx} y={20} textAnchor="middle" className="best-label">{best.score} WORTH</text><text x={pad} y={height-8} className="axis-label">{formatTime(event.startHour)}</text><text x={width-pad} y={height-8} textAnchor="end" className="axis-label">{formatTime(event.endHour)}</text></svg><div className="curve-provenance"><span>PREDICTED</span> from event format and general arrival patterns · no live crowd data</div></div>;
}

function Feedback({ eventName, onDone }: { eventName: string; onDone: () => void }) {
  const [rating, setRating] = useState(0); const [saved, setSaved] = useState(false);
  const benefits = ["Learned something", "Met someone interesting", "Meaningful time with people", "Tried something new", "Had fun", "Found a useful opportunity"];
  const costs = ["Travel", "Waiting", "Crowd", "Talking to new people", "Staying late", "Time commitment", "Nothing"];
  return <section className="feedback-page page-shell"><div className="step-caption"><span>AFTER THE EVENT</span><b>LEARN FROM REALITY</b></div><div className="feedback-card"><p className="kicker"><span /> {eventName}</p><h2>{saved ? "Thanks — that helps." : "Looking back, was it worth going?"}</h2>{saved ? <><p className="saved-copy">Your experience is saved on this device. Future versions can use it to tune what “worth it” means for you.</p><button className="primary" onClick={onDone}>Back to analysis <Arrow /></button></> : <><div className="rating"><span>Definitely not</span>{[1,2,3,4,5].map(n => <button className={rating >= n ? "active" : ""} onClick={() => setRating(n)} key={n}>●</button>)}<span>Definitely</span></div><CheckGroup title="What did you actually get out of it?" options={benefits}/><CheckGroup title="What felt harder than expected?" options={costs}/><button className="primary" disabled={!rating} onClick={() => setSaved(true)}>Save reflection <Arrow /></button></>}</div></section>;
}

function CheckGroup({ title, options }: { title: string; options: string[] }) { const [selected, setSelected] = useState<string[]>([]); return <fieldset className="checks"><legend>{title}</legend>{options.map(option => <button key={option} className={selected.includes(option) ? "selected" : ""} onClick={() => setSelected(selected.includes(option) ? selected.filter(x => x !== option) : [...selected, option])}><span>{selected.includes(option) ? "✓" : ""}</span>{option}</button>)}</fieldset>; }

function Upload() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 22V7m0 0-6 6m6-6 6 6M7 22v3h18v-3" /></svg>; }
