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
  it("renders settings while preserving the workspace pane subtree", () => {
    const { body } = render(App);
    expect(body).toContain('aria-label="Open settings"');
    expect(body).toContain('aria-label="Settings"');
    expect(body).toContain("Preferences stay in this browser");
    expect(body.indexOf('aria-label="Workspace layout"')).toBeGreaterThan(
      body.indexOf('aria-label="Settings"'),
    );
    expect(body).toContain('aria-label="Source pane"');
    expect(body).toContain('aria-label="Back to workspace"');
  });
});
