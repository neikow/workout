"use client";

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";

const GUEST_DOC_NAME = "guest";
const IDB_PREFIX = "workout-y:";

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
  /** Resolves once the WS provider has completed initial sync (or null if no ws). */
  whenWsSynced(): Promise<WebsocketProvider | null>;
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
    async whenWsSynced() {
      const provider = await wsReady;
      if (!provider) return null;
      if (provider.synced) return provider;
      await new Promise<void>((resolve) => {
        const onSync = (isSynced: boolean) => {
          if (!isSynced) return;
          provider.off("sync", onSync);
          resolve();
        };
        provider.on("sync", onSync);
      });
      return provider;
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
