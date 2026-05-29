import type { WorkoutContext } from "@/components/editor/types";
import type { SynonymGroup } from "@/lib/synonyms";

/** One day's worth of note text, fingerprinted so unchanged days are skipped. */
export interface DaySegment {
  /** The day's date line, trimmed (e.g. "27/05"). */
  date: string;
  /** Full segment text (date line + its exercise/set/comment lines). */
  text: string;
  /** cyrb53 of `text` — the cache key for this day's parse. */
  hash: string;
}

/** A single set/warmup line, reduced to the numbers stats care about. */
export interface SetSummary {
  raw: string;
  warmup: boolean;
  flagged: boolean;
  /** Heaviest weight on the line (most movements have one). Null if unweighted. */
  topWeight: number | null;
  totalReps: number;
  totalSets: number;
  volume: number;
  /** Best Epley estimate across the line's working movements. Null if none. */
  est1RM: number | null;
}

/** One exercise as it appears within a single day. */
export interface DayExercise {
  /** Raw name line, trimmed. */
  name: string;
  sets: SetSummary[];
}

/** Parsed projection of a DaySegment — pure function of its text + context. */
export interface ParsedDay {
  date: string;
  /** Sortable timestamp parsed from `date` via the active format; null if not. */
  time: number | null;
  exercises: DayExercise[];
}

/** One training session for a given exercise (a day it was performed). */
export interface SessionStat {
  date: string;
  /** Sortable timestamp parsed from `date`; null when unparseable. */
  time: number | null;
  sets: SetSummary[];
  topWeight: number | null;
  est1RM: number | null;
  volume: number;
  totalReps: number;
  totalSets: number;
  /** Set a new all-time best (chronologically) on this metric this session. */
  prTopWeight: boolean;
  prEst1RM: boolean;
  prVolume: boolean;
}

export interface PrRecord {
  value: number;
  date: string;
}

/** Everything the view needs for one canonical exercise. */
export interface ExerciseStats {
  /** Canonical key (normalized). Stable across synonyms. */
  key: string;
  /** Best human-facing label — canonical name, else the most recent spelling. */
  displayName: string;
  sessionCount: number;
  /** Most recent session date (display string). */
  lastDate: string;
  prTopWeight: PrRecord | null;
  prEst1RM: PrRecord | null;
  prVolume: PrRecord | null;
  /** Sessions most-recent-first (matching the note's feed order). */
  sessions: SessionStat[];
}

// ── Worker protocol ──────────────────────────────────────────────────────

export interface StatsRequest {
  segments: DaySegment[];
  ctx: WorkoutContext;
  synonyms: SynonymGroup[];
  /** Monotonic id so the hook can ignore stale replies. */
  requestId: number;
}

export interface StatsResponse {
  requestId: number;
  exercises: ExerciseStats[];
  /** Days re-parsed this run vs. served from cache — surfaced for transparency. */
  computedDays: number;
  cachedDays: number;
}
