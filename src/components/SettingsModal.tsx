"use client";

import { useRef, useEffect, useState } from "react";
import type * as Y from "yjs";
import { Sun, X } from "lucide-react";
import type { Theme, WorkoutContext } from "@/components/editor/types";
import { updateSettings } from "@/lib/settings";
import {
  addSynonymGroup,
  removeSynonymGroup,
  updateSynonymGroup,
  useSynonyms,
} from "@/lib/synonyms";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface ThemeOption {
  id: Theme;
  label: string;
  preview: {
    bg: string;
    date: string;
    exercise: string;
    set: string;
    muted: string;
  };
}

const THEMES: ThemeOption[] = [
  {
    id: "system",
    label: "Auto",
    preview: {
      bg: "linear-gradient(135deg, #f5f4ff 50%, #0d0d14 50%)",
      date: "",
      exercise: "",
      set: "",
      muted: "",
    },
  },
  {
    id: "light",
    label: "Light",
    preview: {
      bg: "#f5f4ff",
      date: "#4338ca",
      exercise: "#1e293b",
      set: "#334155",
      muted: "#94a3b8",
    },
  },
  {
    id: "dark",
    label: "Dark",
    preview: {
      bg: "#0d0d16",
      date: "#818cf8",
      exercise: "#f8fafc",
      set: "#cbd5e1",
      muted: "#475569",
    },
  },
  {
    id: "monokai",
    label: "Monokai",
    preview: {
      bg: "#272822",
      date: "#66d9ef",
      exercise: "#a6e22e",
      set: "#fd971f",
      muted: "#75715e",
    },
  },
];

function SynonymsSection({ ydoc }: { ydoc: Y.Doc }) {
  const groups = useSynonyms(ydoc);
  const [newCanonical, setNewCanonical] = useState("");

  function handleAdd() {
    addSynonymGroup(ydoc, newCanonical);
    setNewCanonical("");
  }

  return (
    <div className="settings-editor-section">
      <span
        className="settings-section-label"
        style={{ color: "var(--color-text-muted)" }}
      >
        Exercise synonyms
      </span>
      <span
        className="settings-hint"
        style={{ color: "var(--color-text-muted)" }}
      >
        Group different names for the same exercise. While typing, variants are
        suggested as the canonical name.
      </span>

      <div className="synonym-list">
        {groups.map((g) => (
          <div key={g.id} className="synonym-group">
            <div className="synonym-row">
              <Input
                value={g.canonical}
                aria-label="Canonical name"
                onChange={(e) =>
                  updateSynonymGroup(ydoc, g.id, { canonical: e.target.value })
                }
              />
              <Button
                variant="icon"
                aria-label="Remove group"
                onClick={() => removeSynonymGroup(ydoc, g.id)}
              >
                <X size={16} strokeWidth={1.5} aria-hidden />
              </Button>
            </div>
            <Input
              value={g.variants.join(", ")}
              aria-label="Variants"
              placeholder="Other names, comma-separated"
              onChange={(e) =>
                updateSynonymGroup(ydoc, g.id, {
                  variants: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        ))}
      </div>

      <form
        className="synonym-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
      >
        <Input
          value={newCanonical}
          placeholder="New canonical name"
          onChange={(e) => setNewCanonical(e.target.value)}
        />
        <Button variant="ghost" type="submit" disabled={!newCanonical.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

function ThemePreview({ theme }: { theme: ThemeOption }) {
  const isAuto = theme.id === "system";
  return (
    <div className="theme-preview-box" style={{ background: theme.preview.bg }}>
      {!isAuto && (
        <div className="theme-preview-lines">
          <div
            className="preview-line"
            style={{
              background: theme.preview.date,
              opacity: 0.95,
              width: "75%",
            }}
          />
          <div
            className="preview-line"
            style={{
              background: theme.preview.exercise,
              opacity: 0.9,
              width: "100%",
            }}
          />
          <div
            className="preview-line"
            style={{
              background: theme.preview.set,
              opacity: 0.85,
              width: "66.667%",
            }}
          />
          <div
            className="preview-line"
            style={{
              background: theme.preview.muted,
              opacity: 0.6,
              width: "50%",
            }}
          />
        </div>
      )}
      {isAuto && (
        <div className="theme-preview-auto">
          <Sun
            size={18}
            strokeWidth={2}
            stroke="url(#theme-auto-grad)"
            aria-hidden
          />
          <svg
            width="0"
            height="0"
            aria-hidden
            style={{ position: "absolute" }}
          >
            <defs>
              <linearGradient id="theme-auto-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4338ca" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  settings: WorkoutContext;
  ydoc: Y.Doc;
  onClose: () => void;
}

export function SettingsModal({ open, settings, ydoc, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(settings.theme);
  const [warmupMarker, setWarmupMarker] = useState(settings.warmupMarker);
  const [dateFormat, setDateFormat] = useState(settings.dateFormat);
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setSelectedTheme(settings.theme);
      setWarmupMarker(settings.warmupMarker);
      setDateFormat(settings.dateFormat);
    }
  }

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal();
    else if (el.open) el.close();
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  function handleSave() {
    updateSettings({ warmupMarker, dateFormat, theme: selectedTheme });
    onClose();
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
        <span className="settings-title">Settings</span>
        <Button variant="icon" onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={1.5} aria-hidden />
        </Button>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <span
            className="settings-section-label"
            style={{ color: "var(--color-text-muted)" }}
          >
            Theme
          </span>
          <div className="theme-grid">
            {THEMES.map((t) => {
              const selected = selectedTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className="btn theme-btn"
                  style={{
                    background: selected
                      ? "var(--color-ghost-hover)"
                      : "transparent",
                    outline: selected
                      ? "2px solid var(--color-accent)"
                      : "2px solid transparent",
                    outlineOffset: "0px",
                  }}
                >
                  <ThemePreview theme={t} />
                  <span
                    className="theme-btn-label"
                    style={{
                      color: selected
                        ? "var(--color-accent)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: "1px", background: "var(--color-border)" }} />

        <div className="settings-editor-section">
          <span
            className="settings-section-label"
            style={{ color: "var(--color-text-muted)" }}
          >
            Editor
          </span>

          <label className="settings-field">
            <span
              className="settings-field-label"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Warmup marker
            </span>
            <Input
              value={warmupMarker}
              onChange={(e) => setWarmupMarker(e.target.value)}
            />
          </label>

          <label className="settings-field">
            <span
              className="settings-field-label"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Date format
            </span>
            <Input
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
            />
            <span
              className="settings-hint"
              style={{ color: "var(--color-text-muted)" }}
            >
              Tokens: DD, MM, YYYY. Wrap optional parts in [brackets].
            </span>
          </label>
        </div>

        <div style={{ height: "1px", background: "var(--color-border)" }} />

        <SynonymsSection ydoc={ydoc} />
      </div>

      <div
        className="settings-footer"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <Button variant="accent" onClick={handleSave}>
          Save
        </Button>
      </div>
    </dialog>
  );
}
