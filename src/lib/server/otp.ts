import "server-only";
import { query } from "./db";
import { constantTimeEqual, generateOtpCode, hashToken } from "./tokens";
import { sendOtpEmail } from "./mail";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type UserRow = { id: string; email: string };

export async function findOrCreateUser(email: string): Promise<UserRow> {
  const normalized = email.trim().toLowerCase();
  const existing = await query<UserRow>(
    "SELECT id, email FROM users WHERE email = $1",
    [normalized],
  );
  if (existing.rows[0]) return existing.rows[0];
  const created = await query<UserRow>(
    "INSERT INTO users(email) VALUES ($1) RETURNING id, email",
    [normalized],
  );
  return created.rows[0];
}

export async function issueOtp(email: string): Promise<{ delivered: boolean }> {
  const user = await findOrCreateUser(email);
  const code = generateOtpCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Invalidate prior unused codes for this user.
  await query(
    "UPDATE otp_codes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL",
    [user.id],
  );
  await query(
    "INSERT INTO otp_codes(user_id, code_hash, expires_at) VALUES ($1, $2, $3)",
    [user.id, codeHash, expiresAt],
  );

  try {
    await sendOtpEmail(user.email, code);
    return { delivered: true };
  } catch (e) {
    // Surface to server logs; client gets generic ok to avoid enumeration.
    console.error("[otp] mail send failed", e);
    return { delivered: false };
  }
}

type OtpRow = {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: Date;
  used_at: Date | null;
  attempts: number;
};

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  const normalized = email.trim().toLowerCase();
  const userRes = await query<UserRow>(
    "SELECT id FROM users WHERE email = $1",
    [normalized],
  );
  const user = userRes.rows[0];
  if (!user) return { ok: false, reason: "invalid" };

  const otpRes = await query<OtpRow>(
    `SELECT id, user_id, code_hash, expires_at, used_at, attempts
     FROM otp_codes
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id],
  );
  const otp = otpRes.rows[0];
  if (!otp) return { ok: false, reason: "invalid" };

  if (otp.attempts >= MAX_ATTEMPTS) {
    await query("UPDATE otp_codes SET used_at = now() WHERE id = $1", [otp.id]);
    return { ok: false, reason: "too_many_attempts" };
  }

  if (new Date(otp.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const codeHash = hashToken(code);
  if (!constantTimeEqual(codeHash, otp.code_hash)) {
    await query("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1", [
      otp.id,
    ]);
    return { ok: false, reason: "invalid" };
  }

  await query("UPDATE otp_codes SET used_at = now() WHERE id = $1", [otp.id]);
  return { ok: true, userId: user.id };
}
