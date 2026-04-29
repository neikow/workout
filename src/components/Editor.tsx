"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useSettings } from "@/lib/settings";
import { defaultRules } from "./editor/default-rules";
import { DayCard } from "./editor/day-card";
import { WorkoutParagraph } from "./editor/workout-paragraph";
import {
  CONTEXT_META,
  WorkoutParser,
  parserPluginKey,
} from "./editor/workout-parser";
import { useAutocomplete } from "./editor/autocomplete/use-autocomplete";
import { SuggestionMenu } from "./editor/autocomplete/SuggestionMenu";
import { Toolbar } from "./Toolbar";

const CONTENT_KEY = "workout:content-v1";
const SAVE_DEBOUNCE_MS = 300;

const SEED_CONTENT = `<p>23/04</p><p>Bench press (close grip)</p><p>E 20kg x 10 x 2</p><p>60kg x 8 x 3</p><p></p>`;

function loadContent(): string {
  if (typeof window === "undefined") return SEED_CONTENT;
  try {
    return window.localStorage.getItem(CONTENT_KEY) ?? SEED_CONTENT;
  } catch {
    return SEED_CONTENT;
  }
}

export function Editor() {
  const settings = useSettings();
  const [initialContent] = useState(loadContent);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ paragraph: false }),
        WorkoutParagraph,
        DayCard,
        WorkoutParser.configure({
          rules: defaultRules,
          initialContext: settings,
        }),
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class: "workout-editor",
          spellcheck: "false",
          autocapitalize: "off",
        },
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        try {
          window.localStorage.setItem(CONTENT_KEY, editor.getHTML());
        } catch {}
      }, SAVE_DEBOUNCE_MS);
    };
    editor.on("update", onUpdate);
    return () => {
      if (timeout) clearTimeout(timeout);
      editor.off("update", onUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const current = parserPluginKey.getState(editor.state);
    if (current === settings) return;
    editor.view.dispatch(editor.state.tr.setMeta(CONTEXT_META, settings));
  }, [editor, settings]);

  const { menu, accept, cycle } = useAutocomplete(editor, settings);

  return (
    <>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 backdrop-blur"
        style={{
          background: "var(--color-header-bg)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          Workout
        </h1>
        <Toolbar editor={editor} settings={settings} />
      </header>
      <EditorContent editor={editor} />
      <SuggestionMenu menu={menu} onAccept={accept} onCycle={cycle} />
    </>
  );
}
