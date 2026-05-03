import { afterEach, beforeEach, describe, expect, it } from "vitest";

const STORAGE_KEY = "workout:settings-v1";

async function freshSettings() {
  const mod = await import("./settings");
  return mod;
}

describe("settings storage (DEFAULT_SETTINGS + updateSettings)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // reset module cache so module-level `cached` resets between tests
    return import("vitest").then(({ vi }) => vi.resetModules());
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("DEFAULT_SETTINGS has expected defaults", async () => {
    const { DEFAULT_SETTINGS } = await freshSettings();
    expect(DEFAULT_SETTINGS).toEqual({
      warmupMarker: "E",
      dateFormat: "DD/MM[/YYYY]",
      theme: "system",
    });
  });

  it("updateSettings persists patch to localStorage", async () => {
    const { updateSettings } = await freshSettings();
    updateSettings({ theme: "dark" });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored).toEqual({
      warmupMarker: "E",
      dateFormat: "DD/MM[/YYYY]",
      theme: "dark",
    });
  });

  it("updateSettings merges patch with existing storage", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: "light", warmupMarker: "W" }),
    );
    const { updateSettings } = await freshSettings();
    updateSettings({ theme: "monokai" });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.theme).toBe("monokai");
    expect(stored.warmupMarker).toBe("W");
    expect(stored.dateFormat).toBe("DD/MM[/YYYY]");
  });

  it("falls back to defaults on malformed JSON", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    const { updateSettings, DEFAULT_SETTINGS } = await freshSettings();
    updateSettings({ theme: "dark" });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored).toEqual({ ...DEFAULT_SETTINGS, theme: "dark" });
  });

  it("partial stored object is filled with defaults", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: "light" }),
    );
    const { updateSettings, DEFAULT_SETTINGS } = await freshSettings();
    updateSettings({ warmupMarker: "X" });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored).toEqual({
      ...DEFAULT_SETTINGS,
      theme: "light",
      warmupMarker: "X",
    });
  });
});
