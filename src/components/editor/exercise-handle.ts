import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { Decoration, DecorationSet } from "prosemirror-view";
import { getParserState } from "./workout-parser";
import {
  type BlockRange,
  collectDocItems,
  type DocItem,
  findExerciseBlock,
} from "./exercise-block";

function getParserKindMap(state: EditorState) {
  return getParserState(state)?.kindByPos;
}

const key = new PluginKey<DecorationSet>("exerciseHandle");

export const EXERCISE_HANDLE_EVENT = "workout:exercise-handle";

export interface ExerciseHandleEventDetail {
  from: number;
  to: number;
  anchorRect: DOMRect;
}

const LONG_PRESS_MS = 380;
const LONG_PRESS_TOLERANCE_PX = 10;

/**
 * A drop is only allowed at two kinds of slots:
 *  - "block-below": directly after another exercise block (its full
 *    range, including trailing set lines). The visual indicator hugs
 *    the bottom of the block's last paragraph.
 *  - "date-above": immediately before a date paragraph — i.e. at the
 *    very end of the previous day. The indicator hugs the top of the
 *    date row.
 * Dropping "above a block" (would split a day mid-list) and "after a
 * date" (would land between the day header and its first exercise)
 * are both forbidden — they were too easy to trigger accidentally.
 */
type DropTarget =
  | { kind: "block-below"; block: BlockRange; anchorFrom: number }
  | { kind: "date-above"; dateFrom: number };

interface DragState {
  source: { from: number; to: number };
  indicator: HTMLDivElement;
  target: DropTarget | null;
}

// Drag state is process-global and transient — only one drag can be active at
// a time anyway, and pinning it outside the React/plugin tree keeps the
// transaction churn from re-running through PM apply() on every dragover.
let activeDrag: DragState | null = null;
// Module-scoped reference to the live editor view, set on plugin construction.
// Used by handle DOM builders for hit-testing during drag.
let currentView: EditorView | null = null;

function ensureIndicator(): HTMLDivElement {
  if (activeDrag) return activeDrag.indicator;
  const div = document.createElement("div");
  div.className = "exercise-drop-line";
  div.style.position = "fixed";
  div.style.height = "2px";
  div.style.background = "var(--color-link, #4f8cff)";
  div.style.borderRadius = "1px";
  div.style.pointerEvents = "none";
  div.style.zIndex = "55";
  div.style.display = "none";
  document.body.appendChild(div);
  return div;
}

function clearDrag() {
  if (!activeDrag) return;
  activeDrag.indicator.remove();
  activeDrag = null;
}

function findDropTarget(
  view: EditorView,
  clientX: number,
  clientY: number,
): DropTarget | null {
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;
  const kindByPos = getParserKindMap(view.state);
  if (!kindByPos) return null;
  const items = collectDocItems(view.state.doc, kindByPos);
  const idx = items.findIndex(
    (it) => coords.pos >= it.from && coords.pos < it.to,
  );
  if (idx === -1) return null;
  const item = items[idx]!;
  if (item.kind === "date") {
    return { kind: "date-above", dateFrom: item.from };
  }
  const block = findExerciseBlock(items, coords.pos);
  if (!block) {
    // The "after a date" gap (null-kind paragraph between a date and its
    // first exercise) lands here — explicitly forbidden as a drop slot.
    return null;
  }
  return {
    kind: "block-below",
    block,
    anchorFrom: items[block.lastItemIndex]!.from,
  };
}

function paintIndicator(view: EditorView, drag: DragState, target: DropTarget) {
  const anchorPos =
    target.kind === "date-above" ? target.dateFrom : target.anchorFrom;
  const dom = view.nodeDOM(anchorPos);
  if (!(dom instanceof HTMLElement)) return;
  const rect = dom.getBoundingClientRect();
  const editorRect = view.dom.getBoundingClientRect();
  const top = target.kind === "date-above" ? rect.top - 1 : rect.bottom - 1;
  drag.indicator.style.left = `${editorRect.left + 8}px`;
  drag.indicator.style.width = `${editorRect.width - 16}px`;
  drag.indicator.style.top = `${top}px`;
  drag.indicator.style.display = "block";
  drag.target = target;
}

function isDropAllowed(
  items: DocItem[],
  liveSource: BlockRange,
  target: DropTarget,
): number | null {
  // dropPos = where the source's slice would be inserted in the live doc.
  // Returns null when the drop is a no-op (lands inside the source range
  // itself) — those drops should silently do nothing.
  const dropPos =
    target.kind === "date-above" ? target.dateFrom : target.block.to;
  if (target.kind === "block-below" && target.block.from === liveSource.from) {
    return null;
  }
  if (dropPos >= liveSource.from && dropPos <= liveSource.to) return null;
  // Hand back the items array so the caller doesn't recompute.
  void items;
  return dropPos;
}

function performDrop(view: EditorView, drag: DragState) {
  if (!drag.target) return;
  const kindByPos = getParserKindMap(view.state);
  if (!kindByPos) return;
  const items = collectDocItems(view.state.doc, kindByPos);
  const liveSource = findExerciseBlock(items, drag.source.from);
  if (!liveSource) return;

  const dropPos = isDropAllowed(items, liveSource, drag.target);
  if (dropPos === null) return;

  const sourceSlice = view.state.doc.slice(liveSource.from, liveSource.to);
  const tr = view.state.tr;
  tr.insert(dropPos, sourceSlice.content);
  // The insert above shifted the source's range when the drop is earlier in
  // the doc; account for that before deleting the original copy.
  const shift = dropPos <= liveSource.from ? sourceSlice.content.size : 0;
  tr.delete(liveSource.from + shift, liveSource.to + shift);
  view.dispatch(tr);
}

function buildHandle(from: number, to: number): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "exercise-handle-wrap";
  wrap.contentEditable = "false";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "exercise-handle";
  btn.draggable = true;
  btn.tabIndex = -1;
  btn.setAttribute("aria-label", "Exercise actions");
  btn.innerHTML =
    '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true" fill="currentColor">' +
    '<circle cx="2" cy="3" r="1.2"/><circle cx="2" cy="8" r="1.2"/><circle cx="2" cy="13" r="1.2"/>' +
    '<circle cx="8" cy="3" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="13" r="1.2"/>' +
    "</svg>";

  // Don't preventDefault on mousedown — the browser needs the default mousedown
  // → dragstart sequence to actually fire dragstart. Stop propagation only so
  // PM doesn't reinterpret the click as a caret move into the widget.
  btn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = btn.getBoundingClientRect();
    btn.dispatchEvent(
      new CustomEvent<ExerciseHandleEventDetail>(EXERCISE_HANDLE_EVENT, {
        detail: { from, to, anchorRect: rect },
        bubbles: true,
      }),
    );
  });

  btn.addEventListener("dragstart", (e) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.effectAllowed = "move";
    // Firefox: drag won't start unless setData is called.
    e.dataTransfer.setData("text/plain", "");
    activeDrag = {
      source: { from, to },
      indicator: ensureIndicator(),
      target: null,
    };
    btn.classList.add("is-dragging");
  });
  btn.addEventListener("dragend", () => {
    btn.classList.remove("is-dragging");
    clearDrag();
  });

  // Touch long-press → drag mode.
  let pressTimer: number | null = null;
  let pressOrigin: { x: number; y: number } | null = null;
  let touchDragging = false;

  const cancelPress = () => {
    if (pressTimer !== null) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
    pressOrigin = null;
  };

  btn.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (!t) return;
    pressOrigin = { x: t.clientX, y: t.clientY };
    pressTimer = window.setTimeout(() => {
      pressTimer = null;
      touchDragging = true;
      activeDrag = {
        source: { from, to },
        indicator: ensureIndicator(),
        target: null,
      };
      btn.classList.add("is-dragging");
      navigator.vibrate?.(8);
    }, LONG_PRESS_MS);
  });

  btn.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      if (pressOrigin && pressTimer !== null) {
        const dx = Math.abs(t.clientX - pressOrigin.x);
        const dy = Math.abs(t.clientY - pressOrigin.y);
        if (dx > LONG_PRESS_TOLERANCE_PX || dy > LONG_PRESS_TOLERANCE_PX) {
          cancelPress();
        }
        return;
      }
      if (touchDragging && activeDrag && currentView) {
        e.preventDefault();
        const tgt = findDropTarget(currentView, t.clientX, t.clientY);
        if (tgt) {
          paintIndicator(currentView, activeDrag, tgt);
        } else {
          activeDrag.target = null;
          activeDrag.indicator.style.display = "none";
        }
      }
    },
    { passive: false },
  );

  const endTouch = (e: TouchEvent) => {
    if (touchDragging && activeDrag && currentView) {
      e.preventDefault();
      performDrop(currentView, activeDrag);
      btn.classList.remove("is-dragging");
      clearDrag();
      touchDragging = false;
    }
    cancelPress();
  };
  btn.addEventListener("touchend", endTouch, { passive: false });
  btn.addEventListener("touchcancel", endTouch, { passive: false });

  // Click on click-only blocks (kebab-style) — already handled by click above.

  wrap.appendChild(btn);
  return wrap;
}

function buildDecorations(state: EditorState): DecorationSet {
  const doc = state.doc;
  const kindMap = getParserKindMap(state);
  if (!kindMap) return DecorationSet.empty;
  const items = collectDocItems(doc, kindMap);
  const decos: Decoration[] = [];
  for (const item of items) {
    if (item.kind !== "exercise") continue;
    const block = findExerciseBlock(items, item.from);
    if (!block) continue;
    decos.push(
      Decoration.widget(
        item.from + 1,
        () => buildHandle(block.from, block.to),
        {
          side: -1,
          ignoreSelection: true,
          key: `exhandle:${block.from}:${block.to}`,
        },
      ),
    );
  }
  return DecorationSet.create(doc, decos);
}

export const ExerciseHandle = Extension.create({
  name: "exerciseHandle",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        view(view) {
          currentView = view;
          return {
            destroy() {
              clearDrag();
              if (currentView === view) currentView = null;
            },
          };
        },
        // Decorations are derived on every read instead of cached in plugin
        // state — the parser plugin's state is not reliably accessible from
        // this plugin's apply() under Next dev (Turbopack chunking), so
        // computing on-demand from `state` (which by the time decorations() is
        // called has all plugin states populated) is the only stable path.
        props: {
          decorations(state) {
            return buildDecorations(state);
          },
          handleDOMEvents: {
            dragover(view, event) {
              if (!activeDrag) return false;
              const e = event as DragEvent;
              const tgt = findDropTarget(view, e.clientX, e.clientY);
              if (tgt) {
                e.preventDefault();
                paintIndicator(view, activeDrag, tgt);
              } else {
                activeDrag.target = null;
                activeDrag.indicator.style.display = "none";
              }
              return true;
            },
            drop(view, event) {
              if (!activeDrag) return false;
              const e = event as DragEvent;
              e.preventDefault();
              performDrop(view, activeDrag);
              clearDrag();
              return true;
            },
            dragend() {
              clearDrag();
              return false;
            },
          },
        },
      }),
    ];
  },
});
