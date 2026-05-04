import "server-only";
import { Pool } from "pg";

declare global {
  var __workoutPgPool: Pool | undefined;
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  if (global.__workoutPgPool) {
    pool = global.__workoutPgPool;
    return pool;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  pool = new Pool({ connectionString: url, max: 10 });
  if (process.env.NODE_ENV !== "production") {
    global.__workoutPgPool = pool;
  }
  return pool;
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const res = await getPool().query(text, params as never);
  return { rows: res.rows as T[], rowCount: res.rowCount };
}
