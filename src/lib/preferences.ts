import type { View } from "./document";

export type Preferences = {
  appearance: "system" | "dark" | "light";
  palette: "ocean" | "graphite" | "forest";
  editorTheme: "midnight" | "orchid" | "paper";
  font: "system" | "jetbrains" | "fantasque";
  view?: View;
};

export const defaultPreferences: Preferences = {
  appearance: "system",
  palette: "ocean",
  editorTheme: "midnight",
  font: "system",
};

const key = "json-workspace.preferences.v1";

export function resolveView(preferences: Preferences, width: number): View {
  return preferences.view ?? (width >= 900 ? "split" : "code");
}

export function loadPreferences(
  storage: Pick<Storage, "getItem">,
): Preferences {
  try {
    const raw = storage.getItem(key);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || value.version !== 1 || typeof value !== "object")
      return { ...defaultPreferences };
    return {
      appearance: ["system", "dark", "light"].includes(value.appearance)
        ? value.appearance
        : defaultPreferences.appearance,
      palette: ["ocean", "graphite", "forest"].includes(value.palette)
        ? value.palette
        : defaultPreferences.palette,
      editorTheme: ["midnight", "orchid", "paper"].includes(value.editorTheme)
        ? value.editorTheme
        : defaultPreferences.editorTheme,
      font: ["system", "jetbrains", "fantasque"].includes(value.font)
        ? value.font
        : defaultPreferences.font,
      ...(["split", "code", "tree"].includes(value.view)
        ? { view: value.view }
        : {}),
    };
  } catch {
    return { ...defaultPreferences };
  }
}

export function savePreferences(
  storage: Pick<Storage, "setItem">,
  preferences: Preferences,
): void {
  const { appearance, palette, editorTheme, font, view } = preferences;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        appearance,
        palette,
        editorTheme,
        font,
        ...(view ? { view } : {}),
      }),
    );
  } catch {
    // Storage may be unavailable; the in-memory preference remains usable.
  }
}
