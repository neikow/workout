import { z } from "zod";
import { issueOtp } from "@/lib/server/otp";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, isSameOrigin, jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  if (!(await isSameOrigin())) return jsonError(403, "forbidden");

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return jsonError(400, "invalid_body");
  }
  const email = parsed.email.trim().toLowerCase();
  const ip = await clientIp();

  const ipLimit = rateLimit(`otp:ip:${ip}`, 20, 60 * 60 * 1000);
  if (!ipLimit.ok) return jsonError(429, "rate_limited");
  const emailLimit = rateLimit(`otp:email:${email}`, 5, 60 * 60 * 1000);
  if (!emailLimit.ok) return jsonError(429, "rate_limited");

  // Always return ok to avoid email enumeration.
  await issueOtp(email).catch((e) => {
    console.error("[otp] issue failed", e);
  });
  return Response.json({ ok: true });
}
