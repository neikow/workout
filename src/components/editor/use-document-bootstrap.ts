"use client";

import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { SyncBundle } from "@/lib/sync";
import { clearGuestDoc, reconcileGuestDoc } from "@/lib/document/reconcile";
import { mergeWorkoutText } from "@/lib/merge-workouts";
import { textToDoc } from "@/lib/ydoc-text";
import { compileDateFormat } from "./date-format";
import type { ConflictChoice } from "../ConflictModal";

export interface DocumentConflict {
  local: string;
  cloud: string;
}

/**
 * Reconcile a device's guest document into the account document after sign-in.
 * Empty cloud → adopt the guest content; identical → drop the guest copy;
 * divergence → expose a `conflict` for the UI to resolve. Guests (and already
 * reconciled devices) are a no-op.
 */
export function useDocumentBootstrap(
  editor: Editor | null,
  bundle: SyncBundle,
  isAuthenticated: boolean,
  dateFormat: string,
): {
  conflict: DocumentConflict | null;
  resolveConflict: (choice: ConflictChoice) => Promise<void>;
} {
  const [conflict, setConflict] = useState<DocumentConflict | null>(null);

  useEffect(() => {
    if (!editor || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      const result = await reconcileGuestDoc(bundle);
      if (cancelled) return;
      if (result.kind === "adopt-guest") {
        editor.commands.setContent(textToDoc(result.guestText), {
          emitUpdate: true,
        });
        await clearGuestDoc();
      } else if (result.kind === "conflict") {
        setConflict({ local: result.local, cloud: result.cloud });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, bundle, isAuthenticated]);

  const resolveConflict = useCallback(
    async (choice: ConflictChoice) => {
      if (!editor || !conflict) return;
      if (choice === "local") {
        editor.commands.setContent(textToDoc(conflict.local), {
          emitUpdate: true,
        });
      } else if (choice === "merge") {
        const re = compileDateFormat(dateFormat);
        const merged = mergeWorkoutText(conflict.local, conflict.cloud, (l) =>
          re.test(l.trim()),
        );
        editor.commands.setContent(textToDoc(merged), { emitUpdate: true });
      }
      await clearGuestDoc();
      setConflict(null);
    },
    [editor, conflict, dateFormat],
  );

  return { conflict, resolveConflict };
}
