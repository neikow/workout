"use client";

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";

const GUEST_DOC_NAME = "guest";
const IDB_PREFIX = "workout-y:";

/**
 * Resolve the sync sidecar URL. Prefers an explicit `NEXT_PUBLIC_SYNC_URL`
 * (set in dev to reach the sidecar directly, e.g. ws://localhost:1234).
 * In prod the var is unset — the sidecar is reached same-origin via the nginx
 * `/sync` route, so derive `wss?://<host>/sync` from the page location instead
 * of baking a host into the build.
 */
export function resolveSyncUrl(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_SYNC_URL;
  if (explicit) return explicit;
  if (typeof window === "undefined") return undefined;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/sync`;
}

export interface SyncTokenResponse {
  token: string;
  userId: string;
  expiresAt: string;
}

export async function fetchSyncToken(): Promise<SyncTokenResponse> {
  const r = await fetch("/api/auth/sync-token", {
    credentials: "same-origin",
  });
  if (!r.ok) throw new Error("sync_token_failed");
  return (await r.json()) as SyncTokenResponse;
}

export interface SyncBundle {
  ydoc: Y.Doc;
  idb: IndexeddbPersistence;
  readonly ws: WebsocketProvider | null;
  /** Resolves when WS provider is constructed (or null if guest / no URL). */
  readonly wsReady: Promise<WebsocketProvider | null>;
  /**
   * Resolves once the WS provider has completed initial sync. Pass `timeoutMs`
   * to bound the wait so callers don't hang when the sidecar is unreachable —
   * the returned provider is `null` on timeout (and when no ws is configured).
   */
  whenWsSynced(timeoutMs?: number): Promise<WebsocketProvider | null>;
  destroy(): void;
}

export interface BuildSyncOpts {
  userId: string | null;
  syncUrl?: string;
  getToken?: () => Promise<string>;
}

export function buildSync(opts: BuildSyncOpts): SyncBundle {
  const docName = opts.userId ?? GUEST_DOC_NAME;
  const ydoc = new Y.Doc();
  const idb = new IndexeddbPersistence(IDB_PREFIX + docName, ydoc);

  let ws: WebsocketProvider | null = null;
  let cancelled = false;

  const wsReady: Promise<WebsocketProvider | null> = (async () => {
    if (!opts.userId || !opts.syncUrl || !opts.getToken) return null;
    try {
      const token = await opts.getToken();
      if (cancelled) return null;
      ws = new WebsocketProvider(opts.syncUrl, opts.userId, ydoc, {
        params: { token },
        connect: true,
      });
      return ws;
    } catch (e) {
      console.error("[sync] failed to mint token:", e);
      return null;
    }
  })();

  return {
    ydoc,
    idb,
    get ws() {
      return ws;
    },
    wsReady,
    async whenWsSynced(timeoutMs?: number) {
      const provider = await wsReady;
      if (!provider) return null;
      if (provider.synced) return provider;
      const synced = await new Promise<boolean>((resolve) => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const onSync = (isSynced: boolean) => {
          if (!isSynced) return;
          provider.off("sync", onSync);
          if (timer) clearTimeout(timer);
          resolve(true);
        };
        provider.on("sync", onSync);
        if (timeoutMs != null) {
          timer = setTimeout(() => {
            provider.off("sync", onSync);
            resolve(false);
          }, timeoutMs);
        }
      });
      return synced ? provider : null;
    },
    destroy: () => {
      cancelled = true;
      ws?.disconnect();
      ws?.destroy();
      void idb.destroy();
      ydoc.destroy();
    },
  };
}
