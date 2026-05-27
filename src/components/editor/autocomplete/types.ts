import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "prosemirror-model";
import type { LineKind, WorkoutContext } from "../types";
import type { SynonymGroup } from "@/lib/synonyms";

export interface SuggestionContext {
  doc: PMNode;
  linePos: number;
  lineKind: LineKind | null;
  lineText: string;
  workout: WorkoutContext;
  getKind: (pos: number) => LineKind | null;
  synonyms?: SynonymGroup[];
}

export interface Suggestion {
  id: string;
  label: string;
  detail?: string;
  preview?: string[];
  apply(editor: Editor, range: { from: number; to: number }): void;
}

export interface AutocompleteProvider {
  name: string;
  getSuggestions(query: string, ctx: SuggestionContext): Suggestion[];
}
