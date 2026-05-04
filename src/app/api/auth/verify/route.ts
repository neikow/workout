import { z } from "zod";
import { headers } from "next/headers";
import { verifyOtp } from "@/lib/server/otp";
import { createSession, setSessionCookie } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, isSameOrigin, jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  if (!(await isSameOrigin())) return jsonError(403, "forbidden");

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return jsonError(400, "invalid_body");
  }

  const ip = await clientIp();
  const limit = rateLimit(`verify:ip:${ip}`, 30, 60 * 60 * 1000);
  if (!limit.ok) return jsonError(429, "rate_limited");

  const result = await verifyOtp(parsed.email, parsed.code);
  if (!result.ok) {
    return jsonError(result.reason === "expired" ? 410 : 401, result.reason);
  }

  const h = await headers();
  const ua = h.get("user-agent") ?? null;
  const deviceName = ua ? ua.slice(0, 200) : null;

  const { token, sessionId, expiresAt } = await createSession(
    result.userId,
    deviceName,
  );
  await setSessionCookie(token, expiresAt);
  return Response.json({ ok: true, sessionId });
}
