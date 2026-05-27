// Merge two divergent workout feeds into one, de-duplicating by day.
// A "day block" is a date line plus every line up to the next date line.
// When both feeds contain the same date, the local block wins (the user is
// resolving in favour of keeping their device's edits for that day). Blocks
// are re-ordered newest-first to match the feed convention.

interface Block {
  key: string; // trimmed date line, "" for pre-date preamble
  lines: string[];
  order: number; // sortable timestamp, descending
}

function dateOrder(dateLine: string): number {
  const nums = dateLine.match(/\d+/g);
  if (!nums) return 0;
  const [d, m, y] = nums.map(Number);
  const year = y == null ? new Date().getFullYear() : y < 100 ? 2000 + y : y;
  return year * 10000 + (m ?? 0) * 100 + (d ?? 0);
}

function splitBlocks(text: string, isDate: (line: string) => boolean): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const raw of text.split("\n")) {
    if (isDate(raw.trim())) {
      current = { key: raw.trim(), lines: [raw], order: dateOrder(raw) };
      blocks.push(current);
    } else if (current) {
      current.lines.push(raw);
    } else {
      const preamble = blocks.find((b) => b.key === "");
      if (preamble) preamble.lines.push(raw);
      else blocks.unshift({ key: "", lines: [raw], order: Infinity });
    }
  }
  return blocks;
}

function trimTrailingBlank(lines: string[]): string[] {
  const out = [...lines];
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  return out;
}

export function mergeWorkoutText(
  local: string,
  cloud: string,
  isDate: (line: string) => boolean,
): string {
  const byKey = new Map<string, Block>();
  // Local first so its version of a shared date takes precedence.
  for (const block of [
    ...splitBlocks(local, isDate),
    ...splitBlocks(cloud, isDate),
  ]) {
    if (!byKey.has(block.key)) byKey.set(block.key, block);
  }

  const blocks = [...byKey.values()].sort((a, b) => b.order - a.order);
  return blocks
    .map((b) => trimTrailingBlank(b.lines).join("\n"))
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
}
