import type { WorkoutContext } from "@/components/editor/types";
import type { SynonymGroup } from "@/lib/synonyms";
import {
  classifyLine,
  defaultRules,
  sortRules,
} from "@/components/editor/default-rules";
import {
  parseSetLine,
  type ParsedSetLine,
} from "@/components/editor/set-parser";
import type {
  DaySegment,
  DayExercise,
  ExerciseStats,
  ParsedDay,
  PrRecord,
  SessionStat,
  SetSummary,
} from "./types";

const SORTED_RULES = sortRules(defaultRules);

// ── Name canonicalisation (pure — no dependency on the client synonyms hook) ─

/** Mirror of synonyms.normalizeName, duplicated so the worker stays React-free. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

interface Canonical {
  key: string;
  display: string;
  /** True when the label came from a synonym group's canonical name. */
  fromGroup: boolean;
}

function buildSynonymIndex(groups: SynonymGroup[]): Map<string, Canonical> {
  const index = new Map<string, Canonical>();
  for (const g of groups) {
    const canon: Canonical = {
      key: normalizeName(g.canonical),
      display: g.canonical,
      fromGroup: true,
    };
    index.set(canon.key, canon);
    for (const v of g.variants) index.set(normalizeName(v), canon);
  }
  return index;
}

function canonicalize(name: string, index: Map<string, Canonical>): Canonical {
  const norm = normalizeName(name);
  return (
    index.get(norm) ?? { key: norm, display: name.trim(), fromGroup: false }
  );
}

// ── Date parsing (for chronological ordering + sparkline x-axis) ─────────────

const DATE_TOKEN_RE = /YYYY|YY|MM|DD/g;
const DATE_TOKEN_PATTERN: Record<string, string> = {
  YYYY: "\\d{4}",
  YY: "\\d{2}",
  MM: "\\d{1,2}",
  DD: "\\d{1,2}",
};

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function compileCapturingSegment(segment: string, order: string[]): string {
  let out = "";
  let cursor = 0;
  for (const match of segment.matchAll(DATE_TOKEN_RE)) {
    const start = match.index!;
    out += escapeLiteral(segment.slice(cursor, start));
    out += `(${DATE_TOKEN_PATTERN[match[0]]})`;
    order.push(match[0]);
    cursor = start + match[0].length;
  }
  out += escapeLiteral(segment.slice(cursor));
  return out;
}

interface DateParser {
  re: RegExp;
  order: string[];
}

const parserCache = new Map<string, DateParser>();

function dateParser(format: string): DateParser {
  let cached = parserCache.get(format);
  if (cached) return cached;
  const order: string[] = [];
  let pattern = "";
  let buffer = "";
  let depth = 0;
  let optional = "";
  for (const ch of format) {
    if (ch === "[") {
      pattern += compileCapturingSegment(buffer, order);
      buffer = "";
      depth++;
      continue;
    }
    if (ch === "]" && depth > 0) {
      pattern += `(?:${compileCapturingSegment(optional + buffer, order)})?`;
      optional = "";
      buffer = "";
      depth--;
      continue;
    }
    if (depth > 0) optional += ch;
    else buffer += ch;
  }
  pattern += compileCapturingSegment(buffer, order);
  cached = { re: new RegExp(`^${pattern}$`), order };
  parserCache.set(format, cached);
  return cached;
}

/** Parse a date line into a sortable timestamp (local midnight), or null. */
export function parseDateToTime(date: string, format: string): number | null {
  const { re, order } = dateParser(format);
  const m = re.exec(date.trim());
  if (!m) return null;
  const now = new Date();
  let year = now.getFullYear();
  let month = 1;
  let day = 1;
  order.forEach((tok, i) => {
    const v = m[i + 1];
    if (v === undefined) return;
    const n = Number(v);
    if (tok === "YYYY") year = n;
    else if (tok === "YY") year = 2000 + n;
    else if (tok === "MM") month = n;
    else if (tok === "DD") day = n;
  });
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// ── Per-day parse ────────────────────────────────────────────────────────

/** Best Epley one-rep-max estimate across a parsed line's working movements. */
function estimate1RM(parsed: ParsedSetLine): number | null {
  let best: number | null = null;
  for (const mv of parsed.movements) {
    const w = mv.weight?.value;
    if (w === undefined || w <= 0) continue;
    for (const reps of mv.reps) {
      if (reps <= 0) continue;
      const est = w * (1 + reps / 30);
      if (best === null || est > best) best = est;
    }
  }
  return best;
}

function topWeightOf(parsed: ParsedSetLine): number | null {
  let max: number | null = null;
  for (const mv of parsed.movements) {
    if (mv.weight && (max === null || mv.weight.value > max)) {
      max = mv.weight.value;
    }
  }
  return max;
}

function summarizeSet(raw: string, body: string, warmup: boolean): SetSummary {
  const parsed = parseSetLine(body);
  if (!parsed.ok) {
    return {
      raw,
      warmup,
      flagged: parsed.flagged,
      topWeight: null,
      totalReps: 0,
      totalSets: 0,
      volume: 0,
      est1RM: null,
    };
  }
  return {
    raw,
    warmup,
    flagged: parsed.flagged,
    topWeight: topWeightOf(parsed),
    totalReps: parsed.totalReps,
    totalSets: parsed.totalSets,
    volume: parsed.volume,
    est1RM: estimate1RM(parsed),
  };
}

/** Parse one day-segment into its exercises. Pure in (text, ctx). */
export function parseDay(segment: DaySegment, ctx: WorkoutContext): ParsedDay {
  const markerRe = new RegExp(
    `^\\s*${ctx.warmupMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`,
    "i",
  );
  const exercises: DayExercise[] = [];
  let current: DayExercise | null = null;

  for (const line of segment.text.split("\n")) {
    const kind = classifyLine(line, SORTED_RULES, ctx);
    if (kind === "date") continue;
    if (kind === "exercise") {
      current = { name: line.trim(), sets: [] };
      exercises.push(current);
    } else if (kind === "working-set" && current) {
      current.sets.push(summarizeSet(line, line, false));
    } else if (kind === "warmup-set" && current) {
      const body = line.replace(markerRe, "");
      current.sets.push(summarizeSet(line, body, true));
    }
    // comments / nulls / orphan sets are ignored
  }
  return {
    date: segment.date,
    time: parseDateToTime(segment.date, ctx.dateFormat),
    exercises,
  };
}

// ── Aggregation across days ────────────────────────────────────────────────

interface SessionAcc {
  date: string;
  time: number | null;
  sets: SetSummary[];
}

interface ExerciseAcc {
  display: string;
  /** Whether `display` is locked to a synonym canonical (don't overwrite). */
  fromGroup: boolean;
  /** dayIndex → merged session (same exercise listed twice in a day merges). */
  byDay: Map<number, SessionAcc>;
}

function sessionMetrics(sets: SetSummary[]): {
  topWeight: number | null;
  est1RM: number | null;
  volume: number;
  totalReps: number;
  totalSets: number;
} {
  let topWeight: number | null = null;
  let est1RM: number | null = null;
  let volume = 0;
  let totalReps = 0;
  let totalSets = 0;
  for (const s of sets) {
    if (s.warmup) continue; // working sets only drive the headline numbers
    if (
      s.topWeight !== null &&
      (topWeight === null || s.topWeight > topWeight)
    ) {
      topWeight = s.topWeight;
    }
    if (s.est1RM !== null && (est1RM === null || s.est1RM > est1RM)) {
      est1RM = s.est1RM;
    }
    volume += s.volume;
    totalReps += s.totalReps;
    totalSets += s.totalSets;
  }
  return { topWeight, est1RM, volume, totalReps, totalSets };
}

/**
 * Build per-canonical-exercise stats from day parses given in note order
 * (most-recent-first). PRs are detected chronologically so a star marks the
 * session that actually set the record, regardless of feed order.
 */
export function aggregate(
  parsed: ParsedDay[],
  synonyms: SynonymGroup[],
): ExerciseStats[] {
  const index = buildSynonymIndex(synonyms);
  const accs = new Map<string, ExerciseAcc>();
  const order: string[] = []; // first-seen order, used as a stable tiebreaker

  parsed.forEach((day, dayIndex) => {
    for (const ex of day.exercises) {
      const canon = canonicalize(ex.name, index);
      let acc = accs.get(canon.key);
      if (!acc) {
        acc = {
          display: canon.display,
          fromGroup: canon.fromGroup,
          byDay: new Map(),
        };
        accs.set(canon.key, acc);
        order.push(canon.key);
      } else if (!acc.fromGroup && canon.fromGroup) {
        acc.display = canon.display;
        acc.fromGroup = true;
      }
      let session = acc.byDay.get(dayIndex);
      if (!session) {
        session = { date: day.date, time: day.time, sets: [] };
        acc.byDay.set(dayIndex, session);
      }
      session.sets.push(...ex.sets);
    }
  });

  const result: ExerciseStats[] = [];
  for (const key of order) {
    const acc = accs.get(key)!;
    result.push(finalizeExercise(key, acc));
  }

  // Most recently trained first; undated exercises fall to the back but keep
  // their first-seen order among themselves.
  result.sort((a, b) => {
    const ta = a.sessions[0]?.time ?? null;
    const tb = b.sessions[0]?.time ?? null;
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  });
  return result;
}

function finalizeExercise(key: string, acc: ExerciseAcc): ExerciseStats {
  // dayIndex ascending == note order == most-recent-first.
  const docOrder = [...acc.byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, s]) => toSessionStat(s));

  // Chronological ascending for PR detection: trust dates when every session
  // has one, else assume the feed's most-recent-first order is reliable.
  const chrono = [...docOrder];
  if (chrono.every((s) => s.time !== null)) {
    chrono.sort((a, b) => a.time! - b.time!);
  } else {
    chrono.reverse();
  }

  let prTopWeight: PrRecord | null = null;
  let prEst1RM: PrRecord | null = null;
  let prVolume: PrRecord | null = null;
  for (const s of chrono) {
    if (
      s.topWeight !== null &&
      (!prTopWeight || s.topWeight > prTopWeight.value)
    ) {
      prTopWeight = { value: s.topWeight, date: s.date };
      s.prTopWeight = true;
    }
    if (s.est1RM !== null && (!prEst1RM || s.est1RM > prEst1RM.value)) {
      prEst1RM = { value: s.est1RM, date: s.date };
      s.prEst1RM = true;
    }
    if (s.volume > 0 && (!prVolume || s.volume > prVolume.value)) {
      prVolume = { value: s.volume, date: s.date };
      s.prVolume = true;
    }
  }

  return {
    key,
    displayName: acc.display,
    sessionCount: docOrder.length,
    lastDate: docOrder[0]?.date ?? "",
    prTopWeight,
    prEst1RM,
    prVolume,
    sessions: docOrder,
  };
}

function toSessionStat(s: SessionAcc): SessionStat {
  const m = sessionMetrics(s.sets);
  return {
    date: s.date,
    time: s.time,
    sets: s.sets,
    topWeight: m.topWeight,
    est1RM: m.est1RM,
    volume: m.volume,
    totalReps: m.totalReps,
    totalSets: m.totalSets,
    prTopWeight: false,
    prEst1RM: false,
    prVolume: false,
  };
}
