import type { WorkoutContext } from "@/components/editor/types";
import { compileDateFormat } from "@/components/editor/date-format";
import { hashString } from "./hash";
import type { DaySegment } from "./types";

/** The horizontal-rule day separator, as serialised by docToText. */
const HR_MARKER = "---";

const dateReCache = new Map<string, RegExp>();
function dateRegex(format: string): RegExp {
  let re = dateReCache.get(format);
  if (!re) {
    re = compileDateFormat(format);
    dateReCache.set(format, re);
  }
  return re;
}

/**
 * Split the note text into day-segments. A day opens at a date line and runs
 * until the next date line or `---` separator. Content sitting outside any day
 * (before the first date, or orphaned after a separator) is dropped — only
 * dated training counts.
 *
 * Each segment carries a content hash so the aggregator can reuse the parse of
 * any day whose text is unchanged, even after exercises elsewhere are
 * reordered or edited.
 */
export function segmentDays(text: string, ctx: WorkoutContext): DaySegment[] {
  const isDate = dateRegex(ctx.dateFormat);
  const segments: DaySegment[] = [];

  let date: string | null = null;
  let lines: string[] = [];

  const flush = () => {
    if (date === null) return;
    const segText = lines.join("\n");
    segments.push({ date, text: segText, hash: hashString(segText) });
    date = null;
    lines = [];
  };

  for (const rawLine of text.split("\n")) {
    const trimmed = rawLine.trim();
    if (trimmed === HR_MARKER) {
      flush();
      continue;
    }
    if (isDate.test(trimmed)) {
      flush();
      date = trimmed;
      lines = [rawLine];
      continue;
    }
    if (date !== null) lines.push(rawLine);
  }
  flush();

  return segments;
}
