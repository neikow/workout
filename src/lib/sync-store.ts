"use client";

import { create } from "zustand";
import * as Y from "yjs";
import { buildSync, fetchSyncToken, type SyncBundle } from "./sync";

interface SyncState {
  bundle: SyncBundle | null;
  idbSynced: boolean;
  currentUserId: string | null | undefined;
}

interface SyncActions {
  transition: (nextUserId: string | null) => void;
}

export const useSyncStore = create<SyncState & SyncActions>((set, get) => ({
  bundle: null,
  idbSynced: false,
  currentUserId: undefined,

  transition(nextUserId) {
    const { bundle: prev, currentUserId: prevUserId } = get();

    // Capture guest Yjs state before destroying — this is the migration path
    // when a user signs in with existing local (guest) content.
    let guestUpdate: Uint8Array | null = null;
    if (prev && prevUserId === null && nextUserId !== null) {
      const frag = prev.ydoc.getXmlFragment("default");
      if (frag.length > 0) {
        guestUpdate = Y.encodeStateAsUpdate(prev.ydoc);
      }
    }

    prev?.destroy();

    const next = buildSync({
      userId: nextUserId,
      syncUrl: process.env.NEXT_PUBLIC_SYNC_URL,
      getToken: async () => (await fetchSyncToken()).token,
    });

    set({ bundle: next, idbSynced: false, currentUserId: nextUserId });

    next.idb.whenSynced.then(() => {
      if (get().bundle !== next) return;

      if (guestUpdate) {
        const frag = next.ydoc.getXmlFragment("default");
        if (frag.length === 0) {
          Y.applyUpdate(next.ydoc, guestUpdate);
        }
      }

      set((s) => (s.bundle === next ? { idbSynced: true } : {}));
    });
  },
}));
