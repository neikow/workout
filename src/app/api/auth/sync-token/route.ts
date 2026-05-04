import { getCurrentSession } from "@/lib/server/session";
import { mintSyncToken } from "@/lib/server/sync-token";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cur = await getCurrentSession({ touch: true });
  if (!cur) return jsonError(401, "unauthorized");
  const { token, expiresAt } = mintSyncToken(cur.userId);
  return Response.json({
    token,
    userId: cur.userId,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}
