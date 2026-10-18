import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  loadPreferences,
  resolveView,
  savePreferences,
} from "./preferences";

const stored = (value: string | null) => ({
  getItem: (key: string) =>
    key.endsWith(".v1") ? value : key.endsWith(".v2") ? value : null,
});

describe("presentation preferences", () => {
  it("defaults to Cobalt2", () => {
    expect(defaultPreferences.theme).toBe("cobalt2");
  });

  it("persists the animation setting and ignores retired rainbow settings", () => {
    const preferences = {
      ...defaultPreferences,
      animatedIndentGuides: true,
    };
    let saved = "";
    savePreferences({ setItem: (_key, value) => (saved = value) }, preferences);
    expect(loadPreferences(stored(saved))).toEqual(preferences);
    expect(loadPreferences(stored('{"version":2}'))).toEqual(
      defaultPreferences,
    );
    expect(
      loadPreferences(stored('{"version":2,"rainbowIndentGuides":true}')),
    ).toEqual(defaultPreferences);
  });

  it("loads every supported v2 theme and rejects unknown themes", () => {
    for (const theme of [
      "cobalt2",
      "tokyo-night",
      "catppuccin",
      "rose-pine",
      "solarized",
      "vscode-dark-plus",
      "github",
    ]) {
      const storage = {
        getItem: (key: string) =>
          key.endsWith(".v2") ? JSON.stringify({ version: 2, theme }) : null,
      };
      expect(loadPreferences(storage).theme).toBe(theme);
    }
    const unknown = {
      getItem: (key: string) =>
        key.endsWith(".v2")
          ? JSON.stringify({ version: 2, theme: "unknown" })
          : null,
    };
    expect(loadPreferences(unknown).theme).toBe("cobalt2");
  });

  it("loads each packaged editor font choice", () => {
    for (const font of ["system", "jetbrains", "iosevka", "cascadia", "fira"]) {
      expect(
        loadPreferences(stored(JSON.stringify({ version: 2, font }))).font,
      ).toBe(font);
    }
  });

  it("migrates split legacy themes to Cobalt2 and retains compatible preferences", () => {
    const legacy = {
      getItem: (key: string) =>
        key.endsWith(".v1")
          ? JSON.stringify({
              version: 1,
              appearance: "light",
              palette: "forest",
              editorTheme: "paper",
              font: "jetbrains",
              view: "tree",
            })
          : null,
    };
    expect(loadPreferences(legacy)).toEqual({
      ...defaultPreferences,
      appearance: "light",
      font: "jetbrains",
      view: "tree",
    });
  });

  it("defaults for missing, malformed, obsolete or blocked storage", () => {
    expect(loadPreferences(stored(null))).toEqual(defaultPreferences);
    expect(loadPreferences(stored("not json"))).toEqual(defaultPreferences);
    expect(
      loadPreferences({
        getItem: (key: string) =>
          key.endsWith(".v2") ? '{"version":3,"appearance":"dark"}' : null,
      }),
    ).toEqual(defaultPreferences);
    expect(
      loadPreferences({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual(defaultPreferences);
  });

  it("retains only recognized choices", () => {
    expect(
      loadPreferences(
        stored(
          JSON.stringify({
            version: 2,
            appearance: "light",
            theme: "bad",
            font: "bad",
            view: "tree",
            source: "secret",
          }),
        ),
      ),
    ).toEqual({
      ...defaultPreferences,
      appearance: "light",
      view: "tree",
    });
  });

  it("saves only UI choices to v2 and survives unavailable storage", () => {
    let saved = "";
    let savedKey = "";
    savePreferences(
      {
        setItem: (key, value) => {
          savedKey = key;
          saved = value;
        },
      },
      { ...defaultPreferences, appearance: "dark", source: "private" } as any,
    );
    expect(savedKey).toBe("json-workspace.preferences.v2");
    expect(JSON.parse(saved)).toEqual({
      version: 2,
      appearance: "dark",
      theme: "cobalt2",
      font: "system",
      animatedIndentGuides: false,
    });
    expect(() =>
      savePreferences(
        {
          setItem: () => {
            throw new Error("blocked");
          },
        },
        defaultPreferences,
      ),
    ).not.toThrow();
  });

  it("uses responsive defaults unless a view was explicitly chosen", () => {
    expect(resolveView(defaultPreferences, 899)).toBe("code");
    expect(resolveView(defaultPreferences, 900)).toBe("split");
    expect(resolveView({ ...defaultPreferences, view: "split" }, 400)).toBe(
      "split",
    );
  });
});
