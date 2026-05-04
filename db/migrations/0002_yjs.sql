-- Yjs CRDT persistence: append-only update log + periodic snapshots.
-- The legacy single-blob workout_documents table is kept in place; it acts as
-- a one-time seed source for users who existed before sync, and is dropped in
-- a follow-up migration once the sidecar has been live long enough to confirm
-- every active user has a snapshot row.

CREATE TABLE IF NOT EXISTS workout_doc_snapshots (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state BYTEA NOT NULL,
  through_seq BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_doc_updates (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seq BIGSERIAL,
  update BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, seq)
);

CREATE INDEX IF NOT EXISTS workout_doc_updates_user_seq_idx
  ON workout_doc_updates (user_id, seq);
