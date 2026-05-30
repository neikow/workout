"use client";

import { useState } from "react";
import { EditorContent } from "@tiptap/react";
import { useSettings } from "@/lib/settings";
import { useSyncedBundle } from "@/lib/use-synced-bundle";
import { useSynonyms } from "@/lib/synonyms";
import { useIsTouchDevice } from "@/lib/use-touch-device";
import type { SyncBundle } from "@/lib/sync";
import { ConflictModal } from "./ConflictModal";
import { ExerciseMenu } from "./ExerciseMenu";
import { ExerciseBottomSheet } from "./ExerciseBottomSheet";
import { SynonymPickerModal } from "./SynonymPickerModal";
import { Toolbar } from "./Toolbar";
import { SearchModal } from "./SearchModal";
import { SuggestionMenu } from "./editor/autocomplete/SuggestionMenu";
import { useAutocomplete } from "./editor/autocomplete/use-autocomplete";
import { useWorkoutEditor } from "./editor/use-workout-editor";
import { useExerciseMenu } from "./editor/use-exercise-menu";
import { useDocumentBootstrap } from "./editor/use-document-bootstrap";

export function Editor() {
  const synced = useSyncedBundle();
  if (synced.status === "loading") return <EditorShell loading />;
  return (
    <EditorBody
      bundle={synced.bundle}
      isAuthenticated={synced.isAuthenticated}
    />
  );
}

function EditorHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header
      className="editor-header"
      style={{
        background: "var(--color-header-bg)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <h1>Workout</h1>
      {children}
    </header>
  );
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
      <EditorHeader />
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

function EditorBody({
  bundle,
  isAuthenticated,
}: {
  bundle: SyncBundle;
  isAuthenticated: boolean;
}) {
  const settings = useSettings();
  const isTouch = useIsTouchDevice();
  const [searchOpen, setSearchOpen] = useState(false);

  const editor = useWorkoutEditor(bundle, settings);
  const { conflict, resolveConflict } = useDocumentBootstrap(
    editor,
    bundle,
    isAuthenticated,
    settings.dateFormat,
  );

  const synonyms = useSynonyms(bundle.ydoc);
  const { menu, accept, cycle } = useAutocomplete(editor, settings, synonyms);
  const exerciseMenu = useExerciseMenu(editor, synonyms, settings.dateFormat);

  if (!editor) return <EditorShell loading />;

  return (
    <>
      <EditorHeader>
        <Toolbar
          editor={editor}
          settings={settings}
          ydoc={bundle.ydoc}
          onSearchOpen={() => setSearchOpen(true)}
        />
      </EditorHeader>
      <EditorContent editor={editor} />
      {conflict && (
        <ConflictModal
          localText={conflict.local}
          cloudText={conflict.cloud}
          onResolve={resolveConflict}
        />
      )}
      <SuggestionMenu menu={menu} onAccept={accept} onCycle={cycle} />
      <SearchModal
        open={searchOpen}
        editor={editor}
        onClose={() => setSearchOpen(false)}
      />
      {isTouch ? (
        <ExerciseBottomSheet
          editor={editor}
          synonyms={synonyms}
          open={
            exerciseMenu.menuOpen
              ? { blockFrom: exerciseMenu.menuOpen.blockFrom }
              : null
          }
          onClose={exerciseMenu.closeMenu}
          onAddSynonym={exerciseMenu.onAddSynonym}
          onJumpLast={exerciseMenu.onJumpLast}
          onRepeatLast={exerciseMenu.onRepeatLast}
        />
      ) : (
        <ExerciseMenu
          editor={editor}
          synonyms={synonyms}
          open={exerciseMenu.menuOpen}
          onClose={exerciseMenu.closeMenu}
          onAddSynonym={exerciseMenu.onAddSynonym}
          onJumpLast={exerciseMenu.onJumpLast}
          onRepeatLast={exerciseMenu.onRepeatLast}
        />
      )}
      <SynonymPickerModal
        key={exerciseMenu.pickerOpen ?? "closed"}
        open={exerciseMenu.pickerOpen !== null}
        variant={exerciseMenu.pickerOpen ?? ""}
        groups={synonyms}
        ydoc={bundle.ydoc}
        onClose={exerciseMenu.closePicker}
      />
    </>
  );
}
