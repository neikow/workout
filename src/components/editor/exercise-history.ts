import type { Editor } from "@tiptap/react";
import type { EditorState } from "prosemirror-state";
import { Fragment } from "prosemirror-model";
import type { Schema } from "prosemirror-model";
import { findGroupFor, normalizeName, type SynonymGroup } from "@/lib/synonyms";
import { getParserState } from "./workout-parser";
import {
  type BlockRange,
  collectDocItems,
  type DocItem,
  findExerciseBlock,
  getBlockText,
} from "./exercise-block";
import type { BlockContext } from "./exercise-actions";

interface MatchResult {
  block: BlockRange;
  items: DocItem[];
}

/**
 * Strip optional segments (`[…]`) from a date format and substitute the
 * year/month/day tokens with `date`. Produces the same short form users
 * typically write day-to-day, so matching against doc text is exact.
 */
export function formatDateString(date: Date, format: string): string {
  const flat = format.replace(/\[[^\]]*\]/g, "");
  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MM: String(date.getMonth() + 1).padStart(2, "0"),
    DD: String(date.getDate()).padStart(2, "0"),
  };
  return flat.replace(/YYYY|YY|MM|DD/g, (m) => tokens[m]!);
}

/**
 * Match an exercise paragraph's name against the menu's target name —
 * direct normalized equality, or shared canonical group when one applies.
 */
function nameMatches(
  candidate: string,
  targetNorm: string,
  targetCanonical: string | null,
  synonyms: SynonymGroup[],
): boolean {
  const candNorm = normalizeName(candidate);
  if (candNorm === targetNorm) return true;
  if (!targetCanonical) return false;
  const candGroup = findGroupFor(candidate, synonyms);
  return (
    candGroup !== null && normalizeName(candGroup.canonical) === targetCanonical
  );
}

/**
 * The feed is most-recent-first, so a "prior occurrence" lives *after* the
 * current block in document order. Scan forward for the next exercise whose
 * name matches (directly or via the synonym registry).
 */
export function findLastOccurrenceBlock(
  state: EditorState,
  ctx: BlockContext,
  synonyms: SynonymGroup[],
): MatchResult | null {
  const kindByPos = getParserState(state)?.kindByPos;
  if (!kindByPos) return null;
  const items = collectDocItems(state.doc, kindByPos);
  const targetNorm = normalizeName(ctx.name);
  const targetGroup = findGroupFor(ctx.name, synonyms);
  const targetCanonical = targetGroup
    ? normalizeName(targetGroup.canonical)
    : null;

  for (let i = ctx.block.lastItemIndex + 1; i < items.length; i++) {
    if (items[i]!.kind !== "exercise") continue;
    if (!nameMatches(items[i]!.text, targetNorm, targetCanonical, synonyms)) {
      continue;
    }
    const block = findExerciseBlock(items, items[i]!.from);
    if (block) return { block, items };
  }
  return null;
}

export function jumpToLastOccurrence(
  editor: Editor,
  ctx: BlockContext,
  synonyms: SynonymGroup[],
): void {
  const last = findLastOccurrenceBlock(editor.state, ctx, synonyms);
  if (!last) {
    console.info("[exercise] no prior occurrence found");
    return;
  }
  const pos = last.block.from + 1;
  const dom = editor.view.domAtPos(pos);
  const node = dom.node;
  const el =
    node.nodeType === Node.TEXT_NODE
      ? (node.parentElement as HTMLElement | null)
      : (node as HTMLElement);
  if (!el) return;
  // Land the target ~15% from the top of the viewport — enough room above
  // for the day's date header to stay in context, no big empty space below
  // (which "block: center" produced).
  const rect = el.getBoundingClientRect();
  const targetTop = rect.top + window.scrollY - window.innerHeight * 0.15;
  window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  el.classList.add("exercise-flash");
  window.setTimeout(() => el.classList.remove("exercise-flash"), 1300);
}

function makeParagraph(schema: Schema, text: string) {
  const para = schema.nodes.paragraph!;
  if (text.length === 0) return para.create();
  return para.create(null, schema.text(text));
}

/**
 * Clone the last occurrence's set lines into a fresh exercise block placed
 * at the top of today's day-card. Today's date paragraph is inserted at the
 * very top of the doc if no matching one already exists.
 */
export function repeatLastSession(
  editor: Editor,
  ctx: BlockContext,
  synonyms: SynonymGroup[],
  dateFormat: string,
): void {
  const last = findLastOccurrenceBlock(editor.state, ctx, synonyms);
  if (!last) {
    console.info("[exercise] no prior occurrence to repeat");
    return;
  }

  const lastText = getBlockText(last.items, last.block);
  const lines = lastText.split("\n");
  // Drop the historical name; use the menu's current name so canonical wins
  // when the user invoked Repeat on the canonical itself.
  lines[0] = ctx.name;

  const todayStr = formatDateString(new Date(), dateFormat);
  const schema = editor.state.schema;

  const { state } = editor;
  const tr = state.tr;
  const kindByPos = getParserState(state)?.kindByPos;
  if (!kindByPos) return;
  const items = collectDocItems(state.doc, kindByPos);

  const todayNorm = normalizeName(todayStr);
  const todayItem = items.find(
    (it) => it.kind === "date" && normalizeName(it.text) === todayNorm,
  );

  let insertPos: number;
  let extraInsert = 0;
  if (todayItem) {
    insertPos = todayItem.to;
  } else {
    const dateNode = makeParagraph(schema, todayStr);
    tr.insert(0, dateNode);
    insertPos = dateNode.nodeSize;
    extraInsert = dateNode.nodeSize;
  }

  const paras = lines.map((line) => makeParagraph(schema, line));
  const fragment = Fragment.from(paras);
  tr.insert(insertPos, fragment);
  editor.view.dispatch(tr);

  // Move caret into the first line of the inserted block (the new name).
  editor.commands.focus(insertPos + 1 + (extraInsert > 0 ? 0 : 0));
}
