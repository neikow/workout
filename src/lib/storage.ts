"use client";

// Pre-CRDT local storage adapter. Kept as read-only for one-time bootstrap of
// devices that still have a workout doc cached from the old single-blob
// IndexedDB store. Once a user's content has been migrated into the Yjs IDB
// (handled by the editor on first run), the legacy entry is cleared and this
// module becomes a no-op for that device.

import { type IDBPDatabase, openDB } from "idb";

const DB_NAME = "workout";
const DB_VERSION = 1;
const STORE = "kv";
const CONTENT_KEY = "content";
const LEGACY_LOCALSTORAGE_KEY = "workout:content-v1";

type WorkoutDB = IDBPDatabase<unknown>;

let dbPromise: Promise<WorkoutDB> | null = null;

function getDb(): Promise<WorkoutDB> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

async function migrateFromLocalStorage(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) return null;
    const db = await getDb();
    await db.put(STORE, raw, CONTENT_KEY);
    window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    return raw;
  } catch {
    return null;
  }
}

export async function loadLocalContent(): Promise<string | null> {
  try {
    const db = await getDb();
    const v = await db.get(STORE, CONTENT_KEY);
    if (typeof v === "string") return v;
    return await migrateFromLocalStorage();
  } catch {
    return null;
  }
}

export async function clearLocalContent(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, CONTENT_KEY);
  } catch {
    // ignore
  }
}
