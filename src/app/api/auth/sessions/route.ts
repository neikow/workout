import { getCurrentSession, listUserSessions } from "@/lib/server/session";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cur = await getCurrentSession();
  if (!cur) return jsonError(401, "unauthorized");
  const sessions = await listUserSessions(cur.userId);
  return Response.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      deviceName: s.device_name,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      expiresAt: s.expires_at,
      current: s.id === cur.session.id,
    })),
  });
}
