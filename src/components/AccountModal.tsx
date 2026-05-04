"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSessions,
  fetchWorkoutDocument,
  importLocalDocument,
  logout as apiLogout,
  requestOtp,
  revokeSession as apiRevokeSession,
  verifyOtp,
} from "@/lib/auth-client";
import { hasLocalContent, loadLocalContent } from "@/lib/storage";
import { useAuth, useInvalidateAuth } from "@/lib/auth-provider";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AccountModal({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [postLoginPrompt, setPostLoginPrompt] =
    useState<PostLoginPrompt | null>(null);
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal();
    else if (el.open) el.close();
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  function dismissPrompt() {
    setPostLoginPrompt(null);
    onClose();
  }

  const auth = useAuth();

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
      className="settings-dialog"
    >
      <div
        className="settings-header"
        style={{
          borderBottom: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <span className="settings-title">Account</span>
        <Button variant="icon" onClick={onClose} aria-label="Close">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M3.5 3.5l9 9M12.5 3.5l-9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </Button>
      </div>

      <div className="settings-body">
        {postLoginPrompt === "save" && (
          <FirstLoginSavePrompt onDone={dismissPrompt} />
        )}
        {postLoginPrompt === "merge" && <MergePrompt onDone={dismissPrompt} />}
        {!postLoginPrompt && (
          <>
            {auth.status === "loading" && (
              <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
                Loading…
              </p>
            )}
            {auth.status === "guest" && (
              <LoginPanel
                onClose={onClose}
                onPrompt={setPostLoginPrompt}
              />
            )}
            {auth.status === "authenticated" && (
              <AuthenticatedPanel email={auth.user.email} onClose={onClose} />
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

type LoginStep = "email" | "code";

type PostLoginPrompt = "save" | "merge";

function LoginPanel({
  onClose,
  onPrompt,
}: {
  onClose: () => void;
  onPrompt: (p: PostLoginPrompt | null) => void;
}) {
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invalidateAuth = useInvalidateAuth();
  const qc = useQueryClient();

  const requestMutation = useMutation({
    mutationFn: requestOtp,
    onSuccess: () => {
      setError(null);
      setStep("code");
    },
    onError: (e: Error) => setError(humanizeError(e.message)),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      verifyOtp(email, code),
    onSuccess: async () => {
      const local = await hasLocalContent();
      let next: PostLoginPrompt | null = null;
      if (local) {
        const cloud = await fetchWorkoutDocument().catch(() => null);
        const cloudEmpty = !cloud || !cloud.content.trim();
        next = cloudEmpty ? "save" : "merge";
      }
      onPrompt(next);
      await invalidateAuth();
      await qc.invalidateQueries({ queryKey: ["workouts"] });
      if (!next) onClose();
    },
    onError: (e: Error) => setError(humanizeError(e.message)),
  });

  return (
    <form
      className="settings-editor-section"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (step === "email") requestMutation.mutate(email.trim());
        else verifyMutation.mutate({ email: email.trim(), code: code.trim() });
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        Sign in to sync your workouts across devices. We'll email you a one-time
        code.
      </p>

      <label className="settings-field">
        <span
          className="settings-field-label"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Email
        </span>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={step === "code"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      {step === "code" && (
        <label className="settings-field">
          <span
            className="settings-field-label"
            style={{ color: "var(--color-text-secondary)" }}
          >
            6-digit code
          </span>
          <Input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          <span
            className="settings-hint"
            style={{ color: "var(--color-text-muted)" }}
          >
            Check your email. Code expires in 10 minutes.
          </span>
        </label>
      )}

      {error && (
        <p style={{ margin: 0, color: "tomato", fontSize: "0.8125rem" }}>
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="accent"
        disabled={
          (step === "email" && requestMutation.isPending) ||
          (step === "code" && verifyMutation.isPending)
        }
      >
        {step === "email"
          ? requestMutation.isPending
            ? "Sending…"
            : "Send code"
          : verifyMutation.isPending
            ? "Verifying…"
            : "Verify & sign in"}
      </Button>

      {step === "code" && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
        >
          Use a different email
        </button>
      )}
    </form>
  );
}

function FirstLoginSavePrompt({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState<"save" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  async function save() {
    setError(null);
    setBusy("save");
    try {
      const local = (await loadLocalContent()) ?? "";
      await importLocalDocument(local, "replace");
      await qc.invalidateQueries({ queryKey: ["workouts"] });
      onDone();
    } catch (e) {
      setError(humanizeError((e as Error).message));
      setBusy(null);
    }
  }

  async function discard() {
    setBusy("discard");
    await qc.invalidateQueries({ queryKey: ["workouts"] });
    onDone();
  }

  return (
    <div className="settings-editor-section">
      <p style={{ margin: 0, fontSize: "0.875rem" }}>
        We found workouts saved on this device. Save them to your cloud account?
      </p>
      {error && (
        <p style={{ margin: 0, color: "tomato", fontSize: "0.8125rem" }}>
          {error}
        </p>
      )}
      <Button variant="accent" disabled={busy !== null} onClick={save}>
        {busy === "save" ? "Saving…" : "Save to cloud"}
      </Button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={busy !== null}
        onClick={discard}
      >
        Not now
      </button>
    </div>
  );
}

function MergePrompt({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState<"merge" | "replace" | "discard" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  async function run(strategy: "merge" | "replace" | "discard") {
    setError(null);
    setBusy(strategy);
    try {
      if (strategy === "discard") {
        // Leave server doc alone; clear local on next reload via storage adapter swap.
      } else {
        const local = (await loadLocalContent()) ?? "";
        await importLocalDocument(local, strategy);
      }
      await qc.invalidateQueries({ queryKey: ["workouts"] });
      onDone();
    } catch (e) {
      setError(humanizeError((e as Error).message));
      setBusy(null);
    }
  }

  return (
    <div className="settings-editor-section">
      <p style={{ margin: 0, fontSize: "0.875rem" }}>
        We found workouts saved locally. How should we sync them?
      </p>
      {error && (
        <p style={{ margin: 0, color: "tomato", fontSize: "0.8125rem" }}>
          {error}
        </p>
      )}
      <Button
        variant="accent"
        disabled={busy !== null}
        onClick={() => run("merge")}
      >
        {busy === "merge" ? "Merging…" : "Merge with cloud"}
      </Button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={busy !== null}
        onClick={() => run("replace")}
      >
        {busy === "replace" ? "Uploading…" : "Replace cloud copy with local"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={busy !== null}
        onClick={() => run("discard")}
      >
        Discard local, use cloud
      </button>
    </div>
  );
}

function AuthenticatedPanel({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  const invalidateAuth = useInvalidateAuth();
  const qc = useQueryClient();
  const sessions = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: fetchSessions,
  });

  const revoke = useMutation({
    mutationFn: apiRevokeSession,
    onSuccess: async () => {
      await sessions.refetch();
      await invalidateAuth();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSuccess: async () => {
      await invalidateAuth();
      await qc.invalidateQueries({ queryKey: ["workouts"] });
      onClose();
    },
  });

  return (
    <div className="settings-editor-section">
      <div>
        <div
          className="settings-section-label"
          style={{ color: "var(--color-text-muted)", marginBottom: "0.375rem" }}
        >
          Signed in as
        </div>
        <div style={{ fontSize: "0.875rem", wordBreak: "break-all" }}>
          {email}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          className="settings-section-label"
          style={{ color: "var(--color-text-muted)", marginBottom: "0.5rem" }}
        >
          Active sessions
        </div>
        {sessions.isLoading && (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Loading…
          </p>
        )}
        {sessions.data && sessions.data.length === 0 && (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>None.</p>
        )}
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: "0.5rem",
            minWidth: 0,
          }}
        >
          {sessions.data?.map((s) => (
            <li
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                padding: "0.5rem 0.75rem",
                background: "var(--color-ghost-hover)",
                borderRadius: "0.3125rem",
                fontSize: "0.8125rem",
                minWidth: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={s.deviceName ?? "Unknown device"}
                >
                  {s.deviceName ?? "Unknown device"}
                  {s.current && (
                    <span
                      style={{
                        color: "var(--color-accent)",
                        marginLeft: "0.5rem",
                      }}
                    >
                      (this device)
                    </span>
                  )}
                </div>
                <div
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "0.75rem",
                  }}
                >
                  Last active {formatRelative(s.lastSeenAt)}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(s.id)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Button
        variant="accent"
        disabled={logoutMutation.isPending}
        onClick={() => logoutMutation.mutate()}
      >
        {logoutMutation.isPending ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

function humanizeError(code: string): string {
  switch (code) {
    case "rate_limited":
      return "Too many requests. Try again later.";
    case "invalid":
      return "Invalid code or email.";
    case "expired":
      return "Code expired. Request a new one.";
    case "too_many_attempts":
      return "Too many attempts. Request a new code.";
    case "unauthorized":
      return "You're not signed in.";
    default:
      return "Something went wrong.";
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return "—";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
