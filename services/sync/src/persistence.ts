import { and, eq, gt, lte, sql } from "drizzle-orm";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { workoutDocSnapshots, workoutDocUpdates } from "../../../db/schema.js";
import { getDb } from "./db.js";

const COMPACT_THRESHOLD = 100;

async function loadSnapshot(
  uid: string,
): Promise<{ state: Uint8Array; throughSeq: number } | null> {
  const rows = await getDb()
    .select({
      state: workoutDocSnapshots.state,
      throughSeq: workoutDocSnapshots.throughSeq,
    })
    .from(workoutDocSnapshots)
    .where(eq(workoutDocSnapshots.userId, uid))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    state: new Uint8Array(row.state),
    throughSeq: Number(row.throughSeq),
  };
}

async function loadUpdatesAfter(
  uid: string,
  throughSeq: number,
): Promise<{ seq: number; update: Uint8Array }[]> {
  const rows = await getDb()
    .select({
      seq: workoutDocUpdates.seq,
      update: workoutDocUpdates.update,
    })
    .from(workoutDocUpdates)
    .where(
      and(
        eq(workoutDocUpdates.userId, uid),
        gt(workoutDocUpdates.seq, throughSeq),
      ),
    )
    .orderBy(workoutDocUpdates.seq);
  return rows.map((row) => ({
    seq: Number(row.seq),
    update: new Uint8Array(row.update),
  }));
}

async function appendUpdate(uid: string, update: Uint8Array): Promise<number> {
  const rows = await getDb()
    .insert(workoutDocUpdates)
    .values({ userId: uid, update: Buffer.from(update) })
    .returning({ seq: workoutDocUpdates.seq });
  const row = rows[0];
  if (!row) throw new Error("append failed");
  return Number(row.seq);
}

async function compact(uid: string, ydoc: Y.Doc): Promise<void> {
  await getDb().transaction(async (tx) => {
    const maxRes = await tx
      .select({ max: sql<string | null>`MAX(${workoutDocUpdates.seq})` })
      .from(workoutDocUpdates)
      .where(eq(workoutDocUpdates.userId, uid));
    const maxSeq = maxRes[0]?.max ? Number(maxRes[0].max) : 0;
    const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    await tx
      .insert(workoutDocSnapshots)
      .values({
        userId: uid,
        state,
        throughSeq: maxSeq,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: workoutDocSnapshots.userId,
        set: {
          state,
          throughSeq: maxSeq,
          updatedAt: sql`now()`,
        },
      });
    await tx
      .delete(workoutDocUpdates)
      .where(
        and(
          eq(workoutDocUpdates.userId, uid),
          lte(workoutDocUpdates.seq, maxSeq),
        ),
      );
  });
}

async function pendingUpdateCount(uid: string): Promise<number> {
  const rows = await getDb()
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(workoutDocUpdates)
    .where(
      and(
        eq(workoutDocUpdates.userId, uid),
        gt(
          workoutDocUpdates.seq,
          sql<number>`COALESCE((SELECT ${workoutDocSnapshots.throughSeq} FROM ${workoutDocSnapshots} WHERE ${workoutDocSnapshots.userId} = ${uid}), 0)`,
        ),
      ),
    );
  return Number(rows[0]?.count ?? 0);
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
