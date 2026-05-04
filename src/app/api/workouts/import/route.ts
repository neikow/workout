import { z } from "zod";
import { getCurrentSession } from "@/lib/server/session";
import { getDocument, upsertDocument } from "@/lib/server/workouts";
import { isSameOrigin, jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT_BYTES = 1024 * 1024;

const Body = z.object({
  content: z.string().max(MAX_CONTENT_BYTES),
  // "replace" overwrites server doc; "merge" prepends local before server.
  strategy: z.enum(["replace", "merge"]).default("merge"),
});

export async function POST(req: Request) {
  if (!(await isSameOrigin())) return jsonError(403, "forbidden");
  const cur = await getCurrentSession({ touch: true });
  if (!cur) return jsonError(401, "unauthorized");

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return jsonError(400, "invalid_body");
  }

  let nextContent = parsed.content;
  if (parsed.strategy === "merge") {
    const existing = await getDocument(cur.userId);
    if (existing && existing.content.trim()) {
      // Local first (most recent) — remote appended after a paragraph break.
      nextContent = `${parsed.content}\n${existing.content}`;
    }
  }

  const doc = await upsertDocument(cur.userId, nextContent);
  return Response.json({ updatedAt: doc.updatedAt, strategy: parsed.strategy });
}
