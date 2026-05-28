"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { Search, X } from "lucide-react";
import {
  buildExerciseIndex,
  normalizeName,
} from "./editor/autocomplete/doc-index";
import { getKindGetter } from "./editor/workout-parser";
import { Button } from "./ui/Button";

interface Props {
  open: boolean;
  editor: Editor | null;
  onClose: () => void;
}

export function SearchModal({ open, editor, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setQuery("");
  }

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
      // Defer focus so dialog is fully rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  const exercises = useMemo(() => {
    if (!editor || !open) return [];
    const index = buildExerciseIndex(
      editor.state.doc,
      getKindGetter(editor.state),
    );
    return Array.from(index.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [editor, open]);

  const filtered = useMemo(() => {
    const q = normalizeName(query);
    if (!q) return exercises;
    return exercises
      .filter((e) => e.normalizedName.includes(q))
      .sort((a, b) => {
        const aStarts = a.normalizedName.startsWith(q);
        const bStarts = b.normalizedName.startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [exercises, query]);

  function handleSelect(pos: number) {
    onClose();
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
      className="settings-dialog"
    >
      <div
        className="settings-header"
        style={{
          borderBottom: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <span className="settings-title">Search exercises</span>
        <Button variant="icon" onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={1.5} aria-hidden />
        </Button>
      </div>

      <div style={{ padding: "0.75rem 1.25rem 0.5rem" }}>
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            strokeWidth={1.75}
            aria-hidden
            style={{
              position: "absolute",
              left: "0.625rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            ref={inputRef}
            type="text"
            className="field-input"
            placeholder="Exercise name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: "2rem" }}
          />
        </div>
      </div>

      <div
        style={{
          overflowY: "auto",
          maxHeight: "55dvh",
          padding: "0.25rem 0 0.75rem",
        }}
      >
        {filtered.length === 0 && (
          <p
            style={{
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "0.8125rem",
              padding: "1.5rem 1.25rem",
              margin: 0,
            }}
          >
            No exercises found
          </p>
        )}
        {filtered.map((entry) => (
          <button
            key={entry.normalizedName}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(entry.contentStart);
            }}
            onClick={() => handleSelect(entry.contentStart)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.5rem 1.25rem",
              color: "var(--color-text)",
              fontFamily: "var(--font-jetbrains, monospace)",
              fontSize: "0.9rem",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--color-ghost-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <span style={{ color: "var(--color-exercise)", fontWeight: 700 }}>
              {entry.displayName}
            </span>
            {entry.lastSets.length > 0 && (
              <span
                style={{
                  display: "block",
                  color: "var(--color-text-muted)",
                  fontSize: "0.8rem",
                  marginTop: "0.125rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {entry.lastSets.slice(0, 2).join(" · ")}
              </span>
            )}
          </button>
        ))}
      </div>
    </dialog>
  );
}
