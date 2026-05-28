import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { Decoration, DecorationSet } from "prosemirror-view";
import { findGroupFor, normalizeName, type SynonymGroup } from "@/lib/synonyms";
import { getParserState } from "./workout-parser";
import { collectDocItems } from "./exercise-block";
import { parseSetLine } from "./set-parser";

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
  // Lucide "trophy" outline icon, inlined to avoid a runtime dep on
  // lucide-react. fill="none" + stroke="currentColor" lets the surrounding
  // .pr-trophy-wrap color drive the icon.
  wrap.innerHTML =
    '<svg class="pr-trophy" viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>' +
    '<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>' +
    '<path d="M4 22h16"/>' +
    '<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>' +
    '<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>' +
    '<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>' +
    "</svg>";
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
