import { buildExerciseIndex, normalizeName } from "./doc-index";
import type { AutocompleteProvider, Suggestion } from "./types";

export const docExerciseProvider: AutocompleteProvider = {
  name: "doc-exercise",
  getSuggestions(query, ctx) {
    if (ctx.lineKind !== "exercise") return [];
    const normalizedQuery = normalizeName(query);
    if (!normalizedQuery) return [];

    const index = buildExerciseIndex(ctx.doc, ctx.linePos);
    const results: Suggestion[] = [];

    for (const entry of index.values()) {
      if (!entry.normalizedName.includes(normalizedQuery)) continue;

      const setsPreview =
        entry.lastSets.length > 0
          ? `${entry.lastSets.length} set${entry.lastSets.length === 1 ? "" : "s"}`
          : undefined;

      results.push({
        id: `exercise:${entry.normalizedName}`,
        label: entry.displayName,
        detail: setsPreview,
        preview: entry.lastSets.filter((t) => t.trim()),
        apply(editor, range) {
          const nodeFrom = range.from - 1;
          const nodeTo = range.to + 1;
          const content = [
            {
              type: "paragraph",
              content: [{ type: "text", text: entry.displayName }],
            },
            ...entry.lastSets
              .filter((t) => t.trim())
              .map((t) => ({
                type: "paragraph",
                content: [{ type: "text", text: t }],
              })),
          ];
          editor
            .chain()
            .focus()
            .insertContentAt({ from: nodeFrom, to: nodeTo }, content)
            .run();
        },
      });
    }

    results.sort((a, b) => {
      const aStarts = normalizeName(a.label).startsWith(normalizedQuery);
      const bStarts = normalizeName(b.label).startsWith(normalizedQuery);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    return results.slice(0, 8);
  },
};

export const defaultProviders: AutocompleteProvider[] = [docExerciseProvider];
