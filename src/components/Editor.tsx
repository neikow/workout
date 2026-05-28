"use client";

import { useCallback, useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth-provider";
import { type SyncBundle } from "@/lib/sync";
import { useSyncStore } from "@/lib/sync-store";
import { fetchWorkoutDocument } from "@/lib/auth-client";
import { clearLocalContent, loadLocalContent } from "@/lib/storage";
import { useSynonyms } from "@/lib/synonyms";
import {
  GUEST_IDB_NAME,
  clearIdbDoc,
  docToText,
  readIdbDocText,
  sameContent,
  textToDoc,
} from "@/lib/ydoc-text";
import { mergeWorkoutText } from "@/lib/merge-workouts";
import { compileDateFormat } from "./editor/date-format";
import { ConflictModal, type ConflictChoice } from "./ConflictModal";
import { defaultRules } from "./editor/default-rules";
import { DayCard } from "./editor/day-card";
import {
  EXERCISE_HANDLE_EVENT,
  type ExerciseHandleEventDetail,
  ExerciseHandle,
} from "./editor/exercise-handle";
import {
  jumpToLastOccurrence,
  repeatLastSession,
} from "./editor/exercise-history";
import type { BlockContext } from "./editor/exercise-actions";
import { ExerciseMenu } from "./ExerciseMenu";
import { SynonymPickerModal } from "./SynonymPickerModal";
import {
  CONTEXT_META,
  WorkoutParser,
  parserPluginKey,
} from "./editor/workout-parser";
import { useAutocomplete } from "./editor/autocomplete/use-autocomplete";
import { SuggestionMenu } from "./editor/autocomplete/SuggestionMenu";
import { Toolbar } from "./Toolbar";
import { SearchModal } from "./SearchModal";

const WS_SYNC_TIMEOUT_MS = 4000;

export function Editor() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <EditorShell loading />;
  }

  const userId = auth.status === "authenticated" ? auth.user.id : null;
  return <EditorHost userId={userId} isAuthenticated={userId !== null} />;
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

function EditorHost({
  userId,
  isAuthenticated,
}: {
  userId: string | null;
  isAuthenticated: boolean;
}) {
  const { bundle, idbSynced, currentUserId, transition } = useSyncStore();

  useEffect(() => {
    if (currentUserId !== userId) {
      transition(userId);
    }
  }, [userId, currentUserId, transition]);

  if (!bundle || !idbSynced || currentUserId !== userId) {
    return <EditorShell loading />;
  }
  return <EditorBody bundle={bundle} isAuthenticated={isAuthenticated} />;
}

function EditorBody({
  bundle,
  isAuthenticated,
}: {
  bundle: SyncBundle;
  isAuthenticated: boolean;
}) {
  const settings = useSettings();
  const [searchOpen, setSearchOpen] = useState(false);
  const [conflict, setConflict] = useState<{
    local: string;
    cloud: string;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState<{
    blockFrom: number;
    anchorRect: DOMRect;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        WorkoutParser.configure({
          rules: defaultRules,
          initialContext: settings,
        }),
        DayCard,
        ExerciseHandle,
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
    const fragment = bundle.ydoc.getXmlFragment("default");
    let cancelled = false;

    const seed = async () => {
      if (fragment.length > 0) return;

      // Legacy local IDB blob (pre-yjs storage on this device).
      const legacyLocal = await loadLocalContent();
      if (cancelled) return;
      if (legacyLocal && legacyLocal.trim() && fragment.length === 0) {
        editor.commands.setContent(legacyLocal, { emitUpdate: true });
        void clearLocalContent();
        return;
      }

      // Legacy server blob — only relevant when authenticated and after the WS
      // provider has finished its initial sync (so the server-side Y doc is
      // genuinely empty before we seed). Bounded so we don't hang if the
      // sidecar is unreachable.
      if (!isAuthenticated) return;
      await bundle.whenWsSynced(WS_SYNC_TIMEOUT_MS);
      if (cancelled || fragment.length > 0) return;

      const cloud = await fetchWorkoutDocument().catch(() => null);
      if (cancelled || !cloud || !cloud.content.trim()) return;
      if (fragment.length > 0) return;
      editor.commands.setContent(cloud.content, { emitUpdate: true });
    };

    void seed();
    return () => {
      cancelled = true;
    };
  }, [editor, bundle, isAuthenticated]);

  // Reconcile this device's prior guest content with the synced account doc.
  // Empty cloud → migrate guest in. Same content → drop the guest copy.
  // Divergence → surface a resolution prompt so the CRDT can't silently merge
  // two separate plans. Runs only once the user IDB has loaded and the WS
  // provider has either synced or timed out.
  useEffect(() => {
    if (!editor || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const guestText = await readIdbDocText(GUEST_IDB_NAME);
      if (cancelled || !guestText.trim()) return;
      await bundle.whenWsSynced(WS_SYNC_TIMEOUT_MS);
      if (cancelled) return;
      const cloudText = docToText(bundle.ydoc);
      if (!cloudText.trim()) {
        editor.commands.setContent(textToDoc(guestText), { emitUpdate: true });
        await clearIdbDoc(GUEST_IDB_NAME);
        return;
      }
      if (sameContent(guestText, cloudText)) {
        await clearIdbDoc(GUEST_IDB_NAME);
        return;
      }
      if (!cancelled) setConflict({ local: guestText, cloud: cloudText });
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, bundle, isAuthenticated]);

  useEffect(() => {
    if (!editor) return;
    const current = parserPluginKey.getState(editor.state);
    if (current?.ctx === settings) return;
    editor.view.dispatch(editor.state.tr.setMeta(CONTEXT_META, settings));
  }, [editor, settings]);

  const resolveConflict = useCallback(
    async (choice: ConflictChoice) => {
      if (!editor || !conflict) return;
      if (choice === "local") {
        editor.commands.setContent(textToDoc(conflict.local), {
          emitUpdate: true,
        });
      } else if (choice === "merge") {
        const re = compileDateFormat(settings.dateFormat);
        const merged = mergeWorkoutText(conflict.local, conflict.cloud, (l) =>
          re.test(l.trim()),
        );
        editor.commands.setContent(textToDoc(merged), { emitUpdate: true });
      }
      await clearIdbDoc(GUEST_IDB_NAME);
      setConflict(null);
    },
    [editor, conflict, settings.dateFormat],
  );

  const synonyms = useSynonyms(bundle.ydoc);
  const { menu, accept, cycle } = useAutocomplete(editor, settings, synonyms);

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
      if (!editor) return;
      jumpToLastOccurrence(editor, ctx, synonyms);
    },
    [editor, synonyms],
  );

  const onRepeatLast = useCallback(
    (ctx: BlockContext) => {
      if (!editor) return;
      repeatLastSession(editor, ctx, synonyms, settings.dateFormat);
    },
    [editor, synonyms, settings.dateFormat],
  );

  if (!editor) return <EditorShell loading />;

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
          ydoc={bundle.ydoc}
          onSearchOpen={() => setSearchOpen(true)}
        />
      </header>
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
      <ExerciseMenu
        editor={editor}
        synonyms={synonyms}
        open={menuOpen}
        onClose={() => setMenuOpen(null)}
        onAddSynonym={onAddSynonym}
        onJumpLast={onJumpLast}
        onRepeatLast={onRepeatLast}
      />
      <SynonymPickerModal
        key={pickerOpen ?? "closed"}
        open={pickerOpen !== null}
        variant={pickerOpen ?? ""}
        groups={synonyms}
        ydoc={bundle.ydoc}
        onClose={() => setPickerOpen(null)}
      />
    </>
  );
}
