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
