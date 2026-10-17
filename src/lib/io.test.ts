import { describe, expect, it } from "vitest";
import { subtreeSource } from "./io";

describe("source-preserving local I/O", () => {
  it("slices a subtree without changing numeric or string tokens", () => {
    const source = String.raw`{"n":9007199254740993,"s":"\u0061","obj":{"x":1.2300}}`;
    expect(subtreeSource(source, ["obj"])).toBe('{"x":1.2300}');
  });

  it("preserves numeric array path segments", () => {
    expect(subtreeSource('[{"n":1.2300}]', [0])).toBe('{"n":1.2300}');
  });

  it.each(['{"a":', String.raw`{"a":1,"\u0061":2}`])(
    "rejects invalid or duplicate source: %s",
    (source) => {
      expect(subtreeSource(source, ["a"])).toBe("");
    },
  );
});
