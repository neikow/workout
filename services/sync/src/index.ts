import "dotenv/config";
import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { WorkoutDoc } from "./persistence.js";
import { encodeSyncStep1, encodeUpdate, handleIncoming } from "./protocol.js";
import { verifySyncToken } from "./auth.js";

const PORT = Number(process.env.SYNC_PORT ?? "1234");
const SECRET = process.env.SYNC_TOKEN_SECRET;
if (!SECRET) {
  console.error("SYNC_TOKEN_SECRET not set");
  process.exit(1);
}
const TOKEN_SECRET = SECRET;

const docs = new Map<string, WorkoutDoc>();

function getDoc(uid: string): WorkoutDoc {
  let doc = docs.get(uid);
  if (doc) return doc;
  doc = new WorkoutDoc(uid, (update, origin) => {
    const msg = encodeUpdate(update);
    for (const c of doc!.conns) {
      const ws = c as WebSocket;
      if (ws === origin) continue;
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  });
  docs.set(uid, doc);
  return doc;
}

async function evict(uid: string) {
  const doc = docs.get(uid);
  if (!doc || doc.conns.size > 0) return;
  docs.delete(uid);
  await doc.finalize();
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

const wss = new WebSocketServer({ noServer: true });

wss.on(
  "connection",
  async (ws: WebSocket, _req: IncomingMessage, uid: string) => {
    const doc = getDoc(uid);
    doc.conns.add(ws);
    ws.binaryType = "arraybuffer";

    await doc.ready;

    ws.on("message", (raw, isBinary) => {
      if (!isBinary) return;
      const buf = Array.isArray(raw) ? Buffer.concat(raw) : (raw as Buffer);
      const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      const reply = handleIncoming(bytes, doc.ydoc, ws);
      if (reply && ws.readyState === WebSocket.OPEN) ws.send(reply);
    });

    ws.on("close", () => {
      doc.conns.delete(ws);
      if (doc.conns.size === 0) {
        void evict(uid);
      }
    });

    ws.on("error", (e) => {
      console.error(`[sync] ws error for ${uid}:`, e);
    });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encodeSyncStep1(doc.ydoc));
    }
  },
);

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
