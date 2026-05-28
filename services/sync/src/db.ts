import { createDbClient, type DbClient } from "../../../db/client.js";

let cached: { db: DbClient } | null = null;

export function getDb(): DbClient {
  if (cached) return cached.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  cached = createDbClient({ url });
  return cached.db;
}
