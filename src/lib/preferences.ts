import type { View } from "./document";

export type Preferences = {
  appearance: "system" | "dark" | "light";
  theme:
    | "cobalt2"
    | "tokyo-night"
    | "catppuccin"
    | "rose-pine"
    | "solarized"
    | "vscode-dark-plus"
    | "github";
  font: "system" | "jetbrains" | "fantasque";
  animatedIndentGuides: boolean;
  view?: View;
};

export const defaultPreferences: Preferences = {
  appearance: "system",
  theme: "cobalt2",
  font: "system",
  animatedIndentGuides: false,
};

const key = "json-workspace.preferences.v2";
const legacyKey = "json-workspace.preferences.v1";
const themes = [
  "cobalt2",
  "tokyo-night",
  "catppuccin",
  "rose-pine",
  "solarized",
  "vscode-dark-plus",
  "github",
] as const;

export function resolveView(preferences: Preferences, width: number): View {
  return preferences.view ?? (width >= 900 ? "split" : "code");
}

export function loadPreferences(
  storage: Pick<Storage, "getItem">,
): Preferences {
  try {
    const current = storage.getItem(key);
    const value = current ? JSON.parse(current) : null;
    if (value && value.version === 2 && typeof value === "object") {
      return {
        appearance: ["system", "dark", "light"].includes(value.appearance)
          ? value.appearance
          : defaultPreferences.appearance,
        theme: themes.includes(value.theme) ? value.theme : "cobalt2",
        font: ["system", "jetbrains", "fantasque"].includes(value.font)
          ? value.font
          : defaultPreferences.font,
        animatedIndentGuides: value.animatedIndentGuides === true,
        ...(["split", "code", "tree"].includes(value.view)
          ? { view: value.view }
          : {}),
      };
    }
    const legacy = storage.getItem(legacyKey);
    const old = legacy ? JSON.parse(legacy) : null;
    if (!old || old.version !== 1 || typeof old !== "object")
      return { ...defaultPreferences };
    return {
      appearance: ["system", "dark", "light"].includes(old.appearance)
        ? old.appearance
        : defaultPreferences.appearance,
      theme: "cobalt2",
      font: ["system", "jetbrains", "fantasque"].includes(old.font)
        ? old.font
        : defaultPreferences.font,
      animatedIndentGuides: false,
      ...(["split", "code", "tree"].includes(old.view)
        ? { view: old.view }
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
  const { appearance, theme, font, animatedIndentGuides, view } = preferences;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        version: 2,
        appearance,
        theme,
        font,
        animatedIndentGuides,
        ...(view ? { view } : {}),
      }),
    );
  } catch {
    // Storage may be unavailable; the in-memory preference remains usable.
  }
}
