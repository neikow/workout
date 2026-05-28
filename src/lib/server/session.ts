import "server-only";
import { cookies } from "next/headers";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { sessions } from "@db/schema";
import { getDb } from "./db";
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

function toRow(s: typeof sessions.$inferSelect): SessionRow {
  return {
    id: s.id,
    user_id: s.userId,
    device_name: s.deviceName,
    expires_at: s.expiresAt,
    created_at: s.createdAt,
    last_seen_at: s.lastSeenAt,
    revoked_at: s.revokedAt,
  };
}

export async function createSession(
  userId: string,
  deviceName: string | null,
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const db = getDb();
  const token = generateOpaqueToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const created = await db
    .insert(sessions)
    .values({
      userId,
      deviceName,
      refreshTokenHash: tokenHash,
      expiresAt,
    })
    .returning({ id: sessions.id });
  return { token, sessionId: created[0]!.id, expiresAt };
}

export async function readSessionByToken(
  token: string,
): Promise<SessionRow | null> {
  const db = getDb();
  const tokenHash = hashToken(token);
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, tokenHash))
    .limit(1);
  const s = rows[0];
  if (!s) return null;
  if (s.revokedAt) return null;
  if (new Date(s.expiresAt).getTime() <= Date.now()) return null;
  return toRow(s);
}

export async function touchSession(sessionId: string): Promise<Date> {
  const db = getDb();
  // Sliding expiry: bump expires_at if past refresh threshold.
  const newExpires = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .update(sessions)
    .set({
      lastSeenAt: sql`now()`,
      expiresAt: sql`CASE WHEN ${sessions.expiresAt} - now() < ${`${REFRESH_THRESHOLD_MS / 1000} seconds`}::interval
                          THEN ${newExpires}
                          ELSE ${sessions.expiresAt} END`,
    })
    .where(eq(sessions.id, sessionId));
  return newExpires;
}

export async function revokeSession(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();
  const res = await db
    .update(sessions)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
      ),
    )
    .returning({ id: sessions.id });
  return res.length > 0;
}

export async function listUserSessions(userId: string): Promise<SessionRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`now()`),
      ),
    )
    .orderBy(desc(sessions.lastSeenAt));
  return rows.map(toRow);
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
