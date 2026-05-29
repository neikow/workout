"use client";

import { useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import type { WorkoutContext } from "@/components/editor/types";
import type { SynonymGroup } from "@/lib/synonyms";
import { docToText } from "@/lib/ydoc-text";
import { segmentDays } from "./segment";
import type { ExerciseStats, StatsRequest, StatsResponse } from "./types";

const DEBOUNCE_MS = 300;

export interface StatsState {
  exercises: ExerciseStats[];
  status: "loading" | "ready";
  meta: { computedDays: number; cachedDays: number } | null;
}

/**
 * Compute per-exercise statistics off the main thread. The worker keeps a
 * day-level parse cache, so live document edits (or a synced delta from another
 * device) only re-parse the days that actually changed. Recomputes when the
 * doc, the workout context, or the synonym registry changes.
 */
export function useExerciseStats(
  ydoc: Y.Doc,
  ctx: WorkoutContext,
  synonyms: SynonymGroup[],
): StatsState {
  const [state, setState] = useState<StatsState>({
    exercises: [],
    status: "loading",
    meta: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  // Keep the latest inputs reachable from the document observer without
  // re-subscribing it on every settings/synonym change.
  const ctxRef = useRef(ctx);
  const synonymsRef = useRef(synonyms);

  useEffect(() => {
    const worker = new Worker(new URL("./stats.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.addEventListener("message", (e: MessageEvent<StatsResponse>) => {
      if (e.data.requestId !== requestIdRef.current) return; // stale
      setState({
        exercises: e.data.exercises,
        status: "ready",
        meta: {
          computedDays: e.data.computedDays,
          cachedDays: e.data.cachedDays,
        },
      });
    });

    const compute = () => {
      const segments = segmentDays(docToText(ydoc), ctxRef.current);
      const request: StatsRequest = {
        segments,
        ctx: ctxRef.current,
        synonyms: synonymsRef.current,
        requestId: ++requestIdRef.current,
      };
      worker.postMessage(request);
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(compute, DEBOUNCE_MS);
    };

    const fragment = ydoc.getXmlFragment("default");
    fragment.observeDeep(schedule);
    // Initial compute is driven by the context effect below (runs on mount too),
    // so the worker exists before the first message is posted.

    return () => {
      if (timer) clearTimeout(timer);
      fragment.unobserveDeep(schedule);
      worker.terminate();
      workerRef.current = null;
    };
  }, [ydoc]);

  // Context / synonym changes don't touch the doc observer, so keep the refs it
  // reads in sync here and recompute. Runs on mount too (the initial compute).
  useEffect(() => {
    ctxRef.current = ctx;
    synonymsRef.current = synonyms;
    const worker = workerRef.current;
    if (!worker) return;
    const segments = segmentDays(docToText(ydoc), ctx);
    worker.postMessage({
      segments,
      ctx,
      synonyms,
      requestId: ++requestIdRef.current,
    } satisfies StatsRequest);
  }, [ydoc, ctx, synonyms]);

  return state;
}
