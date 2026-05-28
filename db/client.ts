import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

export function createDbClient(opts: { url: string } & PoolConfig) {
  const { url, ...rest } = opts;
  const pool = new Pool({ connectionString: url, max: 10, ...rest });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

export type DbClient = ReturnType<typeof createDbClient>["db"];
