import { Schema, type Node as PMNode } from "prosemirror-model";
import type { LineKind } from "../types";

export const testSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "text*",
      attrs: { kind: { default: null } },
    },
    text: { group: "inline" },
  },
});

export interface ParaSpec {
  kind: LineKind | null;
  text: string;
}

export function buildDoc(paragraphs: ParaSpec[]): PMNode {
  const para = testSchema.nodes.paragraph;
  const nodes = paragraphs.map((p) => {
    const content = p.text ? testSchema.text(p.text) : null;
    return para.create({ kind: p.kind }, content ? [content] : []);
  });
  return testSchema.nodes.doc.create(null, nodes);
}
