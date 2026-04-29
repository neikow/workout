"use client";

import type { MenuState } from "./use-autocomplete";

interface Props {
  menu: MenuState | null;
  onAccept: (index: number) => void;
  onCycle: (delta: 1 | -1) => void;
}

export function SuggestionMenu({ menu, onAccept, onCycle }: Props) {
  if (!menu) return null;

  const active = menu.suggestions[menu.activeIndex];
  const sets = active.preview ?? [];
  const hasMultiple = menu.suggestions.length > 1;
  const showCard = sets.length > 0 || hasMultiple;

  const typedLower = menu.lineText.toLowerCase();
  const labelLower = active.label.toLowerCase();
  const nameSuffix = labelLower.startsWith(typedLower)
    ? active.label.slice(menu.lineText.length)
    : " → " + active.label;

  const handleAccept = (e: React.MouseEvent) => {
    e.preventDefault();
    onAccept(menu.activeIndex);
  };

  return (
    <>
      {/* Inline name suffix at cursor */}
      {nameSuffix && (
        <span
          aria-hidden
          style={{
            position: "fixed",
            top: menu.cursorTop - 3.5,
            left: menu.cursorLeft,
            fontFamily: "var(--font-jetbrains, monospace)",
            fontSize: "0.9375rem",
            fontWeight: 700,
            lineHeight: "1.7",
            whiteSpace: "pre",
            pointerEvents: "auto",
            cursor: "pointer",
            color: "var(--color-exercise)",
            opacity: 0.38,
            zIndex: 40,
            userSelect: "none",
          }}
          onMouseDown={handleAccept}
        >
          {nameSuffix}
        </span>
      )}

      {/* Floating card */}
      {showCard && (
        <div
          style={{
            position: "fixed",
            top: menu.cursorBottom + 4,
            left: menu.lineLeft,
            zIndex: 50,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.75rem",
            boxShadow: "0 4px 24px oklch(0% 0 0 / 0.18)",
            overflow: "hidden",
          }}
        >
          {/* Set preview lines */}
          {sets.length > 0 && (
            <div
              style={{
                fontFamily: "var(--font-jetbrains, monospace)",
                fontSize: "0.9375rem",
                lineHeight: "1.7",
                color: "var(--color-text)",
                opacity: 0.4,
                padding: "0.75rem 1rem 0.5rem",
                cursor: "pointer",
              }}
              onMouseDown={handleAccept}
            >
              {sets.map((set, i) => (
                <div key={i}>{set}</div>
              ))}
            </div>
          )}

          {/* Nav row */}
          {hasMultiple && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderTop:
                  sets.length > 0 ? "1px solid var(--color-border)" : undefined,
              }}
            >
              <button
                aria-label="Previous suggestion"
                className="btn"
                style={{
                  height: "2.75rem",
                  width: "3rem",
                  color: "var(--color-text-muted)",
                  borderRadius: 0,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--color-text)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--color-text-muted)")
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCycle(-1);
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="9 2 4 7 9 12" />
                </svg>
              </button>
              <span
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  fontVariantNumeric: "tabular-nums",
                  userSelect: "none",
                  color: "var(--color-text-muted)",
                }}
              >
                {menu.activeIndex + 1} / {menu.suggestions.length}
              </span>
              <button
                aria-label="Next suggestion"
                className="btn"
                style={{
                  height: "2.75rem",
                  width: "3rem",
                  color: "var(--color-text-muted)",
                  borderRadius: 0,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--color-text)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--color-text-muted)")
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCycle(1);
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="5 2 10 7 5 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
