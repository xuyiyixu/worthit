import { currentUser } from "../../../../lib/auth";
import { databaseConfigured, query } from "../../../../lib/db";

export async function POST(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const body = await request.json().catch(() => null) as { threadId?: unknown; choice?: unknown } | null;
  if (!body || typeof body.threadId !== "string" || (body.choice !== "going" && body.choice !== "skip")) return Response.json({ error: "Decision and choice are required." }, { status: 400 });
  const result = body.choice === "going"
    ? await query("UPDATE decision_threads SET marked_going_at = NOW(), marked_skip_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id", [body.threadId, user.id])
    : await query("UPDATE decision_threads SET marked_skip_at = NOW(), marked_going_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id", [body.threadId, user.id]);
  return result.rowCount ? Response.json({ ok: true }) : Response.json({ error: "Decision not found." }, { status: 404 });
}
