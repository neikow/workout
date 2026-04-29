import Paragraph from "@tiptap/extension-paragraph";
import type { LineKind } from "./types";

export const KIND_ATTR = "data-kind";

export const WorkoutParagraph = Paragraph.extend({
  addAttributes() {
    return {
      kind: {
        default: null as LineKind | null,
        parseHTML: (el) => el.getAttribute(KIND_ATTR) ?? null,
        renderHTML: (attrs) => {
          const kind = attrs.kind as LineKind | null;
          return kind ? { [KIND_ATTR]: kind } : {};
        },
      },
    };
  },
});
