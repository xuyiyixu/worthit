import { randomUUID } from "node:crypto";
import { currentUser } from "../../../../lib/auth";
import { databaseConfigured, query } from "../../../../lib/db";

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map(item => item.slice(0, 80)).slice(0, 8) : [];
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.threadId !== "string" || (body.responseType !== "went" && body.responseType !== "skipped") || typeof body.rating !== "number" || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    return Response.json({ error: "A decision and a 1–5 rating are required." }, { status: 400 });
  }
  const owned = await query("SELECT id FROM decision_threads WHERE id = $1 AND user_id = $2", [body.threadId, user.id]);
  if (!owned.rowCount) return Response.json({ error: "Decision not found." }, { status: 404 });
  await query(`INSERT INTO decision_feedback (id, thread_id, response_type, rating, benefits, costs, note)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (thread_id) DO UPDATE SET response_type = EXCLUDED.response_type, rating = EXCLUDED.rating,
      benefits = EXCLUDED.benefits, costs = EXCLUDED.costs, note = EXCLUDED.note, updated_at = NOW()`,
  [randomUUID(), body.threadId, body.responseType, body.rating, JSON.stringify(stringList(body.benefits)), JSON.stringify(stringList(body.costs)), typeof body.note === "string" ? body.note.trim().slice(0, 1200) : ""]);
  return Response.json({ ok: true });
}
