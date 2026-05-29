import type { Node as PMNode } from "prosemirror-model";
import type { LineKind } from "./types";

export type ItemKind = LineKind | "hr" | null;

export interface DocItem {
  /** Absolute start position of the node in the doc. */
  from: number;
  /** Absolute end position of the node (exclusive) — `from + node.nodeSize`. */
  to: number;
  kind: ItemKind;
  /** Plain text content of paragraphs; empty for horizontalRule. */
  text: string;
}

export interface BlockRange {
  from: number;
  to: number;
  firstItemIndex: number;
  lastItemIndex: number;
}

/**
 * Project the top-level doc layout into a flat ordered list of "items"
 * (paragraphs + horizontalRules) keyed by their absolute positions. Anything
 * deeper than the top level is ignored — the workout doc only uses flat
 * paragraphs and the horizontal-rule separator.
 */
export function collectDocItems(
  doc: PMNode,
  kindByPos: Map<number, LineKind | null>,
): DocItem[] {
  const out: DocItem[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === "horizontalRule") {
      out.push({
        from: offset,
        to: offset + node.nodeSize,
        kind: "hr",
        text: "",
      });
    } else if (node.type.name === "paragraph") {
      out.push({
        from: offset,
        to: offset + node.nodeSize,
        kind: kindByPos.get(offset) ?? null,
        text: node.textContent,
      });
    }
  });
  return out;
}

function itemIndexAt(items: DocItem[], pos: number): number {
  return items.findIndex((it) => pos >= it.from && pos < it.to);
}

/**
 * Walk back from `pos` to the nearest exercise-name paragraph, then forward
 * through its trailing set/warmup/comment paragraphs until the next
 * exercise/date/hr boundary. Returns null when no enclosing exercise block
 * exists (e.g. caret on a date row).
 */
export function findExerciseBlock(
  items: DocItem[],
  pos: number,
): BlockRange | null {
  const idx = itemIndexAt(items, pos);
  if (idx === -1) return null;

  let startIdx = idx;
  while (startIdx >= 0) {
    const k = items[startIdx]!.kind;
    if (k === "exercise") break;
    // A circuit is its own grouped block, never part of an exercise.
    if (k === "date" || k === "hr" || k === "circuit") return null;
    startIdx--;
  }
  if (startIdx < 0) return null;

  let endIdx = startIdx;
  for (let i = startIdx + 1; i < items.length; i++) {
    const k = items[i]!.kind;
    if (k === "exercise" || k === "date" || k === "hr" || k === "circuit")
      break;
    endIdx = i;
  }

  return {
    from: items[startIdx]!.from,
    to: items[endIdx]!.to,
    firstItemIndex: startIdx,
    lastItemIndex: endIdx,
  };
}

/**
 * Walk back to the nearest date paragraph (the day header), then forward
 * until the next date or horizontalRule. Returns null when `pos` sits
 * outside any day (e.g. before the first date).
 */
export function findDayBounds(
  items: DocItem[],
  pos: number,
): BlockRange | null {
  const idx = itemIndexAt(items, pos);
  if (idx === -1) return null;

  let startIdx = idx;
  while (startIdx >= 0) {
    const k = items[startIdx]!.kind;
    if (k === "date") break;
    if (k === "hr") return null;
    startIdx--;
  }
  if (startIdx < 0) return null;

  let endIdx = startIdx;
  for (let i = startIdx + 1; i < items.length; i++) {
    const k = items[i]!.kind;
    if (k === "date" || k === "hr") break;
    endIdx = i;
  }

  return {
    from: items[startIdx]!.from,
    to: items[endIdx]!.to,
    firstItemIndex: startIdx,
    lastItemIndex: endIdx,
  };
}

/** All exercise blocks contained inside `day`, in document order. */
export function listExercisesInDay(
  items: DocItem[],
  day: BlockRange,
): BlockRange[] {
  const out: BlockRange[] = [];
  for (let i = day.firstItemIndex; i <= day.lastItemIndex; i++) {
    if (items[i]!.kind === "exercise") {
      const block = findExerciseBlock(items, items[i]!.from);
      if (block) {
        out.push(block);
        i = block.lastItemIndex; // skip ahead — we've consumed the trailing sets
      }
    }
  }
  return out;
}

/** Join the block's paragraph text content with newlines. */
export function getBlockText(items: DocItem[], block: BlockRange): string {
  const lines: string[] = [];
  for (let i = block.firstItemIndex; i <= block.lastItemIndex; i++) {
    lines.push(items[i]!.text);
  }
  return lines.join("\n");
}

/** Block index inside its day (0-based, by document order). */
export function indexInDay(exercises: BlockRange[], block: BlockRange): number {
  return exercises.findIndex((b) => b.from === block.from && b.to === block.to);
}

/** Every exercise block in the doc, in document order (across all days). */
export function listAllExerciseBlocks(items: DocItem[]): BlockRange[] {
  const out: BlockRange[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i]!.kind === "exercise") {
      const block = findExerciseBlock(items, items[i]!.from);
      if (block) {
        out.push(block);
        i = block.lastItemIndex;
      }
    }
  }
  return out;
}

/** Find a block's index in a flat-ordered list. */
export function indexOfBlock(blocks: BlockRange[], block: BlockRange): number {
  return blocks.findIndex((b) => b.from === block.from && b.to === block.to);
}
