import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  loadPreferences,
  resolveView,
  savePreferences,
} from "./preferences";

const stored = (value: string | null) => ({ getItem: () => value });

describe("presentation preferences", () => {
  it("defaults for missing, malformed, obsolete or blocked storage", () => {
    expect(loadPreferences(stored(null))).toEqual(defaultPreferences);
    expect(loadPreferences(stored("not json"))).toEqual(defaultPreferences);
    expect(
      loadPreferences(stored('{"version":2,"appearance":"dark"}')),
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
            version: 1,
            appearance: "light",
            palette: "bad",
            editorTheme: "paper",
            font: "bad",
            view: "tree",
            source: "secret",
          }),
        ),
      ),
    ).toEqual({
      ...defaultPreferences,
      appearance: "light",
      editorTheme: "paper",
      view: "tree",
    });
  });

  it("saves only UI choices and survives unavailable storage", () => {
    let saved = "";
    savePreferences(
      {
        setItem: (_key, value) => {
          saved = value;
        },
      },
      { ...defaultPreferences, appearance: "dark", source: "private" } as any,
    );
    expect(JSON.parse(saved)).toEqual({
      version: 1,
      appearance: "dark",
      palette: "ocean",
      editorTheme: "midnight",
      font: "system",
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
