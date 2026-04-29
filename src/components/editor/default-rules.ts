import { compileDateFormat } from "./date-format";
import type { WorkoutContext, WorkoutRule } from "./types";

const dateCache = new Map<string, RegExp>();
function dateRegex(format: string): RegExp {
  let re = dateCache.get(format);
  if (!re) {
    re = compileDateFormat(format);
    dateCache.set(format, re);
  }
  return re;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WORKING_SET_RE =
  /^\s*(?:-)?\d+(?:\.\d+)?(?:kg|lbs|lb|g)?\s*x\s*(?:\d+|\([^)]*\))/i;

export const dateRule: WorkoutRule = {
  name: "date",
  priority: 100,
  match(text, ctx) {
    return dateRegex(ctx.dateFormat).test(text.trim()) ? "date" : null;
  },
};

export const commentRule: WorkoutRule = {
  name: "comment",
  priority: 80,
  match(text) {
    return /^\s*'/.test(text) ? "comment" : null;
  },
};

export const warmupSetRule: WorkoutRule = {
  name: "warmup-set",
  priority: 70,
  match(text, ctx) {
    const marker = escapeRegex(ctx.warmupMarker);
    const re = new RegExp(`^\\s*${marker}\\s+.*`, "i");
    if (!re.test(text)) return null;
    const body = text.replace(new RegExp(`^\\s*${marker}\\s+`, "i"), "");
    return WORKING_SET_RE.test(body) ? "warmup-set" : null;
  },
};

export const workingSetRule: WorkoutRule = {
  name: "working-set",
  priority: 60,
  match(text) {
    return WORKING_SET_RE.test(text) ? "working-set" : null;
  },
};

export const exerciseNameRule: WorkoutRule = {
  name: "exercise",
  priority: 10,
  match(text) {
    return text.trim().length > 0 ? "exercise" : null;
  },
};

export const defaultRules: WorkoutRule[] = [
  dateRule,
  commentRule,
  warmupSetRule,
  workingSetRule,
  exerciseNameRule,
];

export function sortRules(rules: WorkoutRule[]): WorkoutRule[] {
  return [...rules].sort((a, b) => b.priority - a.priority);
}

export function classifyLine(
  text: string,
  sortedRules: WorkoutRule[],
  ctx: WorkoutContext,
) {
  for (const rule of sortedRules) {
    const kind = rule.match(text, ctx);
    if (kind) return kind;
  }
  return null;
}
