import { describe, expect, it, vi, afterEach } from "vitest";
import { immutableJSONPatch } from "immutable-json-patch";
import {
  collectTreeMatches,
  planTreeReplacement,
  createTreeSearch,
  iterateTreeMatches,
} from "./treeSearch";
import type { SearchOptions } from "./sourceSearch";
import { parse, stringify } from "lossless-json";

const options: SearchOptions = {
  search: "cat",
  replace: "dog",
  caseSensitive: false,
  wholeWord: false,
  regexp: false,
  preserveCase: false,
};
function replace(json: unknown, config = options) {
  return immutableJSONPatch(
    json,
    planTreeReplacement(json, collectTreeMatches(json, config), config),
  );
}
describe("Tree field search", () => {
  it("yields before reading an entire wide container", () => {
    let reads = 0;
    const json = Object.fromEntries(
      Array.from({ length: 2000 }, (_, i) => [String(i), "cat"]),
    );
    for (const key of Object.keys(json))
      Object.defineProperty(json, key, {
        enumerable: true,
        get: () => {
          reads++;
          return "cat";
        },
      });
    const iterator = iterateTreeMatches(json, options);
    iterator.next();
    iterator.next();
    expect(reads).toBeLessThan(10);
  });
  it("treats lossless numbers as numeric values without losing precision", () => {
    const json = parse('{"n":9007199254740992}');
    const config = { ...options, search: "40992", replace: "40993" };
    const matches = collectTreeMatches(json, config);
    expect(matches.map((match) => match.path)).toEqual([["n"]]);
    expect(
      stringify(
        immutableJSONPatch(json, planTreeReplacement(json, matches, config)),
      ),
    ).toBe('{"n":9007199254740993}');
  });
  it("matches keys before decoded values and ignores array indices", () => {
    expect(
      collectTreeMatches({ cat: "cat cat" }, options).map((m) => m.field),
    ).toEqual(["key", "value", "value"]);
    expect(collectTreeMatches(["cat"], { ...options, search: "0" })).toEqual(
      [],
    );
    expect(collectTreeMatches("cat", options)[0].path).toEqual([]);
  });
  it("applies nested edits before ancestor renames without mutating input", () => {
    const json = { cat: { cat: "cat cat" } };
    expect(replace(json)).toEqual({ dog: { dog: "dog dog" } });
    expect(json).toEqual({ cat: { cat: "cat cat" } });
  });
  it("rejects collisions atomically", () => {
    expect(() => replace({ cat: 1, dog: 2 })).toThrow(/duplicate/i);
    expect(() => replace({ cat: 1, CAT: 2 })).toThrow(/duplicate/i);
  });
  it("preserves primitive types and rejects invalid conversions", () => {
    expect(replace(12, { ...options, search: "2", replace: "3" })).toBe(13);
    expect(replace("12", { ...options, search: "2", replace: "x" })).toBe("1x");
    for (const [json, search, replacement] of [
      [12, "2", "x"],
      [true, "true", "1"],
      [null, "null", '"x"'],
    ] as const)
      expect(() =>
        replace(json, { ...options, search, replace: replacement }),
      ).toThrow(/type|valid/i);
  });
  it("escapes pointers and handles prototype-named own properties safely", () => {
    expect(replace({ "cat/~": "cat" })).toEqual({ "dog/~": "dog" });
    const json = JSON.parse(
      '{"__proto__":"cat","constructor":"cat","prototype":"cat"}',
    );
    const result = replace(json);
    expect(Object.getOwnPropertyDescriptor(result, "__proto__")?.value).toBe(
      "dog",
    );
    expect(Object.getOwnPropertyDescriptor(result, "constructor")?.value).toBe(
      "dog",
    );
    expect({}.constructor).toBe(Object);
  });
});

describe("Tree controller", () => {
  it("keeps the selected occurrence when replacement options change", () => {
    const { controller, apply } = setup();
    vi.runAllTimers();
    controller.next();
    controller.next();
    controller.configure({ ...options, replace: "fox", preserveCase: true });
    vi.runAllTimers();
    expect(controller.snapshot().current).toBe(3);
    controller.replace();
    expect(apply.mock.calls[0][0]).toEqual([
      { op: "replace", path: "/cat", value: "cat fox" },
    ]);
  });
  it("rejects invalid regex even for empty containers", () => {
    const { controller } = setup("{}");
    controller.configure({ ...options, search: "[", regexp: true });
    vi.runAllTimers();
    expect(controller.snapshot().error).toMatch(/regular expression/i);
  });
  afterEach(() => vi.useRealTimers());
  function setup(source = '{"cat":"cat cat"}') {
    vi.useFakeTimers();
    let revision = 0,
      processing = false,
      available = true;
    const reveal = vi.fn(),
      undo = vi.fn(),
      focus = vi.fn(),
      visibility = vi.fn();
    const apply = vi.fn((operations) => {
      source = JSON.stringify(
        immutableJSONPatch(JSON.parse(source), operations),
      );
      revision++;
    });
    const controller = createTreeSearch({
      source: () => source,
      revision: () => revision,
      isProcessing: () => processing,
      available: () => available,
      reveal,
      undo,
      focus,
      visibility,
      apply,
    });
    controller.open();
    controller.configure(options);
    return {
      controller,
      apply,
      reveal,
      undo,
      focus,
      visibility,
      edit: (next: string) => {
        source = next;
        revision++;
      },
      busy: () => (processing = true),
      unavailable: () => (available = false),
    };
  }
  it("publishes pending state then counts and wraps occurrences", () => {
    const { controller, reveal } = setup();
    expect(controller.snapshot().counting).toBe(true);
    vi.runAllTimers();
    expect(controller.snapshot()).toMatchObject({
      total: 3,
      current: 1,
      counting: false,
    });
    controller.next(true);
    expect(controller.snapshot().current).toBe(3);
    controller.next();
    expect(controller.snapshot().current).toBe(1);
    expect(reveal).toHaveBeenCalled();
  });
  it("cancels stale queries and revisions and destroyed scans", () => {
    const { controller, edit, reveal } = setup(
      JSON.stringify(Array(2000).fill("cat")),
    );
    controller.configure({ ...options, search: "dog" });
    edit('["dog"]');
    controller.documentChanged();
    vi.runAllTimers();
    expect(controller.snapshot().total).toBe(1);
    edit('["cat"]');
    controller.replace(true);
    expect(controller.snapshot().canUndoReplacement).toBe(false);
    controller.configure(options);
    controller.destroy();
    reveal.mockClear();
    vi.runAllTimers();
    expect(reveal).not.toHaveBeenCalled();
  });
  it("submits all replacements once with revision-gated undo", () => {
    const { controller, apply, undo, edit } = setup();
    vi.runAllTimers();
    controller.replace(true);
    expect(apply).toHaveBeenCalledTimes(1);
    controller.documentChanged();
    vi.runAllTimers();
    expect(controller.snapshot().canUndoReplacement).toBe(true);
    controller.undoReplacement();
    expect(undo).toHaveBeenCalledTimes(1);
    edit('"cat"');
    controller.documentChanged();
    vi.runAllTimers();
    expect(controller.snapshot().canUndoReplacement).toBe(false);
  });
  it("rejects atomic collisions, processing and unavailable edits", () => {
    const collision = setup('{"cat":1,"dog":2}');
    vi.runAllTimers();
    collision.controller.replace(true);
    expect(collision.apply).not.toHaveBeenCalled();
    expect(collision.controller.snapshot().error).toMatch(/duplicate/);
    const busy = setup();
    vi.runAllTimers();
    busy.busy();
    busy.controller.replace(true);
    expect(busy.apply).not.toHaveBeenCalled();
    const hidden = setup();
    vi.runAllTimers();
    hidden.unavailable();
    hidden.controller.replace(true);
    expect(hidden.apply).not.toHaveBeenCalled();
    hidden.controller.close();
    expect(hidden.focus).toHaveBeenCalled();
  });
});
