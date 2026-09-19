import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as typeof globalThis & { worthItPool?: Pool };

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!globalForDb.worthItPool) {
    globalForDb.worthItPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 20_000
    });
  }
  return globalForDb.worthItPool;
}

export async function query<Row extends QueryResultRow>(text: string, values: unknown[] = []) {
  return db().query<Row>(text, values);
}
