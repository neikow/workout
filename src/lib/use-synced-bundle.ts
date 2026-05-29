"use client";

import { useEffect } from "react";
import { useAuth } from "./auth-provider";
import { useSyncStore } from "./sync-store";
import type { SyncBundle } from "./sync";

export type SyncedBundle =
  | { status: "loading"; bundle: null; isAuthenticated: boolean }
  | { status: "ready"; bundle: SyncBundle; isAuthenticated: boolean };

/**
 * Resolve the active sync bundle for the signed-in (or guest) user, driving the
 * same transition + IDB-ready gating the editor uses. The bundle lives in a
 * module-level zustand store, so navigating between routes reuses it instead of
 * rebuilding — the editor and the profile page share one document.
 */
export function useSyncedBundle(): SyncedBundle {
  const auth = useAuth();
  const { bundle, idbSynced, currentUserId, transition } = useSyncStore();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const isAuthenticated = userId !== null;

  useEffect(() => {
    if (auth.status === "loading") return;
    if (currentUserId !== userId) transition(userId);
  }, [auth.status, userId, currentUserId, transition]);

  if (
    auth.status === "loading" ||
    !bundle ||
    !idbSynced ||
    currentUserId !== userId
  ) {
    return { status: "loading", bundle: null, isAuthenticated };
  }
  return { status: "ready", bundle, isAuthenticated };
}
