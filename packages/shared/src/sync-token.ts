import { createHmac, timingSafeEqual } from "node:crypto";

export interface SyncTokenClaims {
  uid: string;
  exp: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeSyncToken(
  uid: string,
  ttlMs: number,
  secret: string,
): string {
  const claims: SyncTokenClaims = { uid, exp: Date.now() + ttlMs };
  const b64 = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${b64}.${sign(b64, secret)}`;
}

export function verifySyncToken(
  token: string | null | undefined,
  secret: string,
): SyncTokenClaims | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(b64, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: SyncTokenClaims;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(b64, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { uid?: unknown }).uid !== "string" ||
      typeof (parsed as { exp?: unknown }).exp !== "number"
    ) {
      return null;
    }
    claims = parsed as SyncTokenClaims;
  } catch {
    return null;
  }
  if (claims.exp < Date.now()) return null;
  return claims;
}
