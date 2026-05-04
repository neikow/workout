import {
  clearSessionCookie,
  getCurrentSession,
  revokeSession,
} from "@/lib/server/session";
import { isSameOrigin, jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isSameOrigin())) return jsonError(403, "forbidden");
  const cur = await getCurrentSession();
  if (!cur) return jsonError(401, "unauthorized");
  const { id } = await ctx.params;
  const ok = await revokeSession(id, cur.userId);
  if (!ok) return jsonError(404, "not_found");
  if (id === cur.session.id) {
    await clearSessionCookie();
  }
  return Response.json({ ok: true });
}
