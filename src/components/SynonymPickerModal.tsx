"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as Y from "yjs";
import {
  addSynonymGroup,
  addVariantToGroup,
  findGroupFor,
  getSynonyms,
  normalizeName,
  type SynonymGroup,
} from "@/lib/synonyms";

interface Props {
  open: boolean;
  /** Name to register (typically the exercise paragraph's text). */
  variant: string;
  groups: SynonymGroup[];
  ydoc: Y.Doc;
  onClose(): void;
}

export function SynonymPickerModal({
  open,
  variant,
  groups,
  ydoc,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const prefilled = useMemo(
    () => findGroupFor(variant, groups),
    [variant, groups],
  );

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const variantNorm = normalizeName(variant);
  const ranked = groups
    .map((g) => {
      const q = normalizeName(query);
      const inCanonical = normalizeName(g.canonical).includes(q);
      const inVariant = g.variants.some((v) => normalizeName(v).includes(q));
      const matches = q === "" || inCanonical || inVariant;
      const isPrefilled = prefilled?.id === g.id;
      return { g, matches, isPrefilled };
    })
    .filter((r) => r.matches)
    .sort((a, b) => {
      if (a.isPrefilled !== b.isPrefilled) return a.isPrefilled ? -1 : 1;
      return a.g.canonical.localeCompare(b.g.canonical);
    });

  const canCreateNew =
    variantNorm.length > 0 &&
    !groups.some((g) => normalizeName(g.canonical) === variantNorm);

  const addToGroup = (id: string) => {
    addVariantToGroup(ydoc, id, variant);
    onClose();
  };

  const makeNewCanonical = () => {
    const trimmed = variant.trim();
    if (!trimmed) return;
    addSynonymGroup(ydoc, trimmed);
    // Newest group is appended at the end.
    const arr = getSynonyms(ydoc);
    const created = arr.get(arr.length - 1);
    if (created) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Add synonym"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "oklch(0% 0 0 / 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "0.625rem",
          width: "min(28rem, 100%)",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 40px oklch(0% 0 0 / 0.3)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "0.875rem 1rem 0.5rem",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              marginBottom: "0.25rem",
            }}
          >
            Add as synonym of…
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: "var(--color-exercise)",
              fontSize: "0.9375rem",
              wordBreak: "break-word",
            }}
          >
            {variant}
          </div>
          <input
            ref={inputRef}
            placeholder="Search canonical exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              marginTop: "0.625rem",
              width: "100%",
              padding: "0.5rem 0.625rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--color-border)",
              background: "var(--color-background)",
              color: "var(--color-text)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
        </div>
        <div
          style={{
            overflow: "auto",
            padding: "0.375rem",
          }}
        >
          {ranked.length === 0 && !canCreateNew && (
            <div
              style={{
                padding: "0.875rem 0.625rem",
                color: "var(--color-text-muted)",
                fontSize: "0.8125rem",
              }}
            >
              No canonical exercises match.
            </div>
          )}
          {ranked.map(({ g, isPrefilled }) => (
            <button
              key={g.id}
              onClick={() => addToGroup(g.id)}
              style={{
                display: "block",
                width: "100%",
                padding: "0.5rem 0.625rem",
                background: isPrefilled
                  ? "color-mix(in srgb, var(--color-link, #4f8cff) 12%, transparent)"
                  : "transparent",
                border: 0,
                borderRadius: "0.375rem",
                textAlign: "left",
                cursor: "pointer",
                color: "var(--color-text)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8125rem",
              }}
              onMouseEnter={(e) => {
                if (!isPrefilled)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--color-card-border)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  isPrefilled
                    ? "color-mix(in srgb, var(--color-link, #4f8cff) 12%, transparent)"
                    : "transparent";
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {g.canonical}
                {isPrefilled && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.7rem",
                      color: "var(--color-text-muted)",
                      fontWeight: 400,
                    }}
                  >
                    current group
                  </span>
                )}
              </div>
              {g.variants.length > 0 && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    marginTop: "0.125rem",
                  }}
                >
                  {g.variants.join(" · ")}
                </div>
              )}
            </button>
          ))}
          {canCreateNew && (
            <button
              onClick={makeNewCanonical}
              style={{
                display: "block",
                width: "100%",
                marginTop: ranked.length > 0 ? "0.5rem" : 0,
                padding: "0.5rem 0.625rem",
                background: "transparent",
                border: "1px dashed var(--color-border)",
                borderRadius: "0.375rem",
                textAlign: "left",
                cursor: "pointer",
                color: "var(--color-text)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8125rem",
              }}
            >
              + Create new canonical:{" "}
              <span style={{ fontWeight: 600 }}>{variant.trim()}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
