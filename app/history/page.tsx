import Link from "next/link";
import { redirect } from "next/navigation";
import { Arrow } from "../../components/arrow";
import { SiteHeader } from "../../components/site-header";
import { currentUser } from "../../lib/auth";
import { databaseConfigured, query } from "../../lib/db";
import type { DecisionReply, DecisionVerdict } from "../../lib/decision-chat";
import { profileForUser } from "../../lib/profile";

export const dynamic = "force-dynamic";

type HistoryRow = {
  id: string; verdict: DecisionVerdict; decision_json: DecisionReply | null;
  marked_going_at: Date | null; marked_skip_at: Date | null; updated_at: Date; prompt: string;
  feedback_rating: number | null; feedback_type: "went" | "skipped" | null;
};

export default async function HistoryPage() {
  if (!databaseConfigured()) redirect("/login");
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login");
  const [storedProfile, result] = await Promise.all([
    profileForUser(user.id),
    query<HistoryRow>(`SELECT threads.id, threads.verdict, threads.decision_json, threads.marked_going_at, threads.marked_skip_at, threads.updated_at,
      feedback.rating AS feedback_rating, feedback.response_type AS feedback_type,
      COALESCE((SELECT content FROM decision_messages WHERE thread_id = threads.id AND role = 'user' ORDER BY created_at ASC LIMIT 1), 'New decision') AS prompt
      FROM decision_threads AS threads LEFT JOIN decision_feedback AS feedback ON feedback.thread_id = threads.id
      WHERE threads.user_id = $1 ORDER BY threads.updated_at DESC LIMIT 24`, [user.id])
  ]);
  const destination = storedProfile ? "/decide" : "/onboarding";

  return <main><SiteHeader signedIn /><section className="history-page page-shell"><div className="history-heading"><div><div className="kicker"><span /> Your decision history</div><h1>What you&apos;ve<br /><em>weighed before.</em></h1><p>{user.email} · {storedProfile ? "Baseline ready" : "Baseline not completed"}</p></div><Link className="primary" href={destination}>{storedProfile ? "New decision" : "Complete setup"} <Arrow /></Link></div>{result.rows.length ? <div className="history-list">{result.rows.map((item, index) => <article className="history-card" key={item.id}><div className="history-number">{String(index + 1).padStart(2, "0")}</div><div><div className="history-meta"><span>{item.verdict === "going" ? `GO · ${item.decision_json?.score ?? "—"}/100` : item.verdict === "skip" ? `SKIP · ${item.decision_json?.score ?? "—"}/100` : "OPEN"}</span><time>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(item.updated_at)}</time>{item.marked_going_at && <b>MARKED GOING</b>}{item.marked_skip_at && <b>MARKED NOT GOING</b>}{item.feedback_rating && <b>FEEDBACK {item.feedback_rating}/5</b>}</div><h2>{item.prompt}</h2>{item.decision_json?.summary && <p>{item.decision_json.summary}</p>}{item.decision_json?.reasons?.length ? <ul>{item.decision_json.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>Conversation started — no final verdict yet.</p>}</div></article>)}</div> : <div className="history-empty"><span>01</span><h2>No decisions yet.</h2><p>{storedProfile ? "Start a conversation and your scores will appear here." : "Complete the short baseline questionnaire so WorthIt has useful starting context."}</p><Link className="text-button" href={destination}>{storedProfile ? "Start your first decision" : "Build your baseline"} →</Link></div>}</section></main>;
}
