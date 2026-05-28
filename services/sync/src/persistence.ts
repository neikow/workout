import { Pool } from "pg";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";

const COMPACT_THRESHOLD = 100;

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  pool = new Pool({ connectionString: url, max: 10 });
  return pool;
}

interface SnapshotRow {
  state: Buffer;
  through_seq: string;
}

async function loadSnapshot(
  uid: string,
): Promise<{ state: Uint8Array; throughSeq: number } | null> {
  const r = await getPool().query<SnapshotRow>(
    "SELECT state, through_seq FROM workout_doc_snapshots WHERE user_id = $1",
    [uid],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    state: new Uint8Array(row.state),
    throughSeq: Number(row.through_seq),
  };
}

interface UpdateRow {
  seq: string;
  update: Buffer;
}

async function loadUpdatesAfter(
  uid: string,
  throughSeq: number,
): Promise<{ seq: number; update: Uint8Array }[]> {
  const r = await getPool().query<UpdateRow>(
    `SELECT seq, update FROM workout_doc_updates
     WHERE user_id = $1 AND seq > $2
     ORDER BY seq ASC`,
    [uid, throughSeq],
  );
  return r.rows.map((row) => ({
    seq: Number(row.seq),
    update: new Uint8Array(row.update),
  }));
}

async function appendUpdate(uid: string, update: Uint8Array): Promise<number> {
  const r = await getPool().query<{ seq: string }>(
    `INSERT INTO workout_doc_updates (user_id, update)
     VALUES ($1, $2) RETURNING seq`,
    [uid, Buffer.from(update)],
  );
  const row = r.rows[0];
  if (!row) throw new Error("append failed");
  return Number(row.seq);
}

async function compact(uid: string, ydoc: Y.Doc): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const maxRes = await client.query<{ max: string | null }>(
      "SELECT MAX(seq) AS max FROM workout_doc_updates WHERE user_id = $1",
      [uid],
    );
    const maxSeq = maxRes.rows[0]?.max ? Number(maxRes.rows[0].max) : 0;
    const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    await client.query(
      `INSERT INTO workout_doc_snapshots (user_id, state, through_seq, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE
         SET state = EXCLUDED.state,
             through_seq = EXCLUDED.through_seq,
             updated_at = now()`,
      [uid, state, maxSeq],
    );
    await client.query(
      "DELETE FROM workout_doc_updates WHERE user_id = $1 AND seq <= $2",
      [uid, maxSeq],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function pendingUpdateCount(uid: string): Promise<number> {
  const r = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM workout_doc_updates u
     WHERE u.user_id = $1 AND u.seq > COALESCE(
       (SELECT through_seq FROM workout_doc_snapshots s WHERE s.user_id = $1),
       0
     )`,
    [uid],
  );
  return Number(r.rows[0]?.count ?? 0);
}

export class WorkoutDoc {
  readonly ydoc = new Y.Doc({ gc: true });
  readonly awareness = new awarenessProtocol.Awareness(this.ydoc);
  readonly conns = new Set<unknown>();
  readonly ready: Promise<void>;
  private compacting = false;
  private updateListener:
    | ((update: Uint8Array, origin: unknown) => void)
    | null = null;

  constructor(
    readonly uid: string,
    private readonly onLocalUpdate: (
      update: Uint8Array,
      origin: unknown,
    ) => void,
  ) {
    // Server doesn't participate in awareness with its own client state.
    this.awareness.setLocalState(null);
    this.ready = this.load();
  }

  private async load() {
    const snap = await loadSnapshot(this.uid);
    let through = 0;
    if (snap) {
      Y.applyUpdate(this.ydoc, snap.state, "persistence");
      through = snap.throughSeq;
    }
    const updates = await loadUpdatesAfter(this.uid, through);
    for (const u of updates) Y.applyUpdate(this.ydoc, u.update, "persistence");

    const listener = (update: Uint8Array, origin: unknown) => {
      if (origin === "persistence") return;
      void this.persist(update);
      this.onLocalUpdate(update, origin);
    };
    this.updateListener = listener;
    this.ydoc.on("update", listener);
  }

  private async persist(update: Uint8Array) {
    try {
      await appendUpdate(this.uid, update);
      if (!this.compacting) {
        const count = await pendingUpdateCount(this.uid);
        if (count >= COMPACT_THRESHOLD) {
          this.compacting = true;
          try {
            await compact(this.uid, this.ydoc);
          } finally {
            this.compacting = false;
          }
        }
      }
    } catch (e) {
      console.error(`[sync] persist failed for ${this.uid}:`, e);
    }
  }

  async finalize() {
    if (this.updateListener) {
      this.ydoc.off("update", this.updateListener);
      this.updateListener = null;
    }
    try {
      await compact(this.uid, this.ydoc);
    } catch (e) {
      console.error(`[sync] finalize compact failed for ${this.uid}:`, e);
    }
    this.awareness.destroy();
    this.ydoc.destroy();
  }
}
