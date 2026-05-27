"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type * as Y from "yjs";
import type { WorkoutContext } from "@/components/editor/types";
import { SettingsModal } from "./SettingsModal";
import { AccountModal } from "./AccountModal";
import { Button } from "./ui/Button";
import { useAuth } from "@/lib/auth-provider";

function formatDateEntry(date: Date, format: string): string {
  const required = format.replace(/\[.*?\]/g, "");
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return required
    .replace("DD", dd)
    .replace("MM", mm)
    .replace("YYYY", yyyy)
    .replace("YY", yyyy.slice(-2));
}

function insertEntry(editor: Editor, dateStr: string) {
  const firstNode = editor.state.doc.firstChild;
  const alreadyHasDate =
    firstNode?.type.name === "paragraph" &&
    firstNode.textContent.trim() === dateStr;

  const html = alreadyHasDate ? `<p>${dateStr}</p><hr>` : `<p>${dateStr}</p>`;

  editor.chain().insertContentAt(0, html).focus("start").run();
}

interface Props {
  editor: Editor | null;
  settings: WorkoutContext;
  ydoc: Y.Doc;
  onSearchOpen: () => void;
}

export function Toolbar({ editor, settings, ydoc, onSearchOpen }: Props) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const auth = useAuth();

  function handleNew() {
    if (!editor) return;
    insertEntry(editor, formatDateEntry(new Date(), settings.dateFormat));
  }

  function handleProgramChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editor || !e.target.value) return;
    const [year, month, day] = e.target.value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    insertEntry(editor, formatDateEntry(date, settings.dateFormat));
    e.target.value = "";
  }

  function handleProgram() {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      input.click();
    }
  }

  return (
    <>
      <div className="toolbar-actions">
        <Button variant="ghost" onClick={handleNew}>
          New
        </Button>

        <Button variant="ghost" onClick={handleProgram}>
          Program
        </Button>
        <input
          ref={dateInputRef}
          type="date"
          className="sr-only"
          onChange={handleProgramChange}
          tabIndex={-1}
        />

        <Button
          variant="icon"
          onClick={onSearchOpen}
          aria-label="Search exercises"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="6.5" cy="6.5" r="5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" />
          </svg>
        </Button>

        <div
          className="toolbar-divider"
          style={{ background: "var(--color-border-strong)" }}
          aria-hidden
        />

        <Button
          variant="icon"
          onClick={() => setAccountOpen(true)}
          aria-label="Account"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" />
            {auth.status === "authenticated" && (
              <circle
                cx="19"
                cy="5"
                r="2.25"
                fill="var(--color-accent)"
                stroke="none"
              />
            )}
          </svg>
        </Button>

        <Button
          variant="icon"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Button>
      </div>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        ydoc={ydoc}
        onClose={() => setSettingsOpen(false)}
      />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}
