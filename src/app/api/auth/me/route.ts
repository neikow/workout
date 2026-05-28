import { eq } from "drizzle-orm";
import { users } from "@db/schema";
import { getCurrentSession } from "@/lib/server/session";
import { getDb } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cur = await getCurrentSession({ touch: true });
  if (!cur) return Response.json({ user: null });
  const rows = await getDb()
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, cur.userId))
    .limit(1);
  const user = rows[0];
  if (!user) return Response.json({ user: null });
  return Response.json({
    user: { id: user.id, email: user.email },
    sessionId: cur.session.id,
  });
}
