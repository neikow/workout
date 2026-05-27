"use client";

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

export const GUEST_IDB_NAME = "workout-y:guest";

const HR_MARKER = "---";

function nodeText(node: Y.XmlElement | Y.XmlText | Y.XmlHook): string {
  if (node instanceof Y.XmlText) return node.toString();
  if (node instanceof Y.XmlElement) {
    return node
      .toArray()
      .map((child) => nodeText(child as Y.XmlElement | Y.XmlText))
      .join("");
  }
  return "";
}

/** Serialise the collaborative document into the plain-text note format. */
export function docToText(ydoc: Y.Doc): string {
  const frag = ydoc.getXmlFragment("default");
  const lines = frag.toArray().map((node) => {
    if (node instanceof Y.XmlElement && node.nodeName === "horizontalRule") {
      return HR_MARKER;
    }
    return nodeText(node as Y.XmlElement | Y.XmlText);
  });
  return lines.join("\n");
}

/** Build a ProseMirror doc JSON from note-format text for `setContent`. */
export function textToDoc(text: string) {
  const content = text.split("\n").map((line) => {
    if (line.trim() === HR_MARKER) return { type: "horizontalRule" };
    if (line.length === 0) return { type: "paragraph" };
    return { type: "paragraph", content: [{ type: "text", text: line }] };
  });
  return { type: "doc", content };
}

/** Whitespace-insensitive comparison for detecting genuine divergence. */
export function sameContent(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join("\n");
  return norm(a) === norm(b);
}

/** Read a persisted Yjs doc's text straight from IndexedDB (read-only). */
export async function readIdbDocText(idbName: string): Promise<string> {
  const doc = new Y.Doc();
  const idb = new IndexeddbPersistence(idbName, doc);
  try {
    await idb.whenSynced;
    return docToText(doc);
  } finally {
    await idb.destroy();
    doc.destroy();
  }
}

/** Wipe a persisted Yjs doc from IndexedDB. */
export async function clearIdbDoc(idbName: string): Promise<void> {
  const doc = new Y.Doc();
  const idb = new IndexeddbPersistence(idbName, doc);
  try {
    await idb.whenSynced;
    await idb.clearData();
  } finally {
    doc.destroy();
  }
}
