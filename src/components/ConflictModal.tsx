"use client";

import { useEffect, useRef } from "react";
import { Button } from "./ui/Button";

export type ConflictChoice = "local" | "cloud" | "merge";

interface Props {
  localText: string;
  cloudText: string;
  onResolve: (choice: ConflictChoice) => void;
}

function lineCount(text: string): number {
  return text.split("\n").filter((l) => l.trim().length > 0).length;
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ConflictModal({ localText, cloudText, onResolve }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <dialog ref={dialogRef} className="settings-dialog conflict-dialog">
      <div
        className="settings-header"
        style={{
          borderBottom: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <span className="settings-title">Workout data conflict</span>
      </div>

      <div className="settings-body">
        <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5 }}>
          This device has workouts that differ from your synced account. To
          avoid losing anything, download a backup of both, then choose which
          version to keep.
        </p>

        <div className="conflict-stats">
          <div className="conflict-stat">
            <span className="conflict-stat-label">This device (local)</span>
            <span className="conflict-stat-value">
              {lineCount(localText)} lines
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => download(`workout-local-${stamp}.txt`, localText)}
            >
              Download backup
            </button>
          </div>
          <div className="conflict-stat">
            <span className="conflict-stat-label">Account (cloud)</span>
            <span className="conflict-stat-value">
              {lineCount(cloudText)} lines
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => download(`workout-cloud-${stamp}.txt`, cloudText)}
            >
              Download backup
            </button>
          </div>
        </div>

        <div className="conflict-actions">
          <Button variant="accent" onClick={() => onResolve("merge")}>
            Merge both (recommended)
          </Button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onResolve("local")}
          >
            Keep this device&apos;s data
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onResolve("cloud")}
          >
            Keep account data
          </button>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            color: "var(--color-text-muted)",
          }}
        >
          Merge keeps every day from both, preferring this device when the same
          date appears in both.
        </p>
      </div>
    </dialog>
  );
}
