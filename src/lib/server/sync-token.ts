import "server-only";
import { makeSyncToken } from "workout-shared";

const TOKEN_TTL_MS = 60_000;

function getSecret(): string {
  const s = process.env.SYNC_TOKEN_SECRET;
  if (!s) throw new Error("SYNC_TOKEN_SECRET not set");
  return s;
}

export function mintSyncToken(uid: string): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = makeSyncToken(uid, TOKEN_TTL_MS, getSecret());
  return { token, expiresAt };
}
