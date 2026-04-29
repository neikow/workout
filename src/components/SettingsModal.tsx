"use client";

import { useRef, useEffect, useState } from "react";
import type { Theme, WorkoutContext } from "@/components/editor/types";
import { updateSettings } from "@/lib/settings";
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

function ThemePreview({ theme }: { theme: ThemeOption }) {
  const isAuto = theme.id === "system";
  return (
    <div
      className="mb-2 h-12 w-full overflow-hidden rounded-md"
      style={{ background: theme.preview.bg }}
    >
      {!isAuto && (
        <div className="flex h-full flex-col justify-center gap-1 px-2.5">
          <div
            className="h-1.5 w-3/4 rounded-full"
            style={{ background: theme.preview.date, opacity: 0.95 }}
          />
          <div
            className="h-1.5 w-full rounded-full"
            style={{ background: theme.preview.exercise, opacity: 0.9 }}
          />
          <div
            className="h-1.5 w-2/3 rounded-full"
            style={{ background: theme.preview.set, opacity: 0.85 }}
          />
          <div
            className="h-1.5 w-1/2 rounded-full"
            style={{ background: theme.preview.muted, opacity: 0.6 }}
          />
        </div>
      )}
      {isAuto && (
        <div className="flex h-full items-center justify-center">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="url(#auto-grad)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <defs>
              <linearGradient id="auto-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4338ca" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  settings: WorkoutContext;
  onClose: () => void;
}

export function SettingsModal({ open, settings, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(settings.theme);
  const [warmupMarker, setWarmupMarker] = useState(settings.warmupMarker);
  const [dateFormat, setDateFormat] = useState(settings.dateFormat);

  // Sync state from settings whenever the modal opens
  useEffect(() => {
    if (open) {
      setSelectedTheme(settings.theme);
      setWarmupMarker(settings.warmupMarker);
      setDateFormat(settings.dateFormat);
    }
  }, [open, settings.theme, settings.warmupMarker, settings.dateFormat]);

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
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{
          borderBottom: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <span className="text-sm font-semibold tracking-tight">Settings</span>
        <Button variant="icon" onClick={onClose} aria-label="Close">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M3.5 3.5l9 9M12.5 3.5l-9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </Button>
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        {/* Theme picker */}
        <div className="flex flex-col gap-3">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}
          >
            Theme
          </span>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((t) => {
              const selected = selectedTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className="btn flex flex-col items-center rounded-lg p-1.5"
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
                    className="text-xs font-medium"
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

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--color-border)" }} />

        {/* Editor fields */}
        <div className="flex flex-col gap-4">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}
          >
            Editor
          </span>

          <label className="flex flex-col gap-1.5">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Warmup marker
            </span>
            <Input
              value={warmupMarker}
              onChange={(e) => setWarmupMarker(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Date format
            </span>
            <Input
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
            />
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              Tokens: DD, MM, YYYY. Wrap optional parts in [brackets].
            </span>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-5 pb-5 pt-2"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <Button variant="accent" onClick={handleSave}>
          Save
        </Button>
      </div>
    </dialog>
  );
}
