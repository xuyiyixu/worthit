import { currentUser } from "../../../lib/auth";
import { databaseConfigured, query } from "../../../lib/db";
import { inferProfile, questions } from "../../../lib/questions";

function validAnswers(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === questions.length && value.every((answer, index) => Number.isInteger(answer) && answer >= 0 && answer < questions[index].options.length);
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const body = await request.json().catch(() => null) as { answers?: unknown } | null;
  if (!validAnswers(body?.answers)) return Response.json({ error: "Complete every question before continuing." }, { status: 400 });
  const profile = inferProfile(body.answers);
  await query(`INSERT INTO user_profiles (user_id, answers, profile_json)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET answers = EXCLUDED.answers, profile_json = EXCLUDED.profile_json, updated_at = NOW()`, [user.id, JSON.stringify(body.answers), JSON.stringify(profile)]);
  return Response.json({ profile });
}
