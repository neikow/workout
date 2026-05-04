import "server-only";
import { cookies } from "next/headers";
import { query } from "./db";
import { generateOpaqueToken, hashToken } from "./tokens";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE =
  process.env.SESSION_COOKIE_NAME ?? "workout_session";

export type SessionRow = {
  id: string;
  user_id: string;
  device_name: string | null;
  expires_at: Date;
  created_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
};

export async function createSession(
  userId: string,
  deviceName: string | null,
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const token = generateOpaqueToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const res = await query<{ id: string }>(
    `INSERT INTO sessions(user_id, device_name, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, deviceName, tokenHash, expiresAt],
  );
  return { token, sessionId: res.rows[0].id, expiresAt };
}

export async function readSessionByToken(
  token: string,
): Promise<SessionRow | null> {
  const tokenHash = hashToken(token);
  const res = await query<SessionRow>(
    `SELECT id, user_id, device_name, expires_at, created_at, last_seen_at, revoked_at
     FROM sessions
     WHERE refresh_token_hash = $1`,
    [tokenHash],
  );
  const s = res.rows[0];
  if (!s) return null;
  if (s.revoked_at) return null;
  if (new Date(s.expires_at).getTime() <= Date.now()) return null;
  return s;
}

export async function touchSession(sessionId: string): Promise<Date> {
  // Sliding expiry: bump expires_at if past refresh threshold.
  const newExpires = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    `UPDATE sessions
     SET last_seen_at = now(),
         expires_at = CASE
           WHEN expires_at - now() < $2::interval THEN $1
           ELSE expires_at
         END
     WHERE id = $3`,
    [newExpires, `${REFRESH_THRESHOLD_MS / 1000} seconds`, sessionId],
  );
  return newExpires;
}

export async function revokeSession(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const res = await query(
    `UPDATE sessions SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [sessionId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listUserSessions(userId: string): Promise<SessionRow[]> {
  const res = await query<SessionRow>(
    `SELECT id, user_id, device_name, expires_at, created_at, last_seen_at, revoked_at
     FROM sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
     ORDER BY last_seen_at DESC`,
    [userId],
  );
  return res.rows;
}

export function buildCookie(token: string, expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const c = await cookies();
  c.set(buildCookie(token, expiresAt));
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentSession(
  opts: { touch?: boolean } = {},
): Promise<{ session: SessionRow; userId: string } | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readSessionByToken(token);
  if (!session) return null;
  if (opts.touch) {
    const newExpires = await touchSession(session.id);
    // Refresh the cookie so the browser sees the extended expiry.
    c.set(buildCookie(token, newExpires));
  }
  return { session, userId: session.user_id };
}
