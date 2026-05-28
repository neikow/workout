import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { otpCodes, users } from "@db/schema";
import { getDb } from "./db";
import { constantTimeEqual, generateOtpCode, hashToken } from "./tokens";
import { sendOtpEmail } from "./mail";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type UserRow = { id: string; email: string };

export async function findOrCreateUser(email: string): Promise<UserRow> {
  const normalized = email.trim().toLowerCase();
  const db = getDb();
  const existing = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (existing[0]) return existing[0];
  const created = await db
    .insert(users)
    .values({ email: normalized })
    .returning({ id: users.id, email: users.email });
  return created[0]!;
}

export async function issueOtp(email: string): Promise<{ delivered: boolean }> {
  const db = getDb();
  const user = await findOrCreateUser(email);
  const code = generateOtpCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Invalidate prior unused codes for this user.
  await db
    .update(otpCodes)
    .set({ usedAt: sql`now()` })
    .where(and(eq(otpCodes.userId, user.id), isNull(otpCodes.usedAt)));
  await db.insert(otpCodes).values({ userId: user.id, codeHash, expiresAt });

  try {
    await sendOtpEmail(user.email, code);
    return { delivered: true };
  } catch (e) {
    // Surface to server logs; client gets generic ok to avoid enumeration.
    console.error("[otp] mail send failed", e);
    return { delivered: false };
  }
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  const user = userRows[0];
  if (!user) return { ok: false, reason: "invalid" };

  const otpRows = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.userId, user.id), isNull(otpCodes.usedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  const otp = otpRows[0];
  if (!otp) return { ok: false, reason: "invalid" };

  if (otp.attempts >= MAX_ATTEMPTS) {
    await db
      .update(otpCodes)
      .set({ usedAt: sql`now()` })
      .where(eq(otpCodes.id, otp.id));
    return { ok: false, reason: "too_many_attempts" };
  }

  if (new Date(otp.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const codeHash = hashToken(code);
  if (!constantTimeEqual(codeHash, otp.codeHash)) {
    await db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(eq(otpCodes.id, otp.id));
    return { ok: false, reason: "invalid" };
  }

  await db
    .update(otpCodes)
    .set({ usedAt: sql`now()` })
    .where(eq(otpCodes.id, otp.id));
  return { ok: true, userId: user.id };
}
