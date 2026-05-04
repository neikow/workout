import { getCurrentSession } from "@/lib/server/session";
import { getDocument } from "@/lib/server/workouts";
import { jsonError } from "@/lib/server/http";

// Legacy read endpoint. Pre-CRDT this served as the canonical doc store; the
// editor now syncs through the y-websocket sidecar instead. Kept alive only
// so newly-authenticated clients can pull a one-time HTML seed from the
// `workout_documents` table when their Y doc is empty. Once every active
// account has a `workout_doc_snapshots` row, this route and the underlying
// table can be dropped together.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cur = await getCurrentSession({ touch: true });
  if (!cur) return jsonError(401, "unauthorized");
  const doc = await getDocument(cur.userId);
  return Response.json({
    content: doc?.content ?? "",
    updatedAt: doc?.updatedAt ?? null,
  });
}
