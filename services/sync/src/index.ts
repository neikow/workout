import "dotenv/config";
import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as awarenessProtocol from "y-protocols/awareness";
import { WorkoutDoc } from "./persistence.js";
import {
  encodeAwarenessUpdate,
  encodeSyncStep1,
  encodeUpdate,
  handleIncoming,
} from "./protocol.js";
import { verifySyncToken } from "./auth.js";

const PORT = Number(process.env.SYNC_PORT ?? "1234");
const SECRET = process.env.SYNC_TOKEN_SECRET;
if (!SECRET) {
  console.error("SYNC_TOKEN_SECRET not set");
  process.exit(1);
}
const TOKEN_SECRET = SECRET;

const MAX_CONNS_PER_UID = 16;
// 1 MiB per WS frame is plenty for ProseMirror updates; protects from OOM.
const MAX_MESSAGE_BYTES = 1024 * 1024;

const docs = new Map<string, WorkoutDoc>();
// In-flight finalize() per uid. A new connection for the same uid must wait for
// any pending finalize to finish before loading a fresh doc, otherwise the new
// doc's load() races the old doc's compaction over the same DB rows.
const finalizing = new Map<string, Promise<void>>();

// Per-connection set of awareness client IDs this socket is advertising. Used
// to clean state up on disconnect so other clients see the user disappear.
const connAwarenessClients = new WeakMap<WebSocket, Set<number>>();
const docAwarenessWired = new WeakSet<WorkoutDoc>();

function safeSend(ws: WebSocket, payload: Uint8Array) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(payload, (err) => {
    if (err) {
      console.error("[sync] send failed:", err.message);
      try {
        ws.close(1011, "send_failed");
      } catch {}
    }
  });
}

function broadcast(doc: WorkoutDoc, payload: Uint8Array, except?: WebSocket) {
  for (const c of doc.conns) {
    const ws = c as WebSocket;
    if (ws === except) continue;
    safeSend(ws, payload);
  }
}

async function getDoc(uid: string): Promise<WorkoutDoc> {
  const pending = finalizing.get(uid);
  if (pending) await pending;

  let doc = docs.get(uid);
  if (doc) return doc;
  doc = new WorkoutDoc(uid, (update, origin) => {
    broadcast(doc!, encodeUpdate(update), origin as WebSocket | undefined);
  });
  docs.set(uid, doc);
  return doc;
}

function wireAwareness(doc: WorkoutDoc) {
  if (docAwarenessWired.has(doc)) return;
  docAwarenessWired.add(doc);
  doc.awareness.on(
    "update",
    (
      {
        added,
        updated,
        removed,
      }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      // Remember which client IDs each socket is advertising so we can clear
      // them on disconnect.
      if (origin instanceof WebSocket) {
        const tracked = connAwarenessClients.get(origin) ?? new Set<number>();
        for (const id of added) tracked.add(id);
        for (const id of updated) tracked.add(id);
        for (const id of removed) tracked.delete(id);
        connAwarenessClients.set(origin, tracked);
      }
      const changed = added.concat(updated, removed);
      if (changed.length === 0) return;
      const payload = encodeAwarenessUpdate(doc.awareness, changed);
      broadcast(doc, payload, origin as WebSocket | undefined);
    },
  );
}

function evict(uid: string) {
  const doc = docs.get(uid);
  if (!doc || doc.conns.size > 0) return;
  docs.delete(uid);
  const p = doc.finalize().finally(() => {
    if (finalizing.get(uid) === p) finalizing.delete(uid);
  });
  finalizing.set(uid, p);
}

function parseUrl(req: IncomingMessage): {
  uid: string | null;
  token: string | null;
} {
  const url = new URL(req.url ?? "/", "http://x");
  const uid = url.pathname.slice(1) || null;
  const token = url.searchParams.get("token");
  return { uid, token };
}

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_MESSAGE_BYTES,
});

function toUint8Array(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (Array.isArray(raw)) {
    const buf = Buffer.concat(raw);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  throw new Error(`unsupported frame type: ${typeof raw}`);
}

async function onConnection(ws: WebSocket, _req: IncomingMessage, uid: string) {
  const doc = await getDoc(uid);
  if (doc.conns.size >= MAX_CONNS_PER_UID) {
    ws.close(1013, "too_many_connections");
    return;
  }
  doc.conns.add(ws);
  wireAwareness(doc);
  connAwarenessClients.set(ws, new Set());

  ws.on("close", () => {
    doc.conns.delete(ws);
    const clients = connAwarenessClients.get(ws);
    if (clients && clients.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        doc.awareness,
        Array.from(clients),
        ws,
      );
    }
    connAwarenessClients.delete(ws);
    if (doc.conns.size === 0) evict(uid);
  });

  ws.on("error", (e) => {
    console.error(`[sync] ws error for ${uid}:`, e.message ?? e);
  });

  try {
    await doc.ready;
  } catch (e) {
    console.error(`[sync] doc load failed for ${uid}:`, e);
    if (ws.readyState === WebSocket.OPEN) ws.close(1011, "load_failed");
    return;
  }

  ws.on("message", (raw, isBinary) => {
    if (!isBinary) return;
    let bytes: Uint8Array;
    try {
      bytes = toUint8Array(raw);
    } catch (e) {
      console.error(`[sync] bad frame from ${uid}:`, e);
      return;
    }
    if (bytes.byteLength === 0) return;
    try {
      const result = handleIncoming(bytes, {
        ydoc: doc.ydoc,
        awareness: doc.awareness,
        origin: ws,
      });
      if (result.reply) safeSend(ws, result.reply);
      if (result.awarenessBroadcast) {
        broadcast(doc, result.awarenessBroadcast, ws);
      }
    } catch (e) {
      const head = Array.from(bytes.slice(0, 16))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      console.error(
        `[sync] decode failed for ${uid} (${bytes.byteLength}B: ${head}):`,
        e,
      );
      // Drop this frame but keep the connection — the client will resync.
    }
  });

  // Kick off the initial sync handshake.
  safeSend(ws, encodeSyncStep1(doc.ydoc));

  // Send current awareness snapshot so the new client sees other devices.
  const states = Array.from(doc.awareness.getStates().keys());
  if (states.length > 0) {
    safeSend(ws, encodeAwarenessUpdate(doc.awareness, states));
  }
}

wss.on("connection", (ws: WebSocket, req: IncomingMessage, uid: string) => {
  onConnection(ws, req, uid).catch((e) => {
    console.error(`[sync] connection handler failed for ${uid}:`, e);
    if (ws.readyState === WebSocket.OPEN) ws.close(1011, "handler_failed");
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("[sync] unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[sync] uncaught exception:", err);
});

const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

server.on("upgrade", (req, socket, head) => {
  const { uid, token } = parseUrl(req);
  if (!uid) {
    socket.destroy();
    return;
  }
  const claims = verifySyncToken(token, TOKEN_SECRET);
  if (!claims || claims.uid !== uid) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req, uid);
  });
});

server.listen(PORT, () => {
  console.log(`[sync] listening on :${PORT}`);
});

const shutdown = async () => {
  console.log("[sync] shutting down");
  for (const [uid, doc] of docs) {
    for (const c of doc.conns) (c as WebSocket).close();
    await doc.finalize().catch(() => {});
    docs.delete(uid);
  }
  wss.close();
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
