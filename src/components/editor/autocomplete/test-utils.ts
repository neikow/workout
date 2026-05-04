import { Schema, type Node as PMNode } from "prosemirror-model";
import type { LineKind } from "../types";

export const testSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "text*",
    },
    text: { group: "inline" },
  },
});

export interface ParaSpec {
  kind: LineKind | null;
  text: string;
}

export interface BuiltDoc {
  doc: PMNode;
  getKind: (pos: number) => LineKind | null;
}

export function buildDoc(paragraphs: ParaSpec[]): BuiltDoc {
  const para = testSchema.nodes.paragraph;
  const kindByPos = new Map<number, LineKind | null>();
  let pos = 0;
  const nodes = paragraphs.map((p) => {
    const content = p.text ? testSchema.text(p.text) : null;
    const node = para.create(null, content ? [content] : []);
    kindByPos.set(pos, p.kind);
    pos += node.nodeSize;
    return node;
  });
  const doc = testSchema.nodes.doc.create(null, nodes);
  return { doc, getKind: (p: number) => kindByPos.get(p) ?? null };
}
