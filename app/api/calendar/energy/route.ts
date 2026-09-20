import { currentUser } from "../../../../lib/auth";
import { databaseConfigured, query } from "../../../../lib/db";
import { eventDurationMinutes, type Decision } from "../../../../lib/model";
import { nvidiaConfigured, nvidiaEndpoint, nvidiaHeaders, nvidiaModel } from "../../../../lib/nvidia";
import { profileForUser } from "../../../../lib/profile";

export const runtime = "nodejs";

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "calendar_energy_estimate",
    strict: true,
    schema: {
      type: "object",
      properties: {
        energyLoad: { type: "integer", minimum: 0, maximum: 40 },
        explanation: { type: "string" },
      },
      required: ["energyLoad", "explanation"],
      additionalProperties: false,
    },
  },
} as const;

type CheckinRow = { social: number; physical: number; mood: string; stress: number };
type HistoryRow = {
  energy_before: number | null;
  energy_after: number | null;
  context_group: Decision["group"] | null;
  context_people: Decision["people"] | null;
};

function parseEstimate(content: string) {
  const value = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as Record<string, unknown>;
  if (!Number.isInteger(value.energyLoad)) throw new Error("Invalid energy estimate");
  const energyLoad = Math.max(0, Math.min(40, Number(value.energyLoad)));
  const explanation = typeof value.explanation === "string"
    ? value.explanation.trim().replace(/\s+/g, " ").slice(0, 240)
    : "Personalized from this plan and your social profile.";
  return { energyLoad, explanation };
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!nvidiaConfigured()) return Response.json({ error: "AI energy estimates are not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as { decision?: unknown } | null;
  const decision = body?.decision as Decision | undefined;
  const duration = decision ? eventDurationMinutes(decision.event) : null;
  if (
    !decision?.event?.title?.trim() ||
    !decision.event.startAt ||
    !decision.event.endAt ||
    duration === null ||
    !["solo", "small", "large"].includes(decision.group) ||
    !["alone", "friends", "strangers"].includes(decision.people)
  ) return Response.json({ error: "A complete calendar plan is required." }, { status: 400 });

  const [profile, checkin, history] = await Promise.all([
    profileForUser(user.id),
    query<CheckinRow>("SELECT social, physical, mood, stress FROM user_checkins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [user.id]),
    query<HistoryRow>(`SELECT threads.energy_before, feedback.energy_after, threads.context_group, threads.context_people
      FROM decision_feedback AS feedback
      JOIN decision_threads AS threads ON threads.id = feedback.thread_id
      WHERE threads.user_id = $1 AND feedback.energy_after IS NOT NULL
      ORDER BY feedback.created_at DESC LIMIT 20`, [user.id]),
  ]);

  const historicalSamples = history.rows
    .filter((row) => row.energy_before !== null && row.energy_after !== null)
    .map((row) => ({
      group: row.context_group,
      people: row.context_people,
      observedEnergyChange: row.energy_after! - row.energy_before!,
    }));
  const prompt = `Estimate how much energy this confirmed calendar plan will consume for this specific user.
Return an integer energyLoad from 0 to 40, where 0 is essentially restorative/no drain, 8 is a modest drain, 20 is substantial, and 40 is exceptionally draining. Do not simply assign a fixed amount per event. Weigh duration, time of day, activity description, travel/location clues, group size, familiarity, current check-in, profile preferences, and relevant observed history. Positive or restorative activities may have a very low load, but energyLoad cannot be negative. Provide one concise explanation that names the most important personalized factors. Do not diagnose personality.

PLAN: ${JSON.stringify({
    title: decision.event.title,
    description: decision.event.description,
    location: decision.event.location,
    startAt: decision.event.startAt,
    endAt: decision.event.endAt,
    durationMinutes: duration,
    group: decision.group,
    people: decision.people,
  })}
CURRENT CHECK-IN: ${JSON.stringify(checkin.rows[0] ?? null)}
USER PREFERENCES (0 to 1): ${JSON.stringify(profile?.profile ?? null)}
OBSERVED ENERGY HISTORY: ${JSON.stringify(historicalSamples)}`;

  try {
    const response = await fetch(nvidiaEndpoint, {
      method: "POST",
      headers: nvidiaHeaders(),
      body: JSON.stringify({
        model: nvidiaModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        top_k: 1,
        max_tokens: 350,
        chat_template_kwargs: { enable_thinking: false },
        response_format: responseFormat,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("Energy model request failed");
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Energy model returned no result");
    return Response.json(parseEstimate(content));
  } catch (error) {
    console.error("Calendar energy estimate failed", error);
    return Response.json({ error: "Could not analyze this plan's energy right now." }, { status: 502 });
  }
}
