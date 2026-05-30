"use client";

export type AuthUser = { id: string; email: string };
export type SessionInfo = {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
};

export type MeResponse = {
  user: AuthUser | null;
  sessionId?: string;
};

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let err = "request_failed";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) err = body.error;
    } catch {}
    throw new Error(err);
  }
  return (await res.json()) as T;
}

export async function fetchMe(): Promise<MeResponse> {
  return asJson<MeResponse>(
    await fetch("/api/auth/me", { credentials: "same-origin" }),
  );
}

export async function requestOtp(email: string): Promise<void> {
  await asJson<{ ok: true }>(
    await fetch("/api/auth/otp", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ sessionId: string }> {
  return asJson<{ ok: true; sessionId: string }>(
    await fetch("/api/auth/verify", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    }),
  );
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
}

export async function fetchSessions(): Promise<SessionInfo[]> {
  const r = await asJson<{ sessions: SessionInfo[] }>(
    await fetch("/api/auth/sessions", { credentials: "same-origin" }),
  );
  return r.sessions;
}

export async function revokeSession(id: string): Promise<void> {
  await asJson<{ ok: true }>(
    await fetch(`/api/auth/sessions/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    }),
  );
}
