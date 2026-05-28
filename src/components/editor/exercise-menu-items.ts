import type { Editor } from "@tiptap/react";
import { canonicalFor, findGroupFor, type SynonymGroup } from "@/lib/synonyms";
import {
  type BlockContext,
  canMoveDown,
  canMoveUp,
  copyBlockText,
  deleteBlock,
  insertExerciseAbove,
  insertExerciseBelow,
  moveDown,
  moveUp,
} from "./exercise-actions";

export interface MenuItemSpec {
  key: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  destructive?: boolean;
  run(): void;
}

interface BuildArgs {
  editor: Editor;
  ctx: BlockContext;
  synonyms: SynonymGroup[];
  onAddSynonym(ctx: BlockContext): void;
  onJumpLast(ctx: BlockContext): void;
  onRepeatLast(ctx: BlockContext): void;
  onClose(): void;
}

export function buildExerciseMenuItems({
  editor,
  ctx,
  synonyms,
  onAddSynonym,
  onJumpLast,
  onRepeatLast,
  onClose,
}: BuildArgs): MenuItemSpec[] {
  const group = findGroupFor(ctx.name, synonyms);
  const variantOf = canonicalFor(ctx.name, synonyms);
  const synonymLabel = group
    ? variantOf
      ? `Add synonym — currently a variant of ${group.canonical}`
      : `Add synonym to ${group.canonical}`
    : "Add synonym…";

  const close = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return [
    {
      key: "up",
      label: "Move up",
      hint: "⌥↑",
      disabled: !canMoveUp(ctx),
      run: close(() => moveUp(editor, ctx)),
    },
    {
      key: "down",
      label: "Move down",
      hint: "⌥↓",
      disabled: !canMoveDown(ctx),
      run: close(() => moveDown(editor, ctx)),
    },
    {
      key: "above",
      label: "Insert exercise above",
      run: close(() => insertExerciseAbove(editor, ctx)),
    },
    {
      key: "below",
      label: "Insert exercise below",
      run: close(() => insertExerciseBelow(editor, ctx)),
    },
    {
      key: "copy",
      label: "Copy text",
      run: close(() => {
        void copyBlockText(ctx);
      }),
    },
    {
      key: "synonym",
      label: synonymLabel,
      run: close(() => onAddSynonym(ctx)),
    },
    {
      key: "jump",
      label: "Jump to last occurrence",
      run: close(() => onJumpLast(ctx)),
    },
    {
      key: "repeat",
      label: "Repeat last session",
      run: close(() => onRepeatLast(ctx)),
    },
    {
      key: "delete",
      label: "Delete",
      destructive: true,
      run: close(() => deleteBlock(editor, ctx)),
    },
  ];
}
