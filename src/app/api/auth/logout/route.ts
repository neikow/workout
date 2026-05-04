import {
  clearSessionCookie,
  getCurrentSession,
  revokeSession,
} from "@/lib/server/session";
import { isSameOrigin, jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isSameOrigin())) return jsonError(403, "forbidden");
  const cur = await getCurrentSession();
  if (cur) {
    await revokeSession(cur.session.id, cur.userId);
  }
  await clearSessionCookie();
  return Response.json({ ok: true });
}
