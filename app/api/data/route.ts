import { randomUUID } from "node:crypto";
import { currentUser } from "../../../lib/auth";
import { databaseConfigured, query } from "../../../lib/db";
import { emptyState, eventDurationMinutes, inferContext, localDay, type AppState, type Checkin, type Decision, type Message, type Outcome, type Profile, type Reading } from "../../../lib/model";
import { questionNeedsTypedAnswer, type DecisionReply } from "../../../lib/decision-chat";
import { profileForUser, type StoredProfile } from "../../../lib/profile";
import { makeReading } from "../../../lib/tarot";

type StoredDecision = DecisionReply & { energyLoad?: number; energyExplanation?: string };
type ThreadRow = { id: string; created_at: Date; prompt: string; decision_json: StoredDecision | null; marked_going_at: Date | null; marked_skip_at: Date | null; energy_before: number | null; context_group: Decision["group"] | null; context_people: Decision["people"] | null };
type MessageRow = { id: string; thread_id: string; role: "user" | "assistant"; content: string; created_at: Date };
type CheckinRow = { id: string; social: number; physical: number; mood: string; stress: number; created_at: Date };
type ReadingRow = { id: string; reading_date: string; cards: number[]; energy: number; reading: string; guidance: string };
type FeedbackRow = {
  thread_id: string;
  response_type: "went" | "skipped";
  rating: number;
  benefits: string[];
  costs: string[];
  note: string;
  created_at: Date;
  energy_after: number | null;
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
  const [stored, threads, messages, feedback, checkins, readings] = await Promise.all([
    profileForUser(user.id),
    query<ThreadRow>(`SELECT threads.id, threads.created_at, threads.decision_json, threads.marked_going_at, threads.marked_skip_at, threads.energy_before, threads.context_group, threads.context_people,
      COALESCE((SELECT content FROM decision_messages WHERE thread_id = threads.id AND role = 'user' ORDER BY created_at LIMIT 1), 'New decision') AS prompt
      FROM decision_threads AS threads WHERE threads.user_id = $1 ORDER BY threads.updated_at DESC LIMIT 40`, [user.id]),
    query<MessageRow>(`SELECT messages.id, messages.thread_id, messages.role, messages.content, messages.created_at
      FROM decision_messages AS messages JOIN decision_threads AS threads ON threads.id = messages.thread_id
      WHERE threads.user_id = $1 ORDER BY messages.created_at`, [user.id]),
    query<FeedbackRow>(`SELECT feedback.thread_id, feedback.response_type, feedback.rating, feedback.benefits, feedback.costs, feedback.note, feedback.created_at, feedback.energy_after
      FROM decision_feedback AS feedback JOIN decision_threads AS threads ON threads.id = feedback.thread_id
      WHERE threads.user_id = $1 ORDER BY feedback.created_at DESC`, [user.id]),
    query<CheckinRow>(`SELECT id, social, physical, mood, stress, created_at
      FROM user_checkins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 90`, [user.id]),
    query<ReadingRow>(`SELECT id, reading_date::text, cards, energy, reading, guidance
      FROM tarot_readings WHERE user_id = $1 ORDER BY reading_date DESC LIMIT 90`, [user.id]),
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
    const inferred = inferContext(thread.prompt);
    const event = thread.decision_json?.event ?? undefined;
    return {
      id: thread.id,
      threadId: thread.id,
      createdAt: thread.created_at.toISOString(),
      title: thread.decision_json?.event?.title ?? "Plan discussion",
      messages: threadMessages,
      ...inferred,
      group: thread.context_group ?? inferred.group,
      people: thread.context_people ?? inferred.people,
      duration: eventDurationMinutes(event) ?? 0,
      batteryBefore: thread.energy_before ?? 50,
      energyRecorded: thread.energy_before !== null,
      estimatedEnergyLoad: thread.decision_json?.energyLoad,
      energyExplanation: thread.decision_json?.energyExplanation,
      markedChoice: thread.marked_going_at ? "going" : thread.marked_skip_at ? "skip" : undefined,
      event,
    };
  });
  const outcomes: Outcome[] = feedback.rows.map((item) => ({
    id: `feedback-${item.thread_id}`,
    decisionId: item.thread_id,
    createdAt: item.created_at.toISOString(),
    went: item.response_type === "went",
    enjoyment: item.rating * 2,
    after: item.energy_after ?? Number(item.note.match(/(?:Social battery|Energy) afterward (\d+)\/100/i)?.[1] ?? 50),
    glad: item.rating >= 3,
    again: item.rating >= 4,
    skipReason: item.note.match(/Skip reason: ([^.]+)/)?.[1],
    skipRelief: item.response_type === "skipped" ? item.rating * 2 : undefined,
    regret: Number(item.note.match(/Regret (\d+)\/10/)?.[1] ?? 0) || undefined,
    energyRecorded: item.energy_after !== null,
  }));
  const savedCheckins: Checkin[] = checkins.rows.map((item) => ({
    id: item.id,
    createdAt: item.created_at.toISOString(),
    social: item.social,
    physical: item.physical,
    mood: item.mood,
    stress: item.stress,
  }));
  const savedReadings: Reading[] = readings.rows.map((item) => ({
    id: item.id,
    date: item.reading_date,
    cards: item.cards,
    energy: item.energy,
    reading: item.reading,
    guidance: item.guidance,
  }));
  return { profile: designProfile(user.email, stored), checkins: savedCheckins, decisions, outcomes, readings: savedReadings };
}

async function drawForUser(user: { id: string; email: string }) {
  const state = await stateForUser(user);
  const date = localDay(new Date(), state.profile.timezone);
  const existing = state.readings.find((reading) => reading.date === date);
  if (existing) return existing;

  const reading = makeReading(state, date);
  const inserted = await query<ReadingRow>(`INSERT INTO tarot_readings
    (id, user_id, reading_date, cards, energy, reading, guidance)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id, reading_date) DO NOTHING
    RETURNING id, reading_date::text, cards, energy, reading, guidance`,
  [reading.id, user.id, reading.date, reading.cards, reading.energy, reading.reading, reading.guidance]);
  const saved = inserted.rows[0] ?? (await query<ReadingRow>(`SELECT id, reading_date::text, cards, energy, reading, guidance
    FROM tarot_readings WHERE user_id = $1 AND reading_date = $2`, [user.id, date])).rows[0];
  if (!saved) throw new Error("Could not save today's reading.");
  return {
    id: saved.id,
    date: saved.reading_date,
    cards: saved.cards,
    energy: saved.energy,
    reading: saved.reading,
    guidance: saved.guidance,
  } satisfies Reading;
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
  if (body?.action === "draw") return Response.json(await drawForUser(user));
  if (body?.table === "calendar" && body.data && typeof body.data === "object") {
    const decision = body.data as Decision;
    const event = decision.event;
    const start = event?.startAt ? Date.parse(event.startAt) : Number.NaN;
    const end = event?.endAt ? Date.parse(event.endAt) : Number.NaN;
    const validGroup = decision.group === "small" || decision.group === "large" || decision.group === "solo";
    const validPeople = decision.people === "friends" || decision.people === "strangers" || decision.people === "alone";
    if (
      typeof decision.id !== "string" ||
      !event ||
      typeof event.title !== "string" ||
      !event.title.trim() ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      !validGroup ||
      !validPeople
    ) {
      return Response.json({ error: "A title, valid start/end time, group size, and people are required." }, { status: 400 });
    }
    const energyBefore = decision.energyRecorded && Number.isInteger(decision.batteryBefore) && decision.batteryBefore >= 0 && decision.batteryBefore <= 100
      ? decision.batteryBefore
      : null;
    const energyLoad = Number.isInteger(decision.estimatedEnergyLoad) && decision.estimatedEnergyLoad! >= 0 && decision.estimatedEnergyLoad! <= 40
      ? decision.estimatedEnergyLoad
      : null;
    const energyExplanation = decision.energyExplanation?.trim().slice(0, 240) || null;
    const storedEvent = {
      title: event.title.trim().slice(0, 80),
      description: event.description?.trim().slice(0, 360) || "Manually added calendar plan.",
      whenText: event.whenText?.trim().slice(0, 120) || null,
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
      location: event.location?.trim().slice(0, 120) || null,
    };
    const decisionJson: StoredDecision = {
      reply: "Manually added calendar plan.",
      score: null,
      confidence: "low",
      summary: "",
      cost: [],
      upside: [],
      verdict: "undecided",
      reasons: [],
      choices: [],
      event: storedEvent,
      ...(energyLoad !== null ? { energyLoad } : {}),
      ...(energyExplanation ? { energyExplanation } : {}),
    };
    const patch = {
      event: storedEvent,
      ...(energyLoad !== null ? { energyLoad } : {}),
      ...(energyExplanation ? { energyExplanation } : {}),
    };
    const saved = await query(`INSERT INTO decision_threads
      (id, user_id, verdict, decision_json, marked_going_at, energy_before, context_group, context_people)
      VALUES ($1, $2, 'undecided', $3, NOW(), $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        decision_json = COALESCE(decision_threads.decision_json, '{}'::jsonb) || $7::jsonb,
        energy_before = COALESCE(decision_threads.energy_before, EXCLUDED.energy_before),
        context_group = EXCLUDED.context_group,
        context_people = EXCLUDED.context_people,
        updated_at = NOW()
      WHERE decision_threads.user_id = EXCLUDED.user_id
      RETURNING id`,
    [decision.id, user.id, JSON.stringify(decisionJson), energyBefore, decision.group, decision.people, JSON.stringify(patch)]);
    if (!saved.rowCount) return Response.json({ error: "Calendar plan not found." }, { status: 404 });
    return Response.json({ ok: true });
  }
  if (body?.table === "checkins" && body.data && typeof body.data === "object") {
    const checkin = body.data as Checkin;
    const validNumber = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
    if (
      typeof checkin.id !== "string" ||
      typeof checkin.createdAt !== "string" ||
      !Number.isFinite(Date.parse(checkin.createdAt)) ||
      typeof checkin.mood !== "string" ||
      !validNumber(checkin.social) ||
      !validNumber(checkin.physical) ||
      !validNumber(checkin.stress)
    ) {
      return Response.json({ error: "A valid check-in is required." }, { status: 400 });
    }
    await query(`INSERT INTO user_checkins (id, user_id, social, physical, mood, stress, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING`,
    [checkin.id, user.id, checkin.social, checkin.physical, checkin.mood.slice(0, 40), checkin.stress, checkin.createdAt]);
  }
  if (body?.table === "decisions" && body.data && typeof body.data === "object") {
    const decision = body.data as Decision;
    const validGroup = decision.group === "small" || decision.group === "large" || decision.group === "solo";
    const validPeople = decision.people === "friends" || decision.people === "strangers" || decision.people === "alone";
    if (typeof decision.threadId === "string" && validGroup && validPeople) {
      const energyBefore = decision.energyRecorded && Number.isInteger(decision.batteryBefore) && decision.batteryBefore >= 0 && decision.batteryBefore <= 100
        ? decision.batteryBefore
        : null;
      const energyLoad = Number.isInteger(decision.estimatedEnergyLoad) && decision.estimatedEnergyLoad! >= 0 && decision.estimatedEnergyLoad! <= 40
        ? decision.estimatedEnergyLoad
        : null;
      const energyExplanation = decision.energyExplanation?.trim().slice(0, 240) || null;
      const energyPatch = energyLoad === null ? {} : {
        energyLoad,
        ...(energyExplanation ? { energyExplanation } : {}),
      };
      await query(
        `UPDATE decision_threads SET energy_before = COALESCE(energy_before, $1),
          context_group = $2, context_people = $3,
          decision_json = COALESCE(decision_json, '{}'::jsonb) || $6::jsonb,
          updated_at = NOW() WHERE id = $4 AND user_id = $5`,
        [energyBefore, decision.group, decision.people, decision.threadId, user.id, JSON.stringify(energyPatch)],
      );
    }
  }
  if (body?.table === "outcomes" && body.data && typeof body.data === "object") {
    const outcome = body.data as Outcome;
    if (!Number.isFinite(outcome.after) || outcome.after < 0 || outcome.after > 100) {
      return Response.json({ error: "Energy afterward must be between 0 and 100." }, { status: 400 });
    }
    const owned = await query("SELECT id FROM decision_threads WHERE id = $1 AND user_id = $2", [outcome.decisionId, user.id]);
    if (owned.rowCount) {
      const benefits = outcome.went
        ? [outcome.glad ? "Glad I went" : "Some benefit", outcome.again ? "Would do it again" : "Would not repeat"].filter(Boolean)
        : [`Skipping felt ${outcome.skipRelief ?? 5}/10 right`];
      const costs = outcome.went
        ? outcome.after < 50 ? ["Lower energy afterward"] : []
        : (outcome.regret ?? 0) > 0 ? [`Regret ${outcome.regret}/10`] : [];
      const note = outcome.went
        ? `Enjoyment ${outcome.enjoyment}/10. Energy afterward ${outcome.after}/100.`
        : `Skip reason: ${outcome.skipReason ?? "Other"}. Regret ${outcome.regret ?? 0}/10. Energy afterward ${outcome.after}/100.`;
      const ratingSource = outcome.went ? outcome.enjoyment : outcome.skipRelief ?? 5;
      await query(`INSERT INTO decision_feedback (id, thread_id, response_type, rating, benefits, costs, note, energy_after)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (thread_id) DO UPDATE SET response_type = EXCLUDED.response_type, rating = EXCLUDED.rating,
          benefits = EXCLUDED.benefits, costs = EXCLUDED.costs, note = EXCLUDED.note,
          energy_after = EXCLUDED.energy_after, updated_at = NOW()`,
      [randomUUID(), outcome.decisionId, outcome.went ? "went" : "skipped", Math.max(1, Math.min(5, Math.round(ratingSource / 2))), JSON.stringify(benefits), JSON.stringify(costs), note, Math.max(0, Math.min(100, Math.round(outcome.after)))]);
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
