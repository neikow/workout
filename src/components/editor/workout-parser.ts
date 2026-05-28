import { Extension } from "@tiptap/core";
import type { EditorState } from "prosemirror-state";
import { Plugin, PluginKey } from "prosemirror-state";
import type { Node as PMNode } from "prosemirror-model";
import { Decoration, DecorationSet } from "prosemirror-view";
import { classifyLine, defaultRules, sortRules } from "./default-rules";
import type { LineKind, WorkoutContext, WorkoutRule } from "./types";

export interface WorkoutParserOptions {
  rules: WorkoutRule[];
  initialContext: WorkoutContext;
}

export const CONTEXT_META = "workoutContext";

export interface KindState {
  ctx: WorkoutContext;
  kindByPos: Map<number, LineKind | null>;
  decorations: DecorationSet;
}

export const parserPluginKey = new PluginKey<KindState>("workoutParser");

function buildState(
  doc: PMNode,
  ctx: WorkoutContext,
  sortedRules: WorkoutRule[],
): KindState {
  const kindByPos = new Map<number, LineKind | null>();
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return;
    const kind = classifyLine(node.textContent, sortedRules, ctx);
    kindByPos.set(pos, kind);
    if (kind) {
      decos.push(
        Decoration.node(pos, pos + node.nodeSize, { "data-kind": kind }),
      );
    }
  });
  return {
    ctx,
    kindByPos,
    decorations: DecorationSet.create(doc, decos),
  };
}

/**
 * Read the parser's KindState from the editor state without depending on the
 * exported `parserPluginKey`. Next dev (Turbopack) sometimes serves this
 * module from two distinct chunks; the duplicate PluginKey instance doesn't
 * match the one the registered plugin was built with, so its `getState()`
 * silently returns undefined. Looking up the plugin by its name prefix is
 * stable across duplication.
 */
export function getParserState(state: EditorState): KindState | null {
  for (const p of state.plugins) {
    const spec = (p as unknown as { spec?: { key?: { key?: string } } }).spec;
    const k =
      spec?.key?.key ?? (p as unknown as { key?: { key?: string } }).key?.key;
    if (k && k.startsWith("workoutParser$")) {
      const s = p.getState(state) as KindState | undefined;
      if (s) return s;
    }
  }
  return null;
}

export function getKindAt(state: EditorState, pos: number): LineKind | null {
  const s = getParserState(state);
  return s ? (s.kindByPos.get(pos) ?? null) : null;
}

export function getKindGetter(
  state: EditorState,
): (pos: number) => LineKind | null {
  const s = getParserState(state);
  return (pos) => (s ? (s.kindByPos.get(pos) ?? null) : null);
}

export const WorkoutParser = Extension.create<WorkoutParserOptions>({
  name: "workoutParser",

  addOptions() {
    return {
      rules: defaultRules,
      initialContext: {
        warmupMarker: "E",
        dateFormat: "DD/MM[/YYYY]",
        theme: "system" as const,
      },
    };
  },

  addProseMirrorPlugins() {
    const sorted = sortRules(this.options.rules);

    return [
      new Plugin<KindState>({
        key: parserPluginKey,
        state: {
          init: (_, instance) =>
            buildState(instance.doc, this.options.initialContext, sorted),
          apply(tr, prev, _oldState, newState) {
            const nextCtx =
              (tr.getMeta(CONTEXT_META) as WorkoutContext | undefined) ??
              prev.ctx;
            if (!tr.docChanged && nextCtx === prev.ctx) return prev;
            return buildState(newState.doc, nextCtx, sorted);
          },
        },
        props: {
          decorations(state) {
            return parserPluginKey.getState(state)?.decorations;
          },
        },
      }),
    ];
  },
});
