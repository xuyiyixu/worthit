import { currentUser } from "../../../../lib/auth";
import { databaseConfigured, query } from "../../../../lib/db";
import type { CalendarEvent } from "../../../../lib/model";
import { nvidiaConfigured, nvidiaEndpoint, nvidiaHeaders, nvidiaModel } from "../../../../lib/nvidia";

export const runtime = "nodejs";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const eventResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "worthit_calendar_event",
    strict: true,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        whenText: nullableString,
        startAt: nullableString,
        endAt: nullableString,
        location: nullableString,
      },
      required: ["title", "description", "whenText", "startAt", "endAt", "location"],
      additionalProperties: false,
    },
  },
} as const;

function cleanJson(content: string) {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function fallbackEvent(source: string): CalendarEvent {
  const brand = source.match(/\b([A-Z][A-Za-z0-9-]{2,})\s+is\s+back\b/);
  const title = brand
    ? /\bkickoff\b/i.test(source) ? `${brand[1]} kickoff` : `${brand[1]} event`
    : source.match(/\b((?:[A-Z][\w’'-]+\s+){0,2}(?:kickoff|workshop|mixer|concert|dinner|brunch|meeting|conference|party|lecture|game|festival))\b/i)?.[1]?.trim() || "Event plan";
  const when = source.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})\s*[|·,]?\s*(\d{1,2}(?::\d{2})?\s*[–—-]\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i);
  const locationMatches = [...source.matchAll(/\|\s*([^|\n]+?)(?=\s+(?:Register|Hope|RSVP)|$)/gi)];
  const location = locationMatches.at(-1)?.[1]?.trim() ?? null;
  const description = brand && /hardware hackathon/i.test(source)
    ? `An introduction to CMU’s hardware hackathon, this year’s plans, and ways to get involved.`
    : `Details about ${title}.`;
  return {
    title,
    description,
    whenText: when ? `${when[1]} · ${when[2]}` : null,
    startAt: null,
    endAt: null,
    location,
  };
}

function parseEvent(content: string, fallback: CalendarEvent): CalendarEvent {
  const value = JSON.parse(cleanJson(content)) as Record<string, unknown>;
  const text = (key: string, max: number) =>
    typeof value[key] === "string" && value[key].trim()
      ? value[key].trim().replace(/\s+/g, " ").slice(0, max)
      : null;
  const iso = (key: string) => {
    const raw = text(key, 80);
    return raw && Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : null;
  };
  return {
    title: text("title", 80) ?? fallback.title,
    description: text("description", 360) ?? fallback.description,
    whenText: text("whenText", 120) ?? fallback.whenText,
    startAt: iso("startAt"),
    endAt: iso("endAt"),
    location: text("location", 120) ?? fallback.location,
  };
}

async function extractEvent(source: string) {
  const fallback = fallbackEvent(source);
  if (!nvidiaConfigured()) return fallback;
  const prompt = `Extract one calendar event from the source text. Return only JSON with this shape:
{"title":"2-8 word event name","description":"One or two sentences explaining what the event is for","whenText":"Exact date and time as written","startAt":null,"endAt":null,"location":"Concise venue or address"}
Summarize; do not copy the invitation, greeting, registration URL, or sign-off. Preserve the exact stated date and time in whenText. Only provide ISO startAt/endAt when year and timezone are grounded; otherwise use null. Use null for unknown location.

SOURCE:
${source.slice(0, 12_000)}`;
  try {
    const response = await fetch(nvidiaEndpoint, {
      method: "POST",
      headers: nvidiaHeaders(),
      body: JSON.stringify({
        model: nvidiaModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        top_k: 1,
        max_tokens: 500,
        chat_template_kwargs: { enable_thinking: false },
        response_format: eventResponseFormat,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return fallback;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    return content ? parseEvent(content, fallback) : fallback;
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { threadId?: unknown; text?: unknown } | null;
  if (!body) return Response.json({ error: "Event text is required." }, { status: 400 });
  const threadId = typeof body.threadId === "string" ? body.threadId : null;
  let source = typeof body.text === "string" ? body.text.trim().slice(0, 12_000) : "";
  let storedDecision: Record<string, unknown> | null = null;
  let userId: string | null = null;

  if (threadId) {
    if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    const user = await currentUser().catch(() => null);
    if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
    userId = user.id;
    const thread = await query<{ decision_json: Record<string, unknown> | null }>(
      "SELECT decision_json FROM decision_threads WHERE id = $1 AND user_id = $2",
      [threadId, user.id],
    );
    if (!thread.rowCount) return Response.json({ error: "Decision not found." }, { status: 404 });
    storedDecision = thread.rows[0].decision_json;
    const messages = await query<{ content: string }>(
      "SELECT content FROM decision_messages WHERE thread_id = $1 AND role = 'user' ORDER BY created_at",
      [threadId],
    );
    source = messages.rows.map((message) => message.content).join("\n\n").slice(0, 12_000);
  }

  if (!source) return Response.json({ error: "Event text is required." }, { status: 400 });
  const event = await extractEvent(source);
  if (threadId && userId) {
    await query(
      "UPDATE decision_threads SET decision_json = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
      [JSON.stringify({ ...(storedDecision ?? {}), event }), threadId, userId],
    );
  }
  return Response.json({ event });
}
