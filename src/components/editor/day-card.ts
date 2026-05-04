import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { EditorState } from "prosemirror-state";
import type { Node } from "prosemirror-model";
import { parserPluginKey } from "./workout-parser";

const key = new PluginKey<DecorationSet>("dayCard");

type CardClass =
  | "day-card-start"
  | "day-card-mid"
  | "day-card-end"
  | "day-card-only";

function flushGroup(
  group: Array<{ pos: number; node: Node }>,
  out: Decoration[],
) {
  if (group.length === 0) return;
  if (group.length === 1) {
    const { pos, node } = group[0];
    out.push(
      Decoration.node(pos, pos + node.nodeSize, { class: "day-card-only" }),
    );
    return;
  }
  group.forEach(({ pos, node }, i) => {
    const cls: CardClass =
      i === 0
        ? "day-card-start"
        : i === group.length - 1
          ? "day-card-end"
          : "day-card-mid";
    out.push(Decoration.node(pos, pos + node.nodeSize, { class: cls }));
  });
}

function buildDecorations(state: EditorState): DecorationSet {
  const doc = state.doc;
  const kindMap = parserPluginKey.getState(state)?.kindByPos;
  const out: Decoration[] = [];
  let group: Array<{ pos: number; node: Node }> = [];

  doc.forEach((node, offset) => {
    if (node.type.name === "horizontalRule") {
      flushGroup(group, out);
      group = [];
      return;
    }
    if (node.type.name !== "paragraph") return;

    const kind = kindMap?.get(offset) ?? null;
    if (kind === "date") {
      flushGroup(group, out);
      group = [{ pos: offset, node }];
    } else if (group.length > 0) {
      group.push({ pos: offset, node });
    }
  });

  flushGroup(group, out);
  return DecorationSet.create(doc, out);
}

export const DayCard = Extension.create({
  name: "dayCard",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init(_, state) {
            return buildDecorations(state);
          },
          apply(tr, old, _oldState, newState) {
            const parserChanged =
              parserPluginKey.getState(_oldState) !==
              parserPluginKey.getState(newState);
            if (!tr.docChanged && !parserChanged) return old;
            return buildDecorations(newState);
          },
        },
        props: {
          decorations(state) {
            return key.getState(state);
          },
        },
      }),
    ];
  },
});
