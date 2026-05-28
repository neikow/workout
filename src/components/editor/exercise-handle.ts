import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { Decoration, DecorationSet } from "prosemirror-view";
import { parserPluginKey } from "./workout-parser";
import {
  type BlockRange,
  collectDocItems,
  findDayBounds,
  findExerciseBlock,
} from "./exercise-block";

const key = new PluginKey<DecorationSet>("exerciseHandle");

export const EXERCISE_HANDLE_EVENT = "workout:exercise-handle";

export interface ExerciseHandleEventDetail {
  from: number;
  to: number;
  anchorRect: DOMRect;
}

const LONG_PRESS_MS = 380;
const LONG_PRESS_TOLERANCE_PX = 10;

interface DragState {
  source: { from: number; to: number };
  indicator: HTMLDivElement;
  target: { block: BlockRange; position: "above" | "below" } | null;
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
): { block: BlockRange; position: "above" | "below"; dayFrom: number } | null {
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;
  const kindByPos = parserPluginKey.getState(view.state)?.kindByPos;
  if (!kindByPos) return null;
  const items = collectDocItems(view.state.doc, kindByPos);
  const block = findExerciseBlock(items, coords.pos);
  if (!block) return null;
  const day = findDayBounds(items, block.from);
  if (!day) return null;
  const dom = view.nodeDOM(block.from);
  let position: "above" | "below" = "below";
  if (dom instanceof HTMLElement) {
    const rect = dom.getBoundingClientRect();
    position = clientY < rect.top + rect.height / 2 ? "above" : "below";
  }
  return { block, position, dayFrom: day.from };
}

function isSameDay(
  view: EditorView,
  sourceFrom: number,
  targetBlockFrom: number,
) {
  const kindByPos = parserPluginKey.getState(view.state)?.kindByPos;
  if (!kindByPos) return false;
  const items = collectDocItems(view.state.doc, kindByPos);
  const sourceDay = findDayBounds(items, sourceFrom);
  const targetDay = findDayBounds(items, targetBlockFrom);
  return !!sourceDay && !!targetDay && sourceDay.from === targetDay.from;
}

function paintIndicator(
  view: EditorView,
  drag: DragState,
  target: { block: BlockRange; position: "above" | "below" },
) {
  const dom = view.nodeDOM(target.block.from);
  if (!(dom instanceof HTMLElement)) return;
  const rect = dom.getBoundingClientRect();
  const editorRect = view.dom.getBoundingClientRect();
  const top = target.position === "above" ? rect.top - 1 : rect.bottom - 1;
  drag.indicator.style.left = `${editorRect.left + 8}px`;
  drag.indicator.style.width = `${editorRect.width - 16}px`;
  drag.indicator.style.top = `${top}px`;
  drag.indicator.style.display = "block";
  drag.target = target;
}

function performDrop(view: EditorView, drag: DragState) {
  if (!drag.target) return;
  const sourceFrom = drag.source.from;
  const targetBlockFrom = drag.target.block.from;
  if (sourceFrom === targetBlockFrom) return;

  const kindByPos = parserPluginKey.getState(view.state)?.kindByPos;
  if (!kindByPos) return;
  const items = collectDocItems(view.state.doc, kindByPos);
  const liveSource = findExerciseBlock(items, sourceFrom);
  if (!liveSource) return;
  const liveDay = findDayBounds(items, liveSource.from);
  const targetDay = findDayBounds(items, targetBlockFrom);
  if (!liveDay || !targetDay || liveDay.from !== targetDay.from) return;

  const dropPos =
    drag.target.position === "above"
      ? drag.target.block.from
      : drag.target.block.to;
  if (dropPos > liveSource.from && dropPos < liveSource.to) return;

  const sourceSlice = view.state.doc.slice(liveSource.from, liveSource.to);
  const tr = view.state.tr;
  tr.insert(dropPos, sourceSlice.content);
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
    '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">' +
    '<circle cx="2" cy="3" r="1.2"/><circle cx="2" cy="8" r="1.2"/><circle cx="2" cy="13" r="1.2"/>' +
    '<circle cx="8" cy="3" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="13" r="1.2"/>' +
    "</svg>";

  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
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
        if (
          tgt &&
          isSameDay(currentView, activeDrag.source.from, tgt.block.from)
        ) {
          paintIndicator(currentView, activeDrag, {
            block: tgt.block,
            position: tgt.position,
          });
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
  const kindMap = parserPluginKey.getState(state)?.kindByPos;
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
        state: {
          init(_, state) {
            return buildDecorations(state);
          },
          apply(tr, old, oldState, newState) {
            const parserChanged =
              parserPluginKey.getState(oldState) !==
              parserPluginKey.getState(newState);
            if (!tr.docChanged && !parserChanged) return old;
            return buildDecorations(newState);
          },
        },
        props: {
          decorations(state) {
            return key.getState(state);
          },
          handleDOMEvents: {
            dragover(view, event) {
              if (!activeDrag) return false;
              const e = event as DragEvent;
              const tgt = findDropTarget(view, e.clientX, e.clientY);
              if (
                tgt &&
                isSameDay(view, activeDrag.source.from, tgt.block.from)
              ) {
                e.preventDefault();
                paintIndicator(view, activeDrag, {
                  block: tgt.block,
                  position: tgt.position,
                });
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
