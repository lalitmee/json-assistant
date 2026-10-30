import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { SearchQuery } from "@codemirror/search";
import {
  createSearchQuery,
  countSearchMatches,
  preserveCaseReplacement,
  findFieldMatches,
  replaceFieldMatch,
} from "./sourceSearch";

describe("source search queries", () => {
  const options = {
    search: "cat",
    replace: "dog",
    caseSensitive: false,
    wholeWord: false,
    regexp: false,
    preserveCase: false,
  };

  it("matches decoded field text with the same literal and whole-word rules", () => {
    expect(
      findFieldMatches("Cat catapult cat", { ...options, wholeWord: true }).map(
        (m) => m.from,
      ),
    ).toEqual([0, 13]);
    expect(
      findFieldMatches("Cat cat", { ...options, caseSensitive: true }).map(
        (m) => m.from,
      ),
    ).toEqual([4]);
    expect(
      findFieldMatches("a.b axb", { ...options, search: "a.b" }),
    ).toHaveLength(1);
    expect(findFieldMatches("cat", { ...options, search: "" })).toEqual([]);
    expect(() =>
      findFieldMatches("cat", { ...options, search: "[", regexp: true }),
    ).toThrow("Invalid regular expression");
  });

  it("expands captures and preserves case in field replacements", () => {
    const config = {
      ...options,
      search: "cat(\\d+)",
      replace: "$1",
      regexp: true,
    };
    const match = findFieldMatches("cat12", config)[0];
    expect(replaceFieldMatch("cat12", match, config)).toBe("12");
    expect(
      replaceFieldMatch("CAT", findFieldMatches("CAT", options)[0], {
        ...options,
        preserveCase: true,
      }),
    ).toBe("DOG");
  });

  it("terminates zero-width field regex matching", () => {
    const matches = findFieldMatches("cat", {
      ...options,
      search: "(?=a)",
      regexp: true,
    });
    expect(matches.length).toBeLessThanOrEqual(4);
  });
  it("preserves lowercase, uppercase, and title-case match patterns", () => {
    expect(preserveCaseReplacement("cat", "dog")).toBe("dog");
    expect(preserveCaseReplacement("CAT", "dog")).toBe("DOG");
    expect(preserveCaseReplacement("Cat", "some dog")).toBe("Some dog");
    expect(preserveCaseReplacement("iPhone", "dog")).toBe("dog");
    expect(preserveCaseReplacement("123", "dog")).toBe("dog");
  });

  it("treats plain text literally and honors case and whole-word options", () => {
    const literal = createSearchQuery({
      search: "a.b",
      replace: "",
      caseSensitive: false,
      wholeWord: false,
      regexp: false,
      preserveCase: false,
    });
    expect(
      countSearchMatches(EditorState.create({ doc: "a.b axb A.B" }), literal),
    ).toBe(2);

    const regex = createSearchQuery({
      search: "a\\.b",
      replace: "",
      caseSensitive: true,
      wholeWord: true,
      regexp: true,
      preserveCase: false,
    });
    expect(
      countSearchMatches(EditorState.create({ doc: "a.b axb xa.b" }), regex),
    ).toBe(1);
  });

  it("reports invalid regex and empty queries as non-searchable", () => {
    expect(
      createSearchQuery({
        search: "[",
        replace: "",
        caseSensitive: false,
        wholeWord: false,
        regexp: true,
        preserveCase: false,
      }).valid,
    ).toBe(false);
    expect(
      createSearchQuery({
        search: "",
        replace: "",
        caseSensitive: false,
        wholeWord: false,
        regexp: false,
        preserveCase: false,
      }).valid,
    ).toBe(false);
  });

  it("counts full source matches without retaining ranges", () => {
    const query = new SearchQuery({ search: "needle", literal: true });
    const doc = `needle${"x".repeat(5000)}needle`;
    expect(countSearchMatches(EditorState.create({ doc }), query)).toBe(2);
  });
});
