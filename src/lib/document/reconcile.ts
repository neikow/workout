"use client";

import type { SyncBundle } from "@/lib/sync";
import {
  GUEST_IDB_NAME,
  clearIdbDoc,
  docToText,
  readIdbDocText,
  sameContent,
} from "@/lib/ydoc-text";

/**
 * Bounded wait for the WS provider's initial sync before we read the account
 * document. Keeps reconciliation from hanging when the sidecar is unreachable —
 * `whenWsSynced` resolves `null` on timeout and we treat the cloud as empty.
 */
export const WS_SYNC_TIMEOUT_MS = 4000;

/**
 * Outcome of comparing this device's prior *guest* document with the synced
 * account document after sign-in:
 *  - `none`        nothing to do (no guest doc, or it already matches the cloud)
 *  - `adopt-guest` the cloud is empty, so the guest doc should seed the account
 *  - `conflict`    both sides have content and diverge — ask the user to resolve
 */
export type Reconciliation =
  | { kind: "none" }
  | { kind: "adopt-guest"; guestText: string }
  | { kind: "conflict"; local: string; cloud: string };

/**
 * Decide how to merge a device's guest document into the account document. The
 * CRDT can't be allowed to silently union two independent plans, so anything
 * other than "empty cloud" or "identical content" is surfaced as a conflict for
 * the caller to resolve. Identical guest copies are cleared eagerly.
 */
export async function reconcileGuestDoc(
  bundle: SyncBundle,
): Promise<Reconciliation> {
  const guestText = await readIdbDocText(GUEST_IDB_NAME);
  if (!guestText.trim()) return { kind: "none" };

  await bundle.whenWsSynced(WS_SYNC_TIMEOUT_MS);
  const cloudText = docToText(bundle.ydoc);

  if (!cloudText.trim()) return { kind: "adopt-guest", guestText };
  if (sameContent(guestText, cloudText)) {
    await clearGuestDoc();
    return { kind: "none" };
  }
  return { kind: "conflict", local: guestText, cloud: cloudText };
}

/** Wipe the device's guest document once it has been reconciled. */
export async function clearGuestDoc(): Promise<void> {
  await clearIdbDoc(GUEST_IDB_NAME);
}
