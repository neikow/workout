import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_AUTH = 2;
export const MESSAGE_QUERY_AWARENESS = 3;

export function encodeSyncStep1(ydoc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, ydoc);
  return encoding.toUint8Array(encoder);
}

export function encodeUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

export function encodeAwarenessUpdate(
  awareness: awarenessProtocol.Awareness,
  clients: number[],
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, clients),
  );
  return encoding.toUint8Array(encoder);
}

export interface IncomingHandlers {
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  origin: unknown;
}

export interface IncomingResult {
  /** Reply that must be sent back to the originating connection. */
  reply: Uint8Array | null;
  /** Awareness update to fan out to every other connection. */
  awarenessBroadcast: Uint8Array | null;
}

/**
 * Decode a single incoming frame. Throws only on truly unrecoverable input;
 * unknown message types are dropped silently so a client speaking a newer
 * protocol revision doesn't kill the connection.
 */
export function handleIncoming(
  message: Uint8Array,
  { ydoc, awareness, origin }: IncomingHandlers,
): IncomingResult {
  if (message.byteLength === 0) {
    return { reply: null, awarenessBroadcast: null };
  }
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);
  switch (messageType) {
    case MESSAGE_SYNC: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, ydoc, origin);
      const reply =
        encoding.length(encoder) > 1 ? encoding.toUint8Array(encoder) : null;
      return { reply, awarenessBroadcast: null };
    }
    case MESSAGE_AWARENESS: {
      const update = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(awareness, update, origin);
      // Re-encode under a MESSAGE_AWARENESS envelope for fan-out.
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, update);
      return {
        reply: null,
        awarenessBroadcast: encoding.toUint8Array(encoder),
      };
    }
    case MESSAGE_QUERY_AWARENESS: {
      const clients = Array.from(awareness.getStates().keys());
      if (clients.length === 0) {
        return { reply: null, awarenessBroadcast: null };
      }
      return {
        reply: encodeAwarenessUpdate(awareness, clients),
        awarenessBroadcast: null,
      };
    }
    case MESSAGE_AUTH:
    default:
      return { reply: null, awarenessBroadcast: null };
  }
}
