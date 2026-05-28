import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Trophy } from "lucide-react";
import { findGroupFor, normalizeName, type SynonymGroup } from "@/lib/synonyms";
import { lucideToHtml } from "@/lib/lucide-html";
import { getParserState } from "./workout-parser";
import { collectDocItems } from "./exercise-block";
import { parseSetLine } from "./set-parser";

const TROPHY_HTML = lucideToHtml(Trophy, { size: 14 });

const key = new PluginKey<DecorationSet>("prRecords");

// Module-scoped synonyms reference. The plugin reads from this on every
// decoration build; React drives updates via setPrRecordsSynonyms when the
// user edits the synonym registry.
let currentSynonyms: SynonymGroup[] = [];

export function setPrRecordsSynonyms(
  view: EditorView,
  groups: SynonymGroup[],
): void {
  if (currentSynonyms === groups) return;
  currentSynonyms = groups;
  view.dispatch(view.state.tr.setMeta(key, "refresh"));
}

/** Largest weight value across the line's movements. Null when unparseable. */
function maxWeightOf(line: string): number | null {
  const p = parseSetLine(line);
  if (!p.ok) return null;
  let max = -Infinity;
  for (const mv of p.movements) {
    if (mv.weight && mv.weight.value > max) max = mv.weight.value;
  }
  return Number.isFinite(max) ? max : null;
}

function canonicalKey(name: string, synonyms: SynonymGroup[]): string {
  const group = findGroupFor(name, synonyms);
  return normalizeName(group ? group.canonical : name);
}

function buildTrophyDom(): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "pr-trophy-wrap";
  wrap.contentEditable = "false";
  wrap.setAttribute("aria-label", "Personal record");
  wrap.title = "Personal record";
  wrap.innerHTML = TROPHY_HTML;
  return wrap;
}

function buildDecorations(state: EditorState): DecorationSet {
  const kindByPos = getParserState(state)?.kindByPos;
  if (!kindByPos) return DecorationSet.empty;
  const items = collectDocItems(state.doc, kindByPos);

  // Per canonical exercise: best weight seen + position of the first set
  // (in doc order = most recent in this most-recent-first feed) that hit
  // that weight. Equal-weight ties keep the recent winner.
  const records = new Map<string, { weight: number; from: number }>();
  let currentCanonical: string | null = null;

  for (const item of items) {
    if (item.kind === "exercise") {
      currentCanonical = canonicalKey(item.text, currentSynonyms);
      continue;
    }
    if (item.kind === "date" || item.kind === "hr") {
      currentCanonical = null;
      continue;
    }
    if (item.kind !== "working-set" || !currentCanonical) continue;

    const weight = maxWeightOf(item.text);
    if (weight === null) continue;
    const prev = records.get(currentCanonical);
    if (!prev || weight > prev.weight) {
      records.set(currentCanonical, { weight, from: item.from });
    }
  }

  const decos: Decoration[] = [];
  for (const { from } of records.values()) {
    decos.push(
      Decoration.widget(from + 1, () => buildTrophyDom(), {
        side: -1,
        ignoreSelection: true,
        key: `pr-trophy:${from}`,
      }),
    );
  }
  return DecorationSet.create(state.doc, decos);
}

export const PrRecords = Extension.create({
  name: "prRecords",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            return buildDecorations(state);
          },
        },
      }),
    ];
  },
});
