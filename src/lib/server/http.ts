import "server-only";
import { headers } from "next/headers";

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Prefer X-Real-IP: our nginx sets it from $remote_addr after the real_ip
  // module resolves the trusted-proxy chain, so it can't be spoofed by the
  // client. X-Forwarded-For's leftmost entry is client-supplied — only fall
  // back to it (last entry, the hop nearest us) if X-Real-IP is absent.
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",");
    return parts[parts.length - 1].trim();
  }
  return "0.0.0.0";
}

export async function isSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return true; // non-browser clients (curl) bypass; same-site cookies still gate.
  const host = h.get("host");
  if (!host) return false;
  try {
    const u = new URL(origin);
    return u.host === host;
  } catch {
    return false;
  }
}

export function jsonError(
  status: number,
  code: string,
  message?: string,
): Response {
  return Response.json({ error: code, message: message ?? code }, { status });
}
