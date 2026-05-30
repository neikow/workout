"use client";

import { useEffect } from "react";
import { type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import type { SyncBundle } from "@/lib/sync";
import type { WorkoutContext } from "./types";
import { defaultRules } from "./default-rules";
import { DayCard } from "./day-card";
import { ExerciseHandle } from "./exercise-handle";
import { PrRecords } from "./pr-records";
import { CONTEXT_META, WorkoutParser, getParserState } from "./workout-parser";

/**
 * Build the TipTap editor bound to a sync bundle's collaborative document, and
 * keep the parser plugin's context in step with the user's settings. The editor
 * is rebuilt whenever the bundle changes (e.g. on sign-in / sign-out).
 */
export function useWorkoutEditor(
  bundle: SyncBundle,
  settings: WorkoutContext,
): Editor | null {
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        // Disable PM's built-in dropcursor — the exercise-handle plugin paints
        // its own indicator and stacking both gives a white + blue line.
        StarterKit.configure({ undoRedo: false, dropcursor: false }),
        WorkoutParser.configure({
          rules: defaultRules,
          initialContext: settings,
        }),
        DayCard,
        ExerciseHandle,
        PrRecords,
        Collaboration.configure({ document: bundle.ydoc }),
      ],
      editorProps: {
        attributes: {
          class: "workout-editor",
          spellcheck: "false",
          autocapitalize: "off",
        },
      },
    },
    [bundle],
  );

  useEffect(() => {
    if (!editor) return;
    // `getParserState` looks the plugin up by name so it survives Turbopack
    // serving the PluginKey module from two distinct chunks in dev.
    const current = getParserState(editor.state);
    if (current?.ctx === settings) return;
    editor.view.dispatch(editor.state.tr.setMeta(CONTEXT_META, settings));
  }, [editor, settings]);

  return editor;
}
