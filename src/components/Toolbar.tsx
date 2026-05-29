"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import type * as Y from "yjs";
import { Search, Settings, UserRound } from "lucide-react";
import type { WorkoutContext } from "@/components/editor/types";
import { SettingsModal } from "./SettingsModal";
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
          <Search size={15} strokeWidth={1.75} aria-hidden />
        </Button>

        <div
          className="toolbar-divider"
          style={{ background: "var(--color-border-strong)" }}
          aria-hidden
        />

        <Link href="/profile" className="btn btn-icon" aria-label="Profile">
          <span style={{ position: "relative", display: "inline-flex" }}>
            <UserRound size={16} strokeWidth={1.75} aria-hidden />
            {auth.status === "authenticated" && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--color-accent)",
                  boxShadow: "0 0 0 2px var(--color-header-bg)",
                }}
              />
            )}
          </span>
        </Link>

        <Button
          variant="icon"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
        >
          <Settings size={16} strokeWidth={1.75} aria-hidden />
        </Button>
      </div>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        ydoc={ydoc}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
