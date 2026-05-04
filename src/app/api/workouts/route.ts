import { z } from "zod";
import { getCurrentSession } from "@/lib/server/session";
import { getDocument, upsertDocument } from "@/lib/server/workouts";
import { isSameOrigin, jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT_BYTES = 1024 * 1024; // 1 MiB

const Body = z.object({
  content: z.string().max(MAX_CONTENT_BYTES),
});

export async function GET() {
  const cur = await getCurrentSession({ touch: true });
  if (!cur) return jsonError(401, "unauthorized");
  const doc = await getDocument(cur.userId);
  return Response.json({
    content: doc?.content ?? "",
    updatedAt: doc?.updatedAt ?? null,
  });
}

export async function PUT(req: Request) {
  if (!(await isSameOrigin())) return jsonError(403, "forbidden");
  const cur = await getCurrentSession({ touch: true });
  if (!cur) return jsonError(401, "unauthorized");
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return jsonError(400, "invalid_body");
  }
  const doc = await upsertDocument(cur.userId, parsed.content);
  return Response.json({ updatedAt: doc.updatedAt });
}
