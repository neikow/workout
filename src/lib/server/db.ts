import "server-only";
import { createDbClient, type DbClient } from "@db/client";

declare global {
  var __workoutDb: DbClient | undefined;
}

let cached: DbClient | null = null;

export function getDb(): DbClient {
  if (cached) return cached;
  if (global.__workoutDb) {
    cached = global.__workoutDb;
    return cached;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  cached = createDbClient({ url }).db;
  if (process.env.NODE_ENV !== "production") {
    global.__workoutDb = cached;
  }
  return cached;
}
