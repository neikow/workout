import { getCurrentSession } from "@/lib/server/session";
import { query } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cur = await getCurrentSession({ touch: true });
  if (!cur) return Response.json({ user: null });
  const res = await query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE id = $1",
    [cur.userId],
  );
  const user = res.rows[0];
  if (!user) return Response.json({ user: null });
  return Response.json({
    user: { id: user.id, email: user.email },
    sessionId: cur.session.id,
  });
}
