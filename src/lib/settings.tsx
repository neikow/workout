"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { WorkoutContext } from "@/components/editor/types";

const STORAGE_KEY = "workout:settings-v1";

export const DEFAULT_SETTINGS: WorkoutContext = {
  warmupMarker: "E",
  dateFormat: "DD/MM[/YYYY]",
  theme: "system",
};

let cached: WorkoutContext | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): WorkoutContext {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(raw) as Partial<WorkoutContext>),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getSnapshot(): WorkoutContext {
  if (cached === null) cached = readFromStorage();
  return cached;
}

function getServerSnapshot(): WorkoutContext {
  return DEFAULT_SETTINGS;
}

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cached = null;
    notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateSettings(patch: Partial<WorkoutContext>) {
  const next = { ...getSnapshot(), ...patch };
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  notify();
}

export function useSettings(): WorkoutContext {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ThemeApplier() {
  const { theme } = useSettings();
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "system") {
      html.removeAttribute("data-theme");
    } else {
      html.setAttribute("data-theme", theme);
    }
  }, [theme]);
  return null;
}
