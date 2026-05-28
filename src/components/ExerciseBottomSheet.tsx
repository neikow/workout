"use client";

import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import type { SynonymGroup } from "@/lib/synonyms";
import {
  type BlockContext,
  resolveBlockContext,
} from "./editor/exercise-actions";
import { buildExerciseMenuItems } from "./editor/exercise-menu-items";

interface Props {
  editor: Editor;
  synonyms: SynonymGroup[];
  open: { blockFrom: number } | null;
  onClose(): void;
  onAddSynonym(ctx: BlockContext): void;
  onJumpLast(ctx: BlockContext): void;
  onRepeatLast(ctx: BlockContext): void;
}

export function ExerciseBottomSheet({
  editor,
  synonyms,
  open,
  onClose,
  onAddSynonym,
  onJumpLast,
  onRepeatLast,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const ctx = resolveBlockContext(editor.state, open.blockFrom);
  if (!ctx) return null;

  const items = buildExerciseMenuItems({
    editor,
    ctx,
    synonyms,
    onAddSynonym,
    onJumpLast,
    onRepeatLast,
    onClose,
  });

  return (
    <div
      role="dialog"
      aria-label="Exercise actions"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 65,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: "oklch(0% 0 0 / 0.35)",
        animation: "exercise-sheet-fade 140ms ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderTopLeftRadius: "1rem",
          borderTopRightRadius: "1rem",
          paddingTop: "0.5rem",
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          boxShadow: "0 -8px 28px oklch(0% 0 0 / 0.18)",
          maxHeight: "70vh",
          overflow: "auto",
          animation: "exercise-sheet-slide 180ms ease",
        }}
      >
        <div
          style={{
            width: "2.5rem",
            height: "0.25rem",
            borderRadius: "999px",
            background: "var(--color-border)",
            margin: "0 auto 0.5rem",
          }}
        />
        <div
          style={{
            padding: "0.25rem 1rem 0.75rem",
            borderBottom: "1px solid var(--color-border)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              marginBottom: "0.125rem",
            }}
          >
            Exercise
          </div>
          <div
            style={{
              fontWeight: 700,
              color: "var(--color-exercise)",
              fontSize: "1rem",
              wordBreak: "break-word",
            }}
          >
            {ctx.name}
          </div>
        </div>
        <div style={{ padding: "0.5rem" }}>
          {items.map((it) => (
            <button
              key={it.key}
              disabled={it.disabled}
              onClick={(e) => {
                e.preventDefault();
                it.run();
              }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                background: "transparent",
                border: 0,
                padding: "0.875rem 0.75rem",
                borderRadius: "0.5rem",
                cursor: it.disabled ? "not-allowed" : "pointer",
                color: it.destructive
                  ? "var(--color-destructive, #d44)"
                  : "var(--color-text)",
                opacity: it.disabled ? 0.4 : 1,
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: "0.9375rem",
                touchAction: "manipulation",
              }}
            >
              <span>{it.label}</span>
              {it.hint && (
                <span
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "0.8125rem",
                  }}
                >
                  {it.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
