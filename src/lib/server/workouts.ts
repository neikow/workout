import "server-only";
import { query } from "./db";

export type WorkoutDocument = {
  content: string;
  updatedAt: Date;
};

export async function getDocument(
  userId: string,
): Promise<WorkoutDocument | null> {
  const res = await query<{ content: string; updated_at: Date }>(
    "SELECT content, updated_at FROM workout_documents WHERE user_id = $1",
    [userId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return { content: row.content, updatedAt: row.updated_at };
}

export async function upsertDocument(
  userId: string,
  content: string,
): Promise<WorkoutDocument> {
  const res = await query<{ updated_at: Date }>(
    `INSERT INTO workout_documents(user_id, content, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE
       SET content = EXCLUDED.content, updated_at = now()
     RETURNING updated_at`,
    [userId, content],
  );
  return { content, updatedAt: res.rows[0].updated_at };
}
