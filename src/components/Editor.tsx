"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth-provider";
import { fetchWorkoutDocument, putWorkoutDocument } from "@/lib/auth-client";
import { loadLocalContent, saveLocalContent } from "@/lib/storage";
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
import { SearchModal } from "./SearchModal";

const SAVE_DEBOUNCE_MS = 600;

type Source = "guest" | "server";

export function Editor() {
  const auth = useAuth();
  const source: Source | "loading" =
    auth.status === "loading"
      ? "loading"
      : auth.status === "authenticated"
        ? "server"
        : "guest";

  if (source === "loading") {
    return <EditorShell loading />;
  }

  return <EditorBody key={source} source={source} />;
}

function EditorShell({
  loading,
  children,
}: {
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <>
      <header
        className="editor-header"
        style={{
          background: "var(--color-header-bg)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h1>Workout</h1>
      </header>
      {loading ? (
        <div
          style={{
            padding: "2rem 1.25rem",
            color: "var(--color-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          Loading…
        </div>
      ) : (
        children
      )}
    </>
  );
}

function EditorBody({ source }: { source: Source }) {
  const settings = useSettings();
  const qc = useQueryClient();

  const serverDoc = useQuery({
    queryKey: ["workouts", "doc"],
    enabled: source === "server",
    queryFn: fetchWorkoutDocument,
  });

  const [guestContent, setGuestContent] = useState<string | null>(null);
  useEffect(() => {
    if (source !== "guest") return;
    let cancelled = false;
    loadLocalContent().then((c) => {
      if (cancelled) return;
      setGuestContent(c ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const initialContent =
    source === "guest"
      ? guestContent
      : serverDoc.data
        ? (serverDoc.data.content ?? "")
        : null;

  const ready = initialContent !== null;

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
      content: initialContent ?? "",
      editorProps: {
        attributes: {
          class: "workout-editor",
          spellcheck: "false",
          autocapitalize: "off",
        },
      },
    },
    [ready],
  );

  const putMutation = useMutation({
    mutationFn: putWorkoutDocument,
    onSuccess: (data) => {
      qc.setQueryData(["workouts", "doc"], (prev: unknown) => ({
        content: (prev as { content?: string } | undefined)?.content ?? "",
        updatedAt: data.updatedAt,
      }));
    },
  });

  const saveRef = useRef<(html: string) => void>(() => {});
  saveRef.current = (html: string) => {
    if (source === "guest") {
      void saveLocalContent(html);
    } else {
      putMutation.mutate(html);
    }
  };

  useEffect(() => {
    if (!editor) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveRef.current(editor.getHTML());
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
  const [searchOpen, setSearchOpen] = useState(false);

  if (!ready) {
    return <EditorShell loading />;
  }

  return (
    <>
      <header
        className="editor-header"
        style={{
          background: "var(--color-header-bg)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h1>Workout</h1>
        <Toolbar
          editor={editor}
          settings={settings}
          onSearchOpen={() => setSearchOpen(true)}
        />
      </header>
      <EditorContent editor={editor} />
      <SuggestionMenu menu={menu} onAccept={accept} onCycle={cycle} />
      <SearchModal
        open={searchOpen}
        editor={editor}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
