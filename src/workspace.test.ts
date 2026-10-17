import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import App from "./App.svelte";

describe("workspace controls", () => {
  it("keeps format next to code and history above both panes", () => {
    const { body } = render(App);
    expect(body.indexOf("Format")).toBeGreaterThan(
      body.indexOf('aria-label="Source pane"'),
    );
    expect(body.indexOf('aria-label="Undo"')).toBeLessThan(
      body.indexOf('class="panes"'),
    );
  });
});
