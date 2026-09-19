import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
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
  const directory = resolve("db/migrations");
  const migrations = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  for (const migration of migrations) {
    await client.query(await readFile(resolve(directory, migration), "utf8"));
    console.log(`Applied db/migrations/${migration}`);
  }
} finally {
  await client.end();
}
