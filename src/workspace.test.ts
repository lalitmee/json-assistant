import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import App from "./App.svelte";

describe("workspace controls", () => {
  it("keeps document history beside code formatting without a separate history strip", () => {
    const { body } = render(App);
    expect(body.indexOf("Format")).toBeGreaterThan(
      body.indexOf('aria-label="Source pane"'),
    );
    expect(body).toMatch(
      /aria-label="Source pane"[\s\S]*aria-label="Undo document change"[\s\S]*Format/,
    );
    expect(body).not.toContain('class="history-strip"');
  });
  it("puts a validity badge inside the app header and labels icon actions", () => {
    const { body } = render(App);
    expect(body).toMatch(
      /class="workspace-header"[\s\S]*class="status-badge"[\s\S]*2 bytes[\s\S]*<\/header>/,
    );
    expect(body).toMatch(/aria-label="Copy subtree"[^>]*><svg/);
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
  it("exposes independent presentation choices without changing document bytes", () => {
    const { body } = render(App);
    expect(body).toContain('data-appearance="system"');
    expect(body).toContain('data-palette="ocean"');
    expect(body).toContain('data-editor-theme="midnight"');
    expect(body).toContain('data-editor-font="system"');
    expect(body).toContain('<pre data-testid="source">{}</pre>');
    expect(body).toContain('data-testid="revision" hidden="">0');
  });
  it("uses a labeled icon-only Back action alongside the app mark", () => {
    const { body } = render(App);
    expect(body).toMatch(/aria-label="Back to workspace"[^>]*><svg/);
    expect(body).toContain('class="brand-mark"');
    expect(body).not.toContain("JSON workspace / Preferences");
  });
});
