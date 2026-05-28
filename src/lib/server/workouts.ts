import "server-only";
import { eq } from "drizzle-orm";
import { workoutDocuments } from "@db/schema";
import { getDb } from "./db";

export type WorkoutDocument = {
  content: string;
  updatedAt: Date;
};

export async function getDocument(
  userId: string,
): Promise<WorkoutDocument | null> {
  const rows = await getDb()
    .select({
      content: workoutDocuments.content,
      updatedAt: workoutDocuments.updatedAt,
    })
    .from(workoutDocuments)
    .where(eq(workoutDocuments.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}
