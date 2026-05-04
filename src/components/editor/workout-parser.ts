import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { classifyLine, defaultRules, sortRules } from "./default-rules";
import type { WorkoutContext, WorkoutRule } from "./types";

export interface WorkoutParserOptions {
  rules: WorkoutRule[];
  initialContext: WorkoutContext;
}

export const CONTEXT_META = "workoutContext";

export const parserPluginKey = new PluginKey<WorkoutContext>("workoutParser");

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
    const initial = this.options.initialContext;

    return [
      new Plugin<WorkoutContext>({
        key: parserPluginKey,
        state: {
          init: () => initial,
          apply(tr, prev) {
            return (
              (tr.getMeta(CONTEXT_META) as WorkoutContext | undefined) ?? prev
            );
          },
        },
        appendTransaction(_txs, _oldState, newState) {
          const ctx = parserPluginKey.getState(newState);
          if (!ctx) return null;
          const tr = newState.tr;
          let changed = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "paragraph") return;
            const expected = classifyLine(node.textContent, sorted, ctx);
            const current = node.attrs.kind ?? null;
            if (expected === current) return;
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              kind: expected,
            });
            changed = true;
          });

          return changed ? tr : null;
        },
      }),
    ];
  },
});
