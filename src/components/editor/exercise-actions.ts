import type { Editor } from "@tiptap/react";
import { type EditorState, TextSelection } from "prosemirror-state";
import { Fragment } from "prosemirror-model";
import { getParserState } from "./workout-parser";
import {
  type BlockRange,
  collectDocItems,
  findDayBounds,
  findExerciseBlock,
  getBlockText,
  indexInDay,
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
  return {
    block,
    day,
    siblings,
    positionInDay,
    name: items[block.firstItemIndex]!.text,
    text: getBlockText(items, block),
  };
}

function swap(editor: Editor, earlier: BlockRange, later: BlockRange) {
  const { state } = editor;
  const { doc, tr } = state;
  // earlier.to === later.from for blocks listed by listExercisesInDay.
  const earlierContent = doc.slice(earlier.from, earlier.to).content;
  const laterContent = doc.slice(later.from, later.to).content;
  const combined = Fragment.empty.append(laterContent).append(earlierContent);
  tr.replaceWith(earlier.from, later.to, combined);
  editor.view.dispatch(tr);
}

export function canMoveUp(ctx: BlockContext): boolean {
  return ctx.positionInDay > 0;
}

export function canMoveDown(ctx: BlockContext): boolean {
  return (
    ctx.positionInDay !== -1 && ctx.positionInDay < ctx.siblings.length - 1
  );
}

export function moveUp(editor: Editor, ctx: BlockContext): BlockContext | null {
  if (!canMoveUp(ctx)) return null;
  const prev = ctx.siblings[ctx.positionInDay - 1]!;
  swap(editor, prev, ctx.block);
  return resolveBlockContext(editor.state, prev.from);
}

export function moveDown(
  editor: Editor,
  ctx: BlockContext,
): BlockContext | null {
  if (!canMoveDown(ctx)) return null;
  const next = ctx.siblings[ctx.positionInDay + 1]!;
  swap(editor, ctx.block, next);
  // After swap, ctx.block's content lives at the address `next` used to occupy.
  return resolveBlockContext(
    editor.state,
    ctx.block.from + next.to - next.from,
  );
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
