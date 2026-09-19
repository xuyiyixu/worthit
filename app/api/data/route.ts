import { randomUUID } from "node:crypto";
import { currentUser } from "../../../lib/auth";
import { databaseConfigured, query } from "../../../lib/db";
import { emptyState, inferContext, type AppState, type Decision, type Message, type Outcome, type Profile } from "../../../lib/model";
import { questionNeedsTypedAnswer, type DecisionReply } from "../../../lib/decision-chat";
import { profileForUser, type StoredProfile } from "../../../lib/profile";
import { makeReading } from "../../../lib/tarot";

type ThreadRow = { id: string; created_at: Date; prompt: string; decision_json: DecisionReply | null; marked_going_at: Date | null; marked_skip_at: Date | null };
type MessageRow = { id: string; thread_id: string; role: "user" | "assistant"; content: string; created_at: Date };
type FeedbackRow = {
  thread_id: string;
  response_type: "went" | "skipped";
  rating: number;
  benefits: string[];
  costs: string[];
  note: string;
  created_at: Date;
};

function designProfile(email: string, stored: StoredProfile | null): Profile {
  const base = emptyState(email.split("@")[0] || "Friend").profile;
  if (!stored) return base;
  const source = stored.profile;
  return {
    ...base,
    onboarded: true,
    recovery: Math.round((1 - source.crowdTolerance) * 100),
    groupSize: Math.round(source.largeGroupPreference * 100),
    strangerComfort: Math.round(source.strangerOpenness * 100),
    spontaneity: Math.round(source.noveltySeeking * 100),
    fomo: Math.round(source.connectionMotivation * 100),
    boundaries: Math.round((1 - source.familiarPeoplePreference / 2) * 100),
    support: Math.round(source.connectionMotivation * 100),
  };
}

async function stateForUser(user: { id: string; email: string }): Promise<AppState> {
  const [stored, threads, messages, feedback] = await Promise.all([
    profileForUser(user.id),
    query<ThreadRow>(`SELECT threads.id, threads.created_at, threads.decision_json, threads.marked_going_at, threads.marked_skip_at,
      COALESCE((SELECT content FROM decision_messages WHERE thread_id = threads.id AND role = 'user' ORDER BY created_at LIMIT 1), 'New decision') AS prompt
      FROM decision_threads AS threads WHERE threads.user_id = $1 ORDER BY threads.updated_at DESC LIMIT 40`, [user.id]),
    query<MessageRow>(`SELECT messages.id, messages.thread_id, messages.role, messages.content, messages.created_at
      FROM decision_messages AS messages JOIN decision_threads AS threads ON threads.id = messages.thread_id
      WHERE threads.user_id = $1 ORDER BY messages.created_at`, [user.id]),
    query<FeedbackRow>(`SELECT feedback.thread_id, feedback.response_type, feedback.rating, feedback.benefits, feedback.costs, feedback.note, feedback.created_at
      FROM decision_feedback AS feedback JOIN decision_threads AS threads ON threads.id = feedback.thread_id
      WHERE threads.user_id = $1 ORDER BY feedback.created_at DESC`, [user.id]),
  ]);
  const decisions: Decision[] = threads.rows.map((thread) => {
    const threadMessages: Message[] = messages.rows.filter((message) => message.thread_id === thread.id).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }));
    const lastAssistant = threadMessages.findLastIndex((message) => message.role === "assistant");
    if (lastAssistant >= 0 && thread.decision_json) {
      const result = thread.decision_json;
      threadMessages[lastAssistant] = {
        ...threadMessages[lastAssistant],
        choices: questionNeedsTypedAnswer(threadMessages[lastAssistant].content) ? [] : result.choices,
        decision: result.verdict !== "undecided" && result.score !== null ? {
          score: result.score,
          confidence: result.confidence,
          summary: result.summary,
          cost: result.cost,
          upside: result.upside,
          verdict: result.verdict,
          reasons: result.reasons,
          event: result.event ?? undefined,
        } : undefined,
      };
    }
    return {
      id: thread.id,
      threadId: thread.id,
      createdAt: thread.created_at.toISOString(),
      title: thread.decision_json?.event?.title ?? "Plan discussion",
      messages: threadMessages,
      ...inferContext(thread.prompt),
      batteryBefore: 50,
      markedChoice: thread.marked_going_at ? "going" : thread.marked_skip_at ? "skip" : undefined,
      event: thread.decision_json?.event ?? undefined,
    };
  });
  const outcomes: Outcome[] = feedback.rows.map((item) => ({
    id: `feedback-${item.thread_id}`,
    decisionId: item.thread_id,
    createdAt: item.created_at.toISOString(),
    went: item.response_type === "went",
    enjoyment: item.rating * 2,
    after: 50,
    glad: item.rating >= 3,
    again: item.rating >= 4,
    skipReason: item.note.match(/Skip reason: ([^.]+)/)?.[1],
    skipRelief: item.response_type === "skipped" ? item.rating * 2 : undefined,
    regret: Number(item.note.match(/Regret (\d+)\/10/)?.[1] ?? 0) || undefined,
  }));
  return { profile: designProfile(user.email, stored), checkins: [], decisions, outcomes, readings: [] };
}

export async function GET() {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  return Response.json(await stateForUser(user));
}

export async function DELETE(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const body = await request.json().catch(() => null) as { threadId?: unknown } | null;
  if (typeof body?.threadId !== "string") return Response.json({ error: "A conversation is required." }, { status: 400 });
  const deleted = await query("DELETE FROM decision_threads WHERE id = $1 AND user_id = $2 RETURNING id", [body.threadId, user.id]);
  if (!deleted.rowCount) return Response.json({ error: "Conversation not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; table?: string; data?: unknown } | null;
  if (body?.action === "draw") return Response.json(makeReading(await stateForUser(user)));
  if (body?.table === "outcomes" && body.data && typeof body.data === "object") {
    const outcome = body.data as Outcome;
    const owned = await query("SELECT id FROM decision_threads WHERE id = $1 AND user_id = $2", [outcome.decisionId, user.id]);
    if (owned.rowCount) {
      const benefits = outcome.went
        ? [outcome.glad ? "Glad I went" : "Some benefit", outcome.again ? "Would do it again" : "Would not repeat"].filter(Boolean)
        : [`Skipping felt ${outcome.skipRelief ?? 5}/10 right`];
      const costs = outcome.went
        ? outcome.after < 50 ? ["Lower energy afterward"] : []
        : (outcome.regret ?? 0) > 0 ? [`Regret ${outcome.regret}/10`] : [];
      const note = outcome.went
        ? `Enjoyment ${outcome.enjoyment}/10. Social battery afterward ${outcome.after}/100.`
        : `Skip reason: ${outcome.skipReason ?? "Other"}. Regret ${outcome.regret ?? 0}/10. Social battery afterward ${outcome.after}/100.`;
      const ratingSource = outcome.went ? outcome.enjoyment : outcome.skipRelief ?? 5;
      await query(`INSERT INTO decision_feedback (id, thread_id, response_type, rating, benefits, costs, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (thread_id) DO UPDATE SET response_type = EXCLUDED.response_type, rating = EXCLUDED.rating,
          benefits = EXCLUDED.benefits, costs = EXCLUDED.costs, note = EXCLUDED.note, updated_at = NOW()`,
      [randomUUID(), outcome.decisionId, outcome.went ? "went" : "skipped", Math.max(1, Math.min(5, Math.round(ratingSource / 2))), JSON.stringify(benefits), JSON.stringify(costs), note]);
      await query(
        outcome.went
          ? "UPDATE decision_threads SET marked_going_at = COALESCE(marked_going_at, NOW()), marked_skip_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2"
          : "UPDATE decision_threads SET marked_skip_at = COALESCE(marked_skip_at, NOW()), marked_going_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [outcome.decisionId, user.id],
      );
    }
  }
  return Response.json({ ok: true });
}
