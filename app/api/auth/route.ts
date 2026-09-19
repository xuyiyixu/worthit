import { randomUUID } from "node:crypto";
import { clearSession, createSession, currentUser, hashPassword, verifyPassword } from "../../../lib/auth";
import { databaseConfigured, query } from "../../../lib/db";

type UserRow = { id: string; email: string; password_hash: string };

function credentials(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const mode = body.mode === "register" ? "register" : "login";
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128) return null;
  return { email, password, mode };
}

export async function GET() {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured.", code: "NOT_CONFIGURED" }, { status: 503 });
  try {
    const user = await currentUser();
    return user ? Response.json({ user }) : Response.json({ error: "Not signed in." }, { status: 401 });
  } catch {
    return Response.json({ error: "The database is unavailable.", code: "DATABASE_ERROR" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured.", code: "NOT_CONFIGURED" }, { status: 503 });
  const input = credentials(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "Enter a valid email and a password of at least 8 characters." }, { status: 400 });

  try {
    const existing = await query<UserRow>("SELECT id, email, password_hash FROM users WHERE email = $1", [input.email]);
    let user = existing.rows[0];
    if (input.mode === "register") {
      if (user) return Response.json({ error: "An account already exists for this email." }, { status: 409 });
      const id = randomUUID();
      const passwordHash = await hashPassword(input.password);
      const created = await query<UserRow>("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, password_hash", [id, input.email, passwordHash]);
      user = created.rows[0];
    } else if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    await createSession(user.id);
    return Response.json({ user: { id: user.id, email: user.email } });
  } catch {
    return Response.json({ error: "The database is unavailable. Check DATABASE_URL and run the migration.", code: "DATABASE_ERROR" }, { status: 503 });
  }
}

export async function DELETE() {
  if (databaseConfigured()) await clearSession().catch(() => undefined);
  return Response.json({ ok: true });
}
