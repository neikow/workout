"use client";

import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { SynonymGroup } from "@/lib/synonyms";
import type { BlockContext } from "./exercise-actions";
import {
  EXERCISE_HANDLE_EVENT,
  type ExerciseHandleEventDetail,
} from "./exercise-handle";
import { jumpToLastOccurrence, repeatLastSession } from "./exercise-history";
import { setPrRecordsSynonyms } from "./pr-records";

export interface MenuAnchor {
  blockFrom: number;
  anchorRect: DOMRect;
}

export interface ExerciseMenuState {
  menuOpen: MenuAnchor | null;
  pickerOpen: string | null;
  closeMenu: () => void;
  closePicker: () => void;
  onAddSynonym: (ctx: BlockContext) => void;
  onJumpLast: (ctx: BlockContext) => void;
  onRepeatLast: (ctx: BlockContext) => void;
}

/**
 * Wire up the per-exercise action menu: listen for the drag-handle's open
 * event, track which block the menu / synonym picker target, and expose the
 * history actions. Also keeps the PR decorations fed with the latest synonyms.
 */
export function useExerciseMenu(
  editor: Editor | null,
  synonyms: SynonymGroup[],
  dateFormat: string,
): ExerciseMenuState {
  const [menuOpen, setMenuOpen] = useState<MenuAnchor | null>(null);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    setPrRecordsSynonyms(editor.view, synonyms);
  }, [editor, synonyms]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onHandle = (e: Event) => {
      const detail = (e as CustomEvent<ExerciseHandleEventDetail>).detail;
      setMenuOpen({ blockFrom: detail.from, anchorRect: detail.anchorRect });
    };
    dom.addEventListener(EXERCISE_HANDLE_EVENT, onHandle);
    return () => dom.removeEventListener(EXERCISE_HANDLE_EVENT, onHandle);
  }, [editor]);

  const onAddSynonym = useCallback((ctx: BlockContext) => {
    setPickerOpen(ctx.name);
  }, []);

  const onJumpLast = useCallback(
    (ctx: BlockContext) => {
      if (editor) jumpToLastOccurrence(editor, ctx, synonyms);
    },
    [editor, synonyms],
  );

  const onRepeatLast = useCallback(
    (ctx: BlockContext) => {
      if (editor) repeatLastSession(editor, ctx, synonyms, dateFormat);
    },
    [editor, synonyms, dateFormat],
  );

  return {
    menuOpen,
    pickerOpen,
    closeMenu: useCallback(() => setMenuOpen(null), []),
    closePicker: useCallback(() => setPickerOpen(null), []),
    onAddSynonym,
    onJumpLast,
    onRepeatLast,
  };
}
