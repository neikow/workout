import type { Editor } from "@tiptap/react";
import { type EditorState, TextSelection } from "prosemirror-state";
import { getParserState } from "./workout-parser";
import {
  type BlockRange,
  collectDocItems,
  findDayBounds,
  findExerciseBlock,
  getBlockText,
  indexInDay,
  indexOfBlock,
  listAllExerciseBlocks,
  listExercisesInDay,
} from "./exercise-block";

export interface BlockContext {
  /** Block the menu was opened on. */
  block: BlockRange;
  /** Bounds of the block's enclosing day. */
  day: BlockRange;
  /** All exercise blocks in the same day, in document order. */
  siblings: BlockRange[];
  /** Position of `block` inside `siblings`. */
  positionInDay: number;
  /** Every exercise block in the doc (cross-day reorder uses this). */
  allBlocks: BlockRange[];
  /** Position of `block` inside `allBlocks`. */
  positionInAll: number;
  /** Plain text of the block's first paragraph (the exercise name). */
  name: string;
  /** Full text of the block (name + sets), newline-joined. */
  text: string;
}

/**
 * Resolve fresh block geometry from `from` — the menu might have been opened
 * a few keystrokes ago and the stored range may be stale by the time an
 * action fires. Walking the current doc keeps tr.replace calls safe.
 */
export function resolveBlockContext(
  state: EditorState,
  from: number,
): BlockContext | null {
  const kindMap = getParserState(state)?.kindByPos;
  if (!kindMap) return null;
  const items = collectDocItems(state.doc, kindMap);
  const block = findExerciseBlock(items, from);
  if (!block) return null;
  const day = findDayBounds(items, block.from);
  if (!day) return null;
  const siblings = listExercisesInDay(items, day);
  const positionInDay = indexInDay(siblings, block);
  const allBlocks = listAllExerciseBlocks(items);
  const positionInAll = indexOfBlock(allBlocks, block);
  return {
    block,
    day,
    siblings,
    positionInDay,
    allBlocks,
    positionInAll,
    name: items[block.firstItemIndex]!.text,
    text: getBlockText(items, block),
  };
}

/**
 * Splice the source block out of its current position and back in at
 * `dropPos`. Used by both the menu's move-up/down actions and the drag-and-
 * drop drop handler. The shift accounts for the source's range moving when
 * we insert before it.
 */
function moveBlock(editor: Editor, source: BlockRange, dropPos: number) {
  if (dropPos >= source.from && dropPos <= source.to) return;
  const { state } = editor;
  const slice = state.doc.slice(source.from, source.to);
  const tr = state.tr;
  tr.insert(dropPos, slice.content);
  const shift = dropPos <= source.from ? slice.content.size : 0;
  tr.delete(source.from + shift, source.to + shift);
  editor.view.dispatch(tr);
}

export function canMoveUp(ctx: BlockContext): boolean {
  return ctx.positionInAll > 0;
}

export function canMoveDown(ctx: BlockContext): boolean {
  return (
    ctx.positionInAll !== -1 && ctx.positionInAll < ctx.allBlocks.length - 1
  );
}

/**
 * Move the block to land immediately above the previous block in the
 * doc — including blocks belonging to the next-newer day. The block
 * picks up the new day's membership automatically because day-bounds are
 * computed from the surrounding date paragraphs.
 */
export function moveUp(editor: Editor, ctx: BlockContext): BlockContext | null {
  if (!canMoveUp(ctx)) return null;
  const prev = ctx.allBlocks[ctx.positionInAll - 1]!;
  moveBlock(editor, ctx.block, prev.from);
  return resolveBlockContext(editor.state, prev.from);
}

/** Move the block below the next block in the doc (possibly across days). */
export function moveDown(
  editor: Editor,
  ctx: BlockContext,
): BlockContext | null {
  if (!canMoveDown(ctx)) return null;
  const next = ctx.allBlocks[ctx.positionInAll + 1]!;
  moveBlock(editor, ctx.block, next.to);
  // After insert+delete the source ended up at next.to - source.size.
  const sourceSize = ctx.block.to - ctx.block.from;
  return resolveBlockContext(editor.state, next.to - sourceSize);
}

export function deleteBlock(editor: Editor, ctx: BlockContext): void {
  const { state } = editor;
  editor.view.dispatch(state.tr.delete(ctx.block.from, ctx.block.to));
}

export async function copyBlockText(ctx: BlockContext): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(ctx.text);
    return true;
  } catch (e) {
    console.error("[exercise-actions] clipboard write failed:", e);
    return false;
  }
}

/**
 * Insert a new empty exercise-name paragraph immediately before / after the
 * block. Caret lands inside the new paragraph so the user can start typing.
 */
function insertParagraphAt(editor: Editor, pos: number): void {
  const { state } = editor;
  const para = state.schema.nodes.paragraph!.createAndFill();
  if (!para) return;
  const tr = state.tr.insert(pos, para);
  // pos + 1 lands the caret one past the new paragraph's open token, i.e.
  // inside the empty paragraph rather than between siblings. Set selection
  // *before* dispatching so the same transaction commits position + insert.
  tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

export function insertExerciseAbove(editor: Editor, ctx: BlockContext): void {
  insertParagraphAt(editor, ctx.block.from);
}

export function insertExerciseBelow(editor: Editor, ctx: BlockContext): void {
  insertParagraphAt(editor, ctx.block.to);
}
