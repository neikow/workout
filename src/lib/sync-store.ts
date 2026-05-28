"use client";

import { create } from "zustand";
import {
  buildSync,
  fetchSyncToken,
  resolveSyncUrl,
  type SyncBundle,
} from "./sync";

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
    const { bundle: prev } = get();
    prev?.destroy();

    const next = buildSync({
      userId: nextUserId,
      syncUrl: resolveSyncUrl(),
      getToken: async () => (await fetchSyncToken()).token,
    });

    set({ bundle: next, idbSynced: false, currentUserId: nextUserId });

    next.idb.whenSynced.then(() => {
      set((s) => (s.bundle === next ? { idbSynced: true } : {}));
    });
  },
}));
