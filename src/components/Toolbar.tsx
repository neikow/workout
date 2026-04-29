"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { WorkoutContext } from "@/components/editor/types";
import { SettingsModal } from "./SettingsModal";
import { Button } from "./ui/Button";

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

  const html = alreadyHasDate
    ? `<p>${dateStr}</p><hr>`
    : `<p>${dateStr}</p>`;

  editor.chain().insertContentAt(0, html).focus("start").run();
}

interface Props {
  editor: Editor | null;
  settings: WorkoutContext;
}

export function Toolbar({ editor, settings }: Props) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" onClick={handleNew}>
          New
        </Button>

        <Button variant="ghost" onClick={() => dateInputRef.current?.click()}>
          Program
        </Button>
        <input
          ref={dateInputRef}
          type="date"
          className="sr-only"
          onChange={handleProgramChange}
          tabIndex={-1}
        />

        <div
          className="mx-1.5 h-3.5 w-px"
          style={{ background: "var(--color-border-strong)" }}
          aria-hidden
        />

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
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
