import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node } from "prosemirror-model";

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

function buildDecorations(doc: Node): DecorationSet {
  const out: Decoration[] = [];
  let group: Array<{ pos: number; node: Node }> = [];

  doc.forEach((node, offset) => {
    if (node.type.name === "horizontalRule") {
      flushGroup(group, out);
      group = [];
      return;
    }
    if (node.type.name !== "paragraph") return;

    if (node.attrs.kind === "date") {
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
          init(_, { doc }) {
            return buildDecorations(doc);
          },
          apply(tr, old) {
            return tr.docChanged ? buildDecorations(tr.doc) : old;
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
