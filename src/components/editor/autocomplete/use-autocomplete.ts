"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import type { WorkoutContext } from "../types";
import { defaultProviders } from "./providers";
import type { Suggestion, SuggestionContext } from "./types";

export interface MenuState {
  suggestions: Suggestion[];
  range: { from: number; to: number };
  activeIndex: number;
  lineText: string;
  cursorTop: number;
  cursorBottom: number;
  cursorLeft: number;
  lineLeft: number;
}

function computeMenu(
  editor: Editor,
  settings: WorkoutContext,
): MenuState | null {
  const { $from, from, to } = editor.state.selection;
  if (from !== to) return null;

  const parent = $from.parent;
  if (parent.type.name !== "paragraph") return null;
  if (parent.attrs.kind !== "exercise") return null;

  const lineText = parent.textContent;
  if (!lineText.trim()) return null;

  // Don't suggest if exercise already has sets below it
  const indexInDoc = $from.index(0);
  const doc = editor.state.doc;
  if (indexInDoc + 1 < doc.childCount) {
    const next = doc.child(indexInDoc + 1);
    if (
      next.type.name === "paragraph" &&
      (next.attrs.kind === "warmup-set" || next.attrs.kind === "working-set")
    ) {
      return null;
    }
  }

  const linePos = $from.start();
  const ctx: SuggestionContext = {
    doc: editor.state.doc,
    linePos,
    lineKind: "exercise",
    lineText,
    workout: settings,
  };

  const suggestions: Suggestion[] = [];
  for (const provider of defaultProviders) {
    suggestions.push(...provider.getSuggestions(lineText, ctx));
  }
  if (!suggestions.length) return null;

  let cursorTop = 0;
  let cursorBottom = 0;
  let cursorLeft = 0;
  let lineLeft = 0;
  try {
    const cursor = editor.view.coordsAtPos(from);
    const lineStart = editor.view.coordsAtPos(linePos);
    cursorTop = Math.round(cursor.top);
    cursorBottom = Math.round(cursor.bottom);
    cursorLeft = Math.round(cursor.left);
    lineLeft = Math.round(lineStart.left);
  } catch {}

  return {
    suggestions,
    range: { from: linePos, to: $from.end() },
    activeIndex: 0,
    lineText,
    cursorTop,
    cursorBottom,
    cursorLeft,
    lineLeft,
  };
}

function suggestionIds(s: Suggestion[]) {
  return s.map((x) => x.id).join(",");
}

export function useAutocomplete(
  editor: Editor | null,
  settings: WorkoutContext,
) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    menuRef.current = menu;
  }, [menu]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const sync = useCallback(() => {
    if (!editor) {
      setMenu(null);
      return;
    }
    const next = computeMenu(editor, settingsRef.current);
    if (!next) {
      setMenu(null);
      return;
    }
    setMenu((prev) => {
      if (
        prev &&
        suggestionIds(prev.suggestions) === suggestionIds(next.suggestions)
      ) {
        return { ...next, activeIndex: prev.activeIndex };
      }
      return next;
    });
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.on("update", sync);
    editor.on("selectionUpdate", sync);
    return () => {
      editor.off("update", sync);
      editor.off("selectionUpdate", sync);
    };
  }, [editor, sync]);

  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (_view: EditorView, e: KeyboardEvent): boolean => {
      const m = menuRef.current;
      if (!m) return false;

      if (e.key === "ArrowDown") {
        setMenu((prev) =>
          prev
            ? {
                ...prev,
                activeIndex: (prev.activeIndex + 1) % prev.suggestions.length,
              }
            : null,
        );
        return true;
      }
      if (e.key === "ArrowUp") {
        setMenu((prev) =>
          prev
            ? {
                ...prev,
                activeIndex:
                  (prev.activeIndex - 1 + prev.suggestions.length) %
                  prev.suggestions.length,
              }
            : null,
        );
        return true;
      }
      if (e.key === "Enter") {
        const pick = m.suggestions[m.activeIndex];
        if (!pick) return false;
        setMenu(null);
        pick.apply(editor, m.range);
        return true;
      }
      if (e.key === "Escape") {
        setMenu(null);
        return true;
      }
      return false;
    };

    editor.setOptions({
      editorProps: { ...editor.options.editorProps, handleKeyDown },
    });

    return () => {
      const { handleKeyDown: _, ...rest } = editor.options.editorProps;
      void _;
      editor.setOptions({ editorProps: rest });
    };
  }, [editor]);

  const accept = useCallback(
    (index: number) => {
      const m = menuRef.current;
      if (!m || !editor) return;
      const pick = m.suggestions[index];
      if (!pick) return;
      setMenu(null);
      pick.apply(editor, m.range);
    },
    [editor],
  );

  const cycle = useCallback((delta: 1 | -1) => {
    setMenu((prev) => {
      if (!prev) return null;
      const next =
        (prev.activeIndex + delta + prev.suggestions.length) %
        prev.suggestions.length;
      return { ...prev, activeIndex: next };
    });
  }, []);

  return { menu, accept, cycle };
}
