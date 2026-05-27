"use client";

import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

export interface SynonymGroup {
  id: string;
  canonical: string;
  variants: string[];
}

const KEY = "synonyms";

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getSynonyms(ydoc: Y.Doc): Y.Array<SynonymGroup> {
  return ydoc.getArray<SynonymGroup>(KEY);
}

/** Resolve a name to its canonical form, or null if it's already canonical or
 *  unknown. Matching is case/whitespace-insensitive. */
export function canonicalFor(
  name: string,
  groups: SynonymGroup[],
): string | null {
  const n = normalizeName(name);
  if (!n) return null;
  for (const g of groups) {
    if (normalizeName(g.canonical) === n) return null;
    if (g.variants.some((v) => normalizeName(v) === n)) return g.canonical;
  }
  return null;
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function addSynonymGroup(ydoc: Y.Doc, canonical: string): void {
  const trimmed = canonical.trim();
  if (!trimmed) return;
  getSynonyms(ydoc).push([{ id: newId(), canonical: trimmed, variants: [] }]);
}

export function updateSynonymGroup(
  ydoc: Y.Doc,
  id: string,
  patch: Partial<Omit<SynonymGroup, "id">>,
): void {
  const arr = getSynonyms(ydoc);
  const idx = arr.toArray().findIndex((g) => g.id === id);
  if (idx === -1) return;
  const current = arr.get(idx);
  ydoc.transact(() => {
    arr.delete(idx, 1);
    arr.insert(idx, [{ ...current, ...patch }]);
  });
}

export function removeSynonymGroup(ydoc: Y.Doc, id: string): void {
  const arr = getSynonyms(ydoc);
  const idx = arr.toArray().findIndex((g) => g.id === id);
  if (idx !== -1) arr.delete(idx, 1);
}

export function useSynonyms(ydoc: Y.Doc): SynonymGroup[] {
  const arr = useMemo(() => getSynonyms(ydoc), [ydoc]);
  const [groups, setGroups] = useState<SynonymGroup[]>(() => arr.toArray());
  useEffect(() => {
    const update = () => setGroups(arr.toArray());
    update();
    arr.observeDeep(update);
    return () => arr.unobserveDeep(update);
  }, [arr]);
  return groups;
}
