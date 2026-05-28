"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { canonicalFor, findGroupFor, type SynonymGroup } from "@/lib/synonyms";
import {
  type BlockContext,
  canMoveDown,
  canMoveUp,
  copyBlockText,
  deleteBlock,
  insertExerciseAbove,
  insertExerciseBelow,
  moveDown,
  moveUp,
  resolveBlockContext,
} from "./editor/exercise-actions";

interface Props {
  editor: Editor;
  synonyms: SynonymGroup[];
  open: {
    /** Block start position used to look up the live BlockContext. */
    blockFrom: number;
    anchorRect: DOMRect;
  } | null;
  onClose(): void;
  onAddSynonym(ctx: BlockContext): void;
  onJumpLast(ctx: BlockContext): void;
  onRepeatLast(ctx: BlockContext): void;
}

interface Item {
  key: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect(): void;
}

export function ExerciseMenu({
  editor,
  synonyms,
  open,
  onClose,
  onAddSynonym,
  onJumpLast,
  onRepeatLast,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPos(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const margin = 8;
    let top = open.anchorRect.bottom + 4;
    let left = open.anchorRect.left;
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, open.anchorRect.top - rect.height - 4);
    }
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDocPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const ctx = resolveBlockContext(editor.state, open.blockFrom);
  if (!ctx) return null;

  const group = findGroupFor(ctx.name, synonyms);
  const variantOf = canonicalFor(ctx.name, synonyms);

  const synonymLabel = group
    ? variantOf
      ? `Add synonym — currently a variant of ${group.canonical}`
      : `Add synonym to ${group.canonical}`
    : "Add synonym…";

  const items: Item[] = [
    {
      key: "up",
      label: "Move up",
      hint: "⌥↑",
      disabled: !canMoveUp(ctx),
      onSelect: () => {
        moveUp(editor, ctx);
        onClose();
      },
    },
    {
      key: "down",
      label: "Move down",
      hint: "⌥↓",
      disabled: !canMoveDown(ctx),
      onSelect: () => {
        moveDown(editor, ctx);
        onClose();
      },
    },
    {
      key: "above",
      label: "Insert exercise above",
      onSelect: () => {
        insertExerciseAbove(editor, ctx);
        onClose();
      },
    },
    {
      key: "below",
      label: "Insert exercise below",
      onSelect: () => {
        insertExerciseBelow(editor, ctx);
        onClose();
      },
    },
    {
      key: "copy",
      label: "Copy text",
      onSelect: () => {
        void copyBlockText(ctx);
        onClose();
      },
    },
    {
      key: "synonym",
      label: synonymLabel,
      onSelect: () => {
        onAddSynonym(ctx);
        onClose();
      },
    },
    {
      key: "jump",
      label: "Jump to last occurrence",
      onSelect: () => {
        onJumpLast(ctx);
        onClose();
      },
    },
    {
      key: "repeat",
      label: "Repeat last session",
      onSelect: () => {
        onRepeatLast(ctx);
        onClose();
      },
    },
    {
      key: "delete",
      label: "Delete",
      destructive: true,
      onSelect: () => {
        deleteBlock(editor, ctx);
        onClose();
      },
    },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden",
        zIndex: 60,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "0.5rem",
        boxShadow: "0 8px 28px oklch(0% 0 0 / 0.22)",
        padding: "0.25rem",
        minWidth: "12rem",
        fontFamily: "var(--font-mono)",
        fontSize: "0.8125rem",
        userSelect: "none",
      }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          role="menuitem"
          disabled={it.disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            it.onSelect();
          }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            background: "transparent",
            border: 0,
            padding: "0.4rem 0.625rem",
            borderRadius: "0.375rem",
            cursor: it.disabled ? "not-allowed" : "pointer",
            color: it.destructive
              ? "var(--color-destructive, #d44)"
              : "var(--color-text)",
            opacity: it.disabled ? 0.4 : 1,
            textAlign: "left",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
          onMouseEnter={(e) => {
            if (!it.disabled)
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-card-border)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "transparent";
          }}
        >
          <span>{it.label}</span>
          {it.hint && (
            <span
              style={{
                color: "var(--color-text-muted)",
                fontVariantNumeric: "tabular-nums",
                marginLeft: "1rem",
              }}
            >
              {it.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
