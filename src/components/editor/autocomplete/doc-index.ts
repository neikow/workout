import type { Node as PMNode } from "prosemirror-model";
import type { LineKind } from "../types";

export interface ExerciseEntry {
  displayName: string;
  normalizedName: string;
  lastSets: string[];
  contentStart: number;
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildExerciseIndex(
  doc: PMNode,
  excludeContentStart?: number,
): Map<string, ExerciseEntry> {
  const index = new Map<string, ExerciseEntry>();
  let current: ExerciseEntry | null = null;

  doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return;
    const kind = (node.attrs.kind ?? null) as LineKind | null;
    const text = node.textContent;
    const contentStart = pos + 1;

    if (kind === "exercise") {
      const displayName = text.trim();
      if (!displayName || contentStart === excludeContentStart) {
        current = null;
        return;
      }
      const key = normalizeName(displayName);
      if (index.has(key)) {
        current = null;
        return;
      }
      current = {
        displayName,
        normalizedName: key,
        lastSets: [],
        contentStart,
      };
      index.set(key, current);
      return;
    }

    if (current && (kind === "warmup-set" || kind === "working-set")) {
      current.lastSets.push(text);
      return;
    }

    if (kind === "date" || kind === "comment" || kind === null) {
      current = null;
    }
  });

  return index;
}
