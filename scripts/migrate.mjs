import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import pg from "pg";

const envFile = existsSync(".env.local") ? ".env.local" : ".env";
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add it to .env.local or the active environment.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const sql = await readFile(resolve("db/migrations/001_auth_and_decisions.sql"), "utf8");
  await client.query(sql);
  console.log("Applied db/migrations/001_auth_and_decisions.sql");
} finally {
  await client.end();
}
