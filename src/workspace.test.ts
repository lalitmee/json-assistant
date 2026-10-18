import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import App from "./App.svelte";
import { readFileSync } from "node:fs";

describe("workspace controls", () => {
  it("keeps document history in the code header without a separate history strip", () => {
    const { body } = render(App);
    expect(body).toMatch(
      /aria-label="Source pane"[\s\S]*class="pane-actions"[\s\S]*aria-label="Undo document change"/,
    );
    expect(body).not.toContain('class="history-strip"');
  });
  it("puts a validity badge inside the app header and labels icon actions", () => {
    const { body } = render(App);
    expect(body).toMatch(
      /class="workspace-header"[\s\S]*class="status-badge"[\s\S]*2 bytes[\s\S]*<\/header>/,
    );
    expect(body).toContain('aria-label="Open settings"');
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
    expect(body).toContain("JSON Assistant");
    expect(body).not.toContain("JSON workspace");
  });
  it("groups filename and status and uses the same logo asset in both headers", () => {
    const { body } = render(App);
    expect(body).toMatch(
      /class="document-meta"[\s\S]*document\.json[\s\S]*class="status-badge"/,
    );
    expect(body.match(/src="\/logo\.svg"/g)).toHaveLength(2);
    expect(body).toMatch(/aria-label="Open settings"[^>]*><svg/);
    expect(body).toMatch(
      /aria-label="Undo document change"[\s\S]*role="tooltip"[^>]*>Undo document change/,
    );
    expect(body).toMatch(
      /aria-label="Open settings"[^>]*><svg[^>]*><path d="M19\.14,12\.94/,
    );
    expect(body).toMatch(
      /aria-label="Undo document change"[^>]*><svg[^>]*><path d="M12\.5 8/,
    );
  });
  it("right-aligns history tooltips within the code pane", () => {
    const { body } = render(App);
    expect(body).toMatch(
      /class="tooltip-anchor[^\"]*" data-align="end"><button class="icon-button" aria-label="Undo document change"/,
    );
    expect(body).toMatch(
      /class="tooltip-anchor[^\"]*" data-align="end"><button class="icon-button" aria-label="Redo document change"/,
    );
  });
  it("hides document actions on the untouched starter while keeping history visible", () => {
    const { body } = render(App);
    for (const label of [
      "Copy JSON",
      "Download",
      "Clear document",
      "Search fields",
      "Copy path",
      "Copy subtree",
    ]) {
      expect(body).not.toContain(`aria-label="${label}"`);
    }
    expect(body).not.toContain(">Format</button>");
    expect(body).not.toContain(">Minify</button>");
    expect(body).toContain('aria-label="Undo document change"');
    expect(body).toContain('aria-label="Redo document change"');
  });
  it("uses a shared header and connected workspace view control on settings", () => {
    const { body } = render(App);
    expect(body).toMatch(
      /class="settings-header workspace-header"[\s\S]*JSON Assistant/,
    );
    expect(body).toContain('role="group" aria-label="Workspace view"');
    expect(body).toContain('class="segment-indicator"');
  });
  it("keeps header vertical padding compact", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.workspace-header\s*\{[^}]*padding:\s*8px 12px/);
  });
  it("keeps the workspace view label and narrower toggle on one row", () => {
    const { body } = render(App);
    expect(body).toMatch(
      /class="workspace-view-heading"[\s\S]*class="workspace-view-label"[\s\S]*<h2>Workspace view<\/h2>[\s\S]*Choose how you work with your document\.[\s\S]*class="segmented-control"/,
    );
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /\.segmented-control \{[\s\S]*?width: min\(100%, 300px\)/,
    );
  });
  it("keeps dropdown corners moderate while other controls are pill-shaped", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /button:where\(:not\(\.jse-main button\)\)\s*\{[^}]*border-radius: 999px/,
    );
    expect(css).toMatch(/\.dropdown-trigger\s*\{[^}]*border-radius: 9px/);
    expect(css).toMatch(/\.dropdown-options\s*\{[^}]*border-radius: 10px/);
    expect(css).toMatch(
      /\.dropdown-options button\s*\{[^}]*border-radius: 9px/,
    );
    expect(css).toMatch(/\.segmented-control\s*\{[^}]*border-radius: 999px/);
    expect(css).toMatch(/\.segment-indicator\s*\{[^}]*border-radius: 999px/);
  });
  it("passes the selected font to the JSON editor's monospace font variable", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(/--jse-font-family-mono:\s*var\(--editor-font\)/);
  });
  it("keeps global hover paint off the sliding segment indicator", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /button:where\(:not\(\.jse-main button\):not\(\.segmented-control button\)\):hover:not\(\s*:disabled\s*\)/,
    );
  });
  it("renders an accessible icon toggle for mode and dropdowns for other preferences", () => {
    const { body } = render(App);
    expect(body).toMatch(
      /class="preference-field"[\s\S]*class="preference-label">Mode<\/span>[\s\S]*role="group" aria-label="Mode"/,
    );
    for (const mode of ["System", "Dark", "Light"])
      expect(body).toMatch(
        new RegExp(`aria-label="${mode}"[^>]*aria-pressed="(?:true|false)"`),
      );
    for (const icon of ["computer", "dark_mode", "light_mode"]) {
      expect(body).toContain(`data-material-icon="${icon}"`);
      expect(
        readFileSync(
          new URL(`../public/icons/material/${icon}.svg`, import.meta.url),
          "utf8",
        ),
      ).toContain("<svg");
    }
    expect(
      readFileSync(
        new URL("../public/icons/material/LICENSE", import.meta.url),
        "utf8",
      ),
    ).toContain("Apache License");
    expect(body).toContain('class="icon-segment"');
    expect(body).not.toContain('aria-label="Mode" aria-expanded="false"');
    expect(body).toContain(
      'aria-label="Application palette" aria-expanded="false"',
    );
    expect(body).toContain(
      'aria-label="Code and Tree theme" aria-expanded="false"',
    );
    expect(body).toContain('aria-label="Editor font" aria-expanded="false"');
    expect(body).not.toContain("<select");
  });
  it("does not apply app button sizing to embedded editor controls", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /button:where\(:not\(\.jse-main button\)\) \{[\s\S]*?min-height: 40px/,
    );
  });
  it("bounds the editor and keeps processing cancellation in the pane toolbar", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.workspace\s*\{[^}]*height: 100dvh/);
    expect(css).toMatch(/\.panes\s*\{[^}]*min-height: 0/);
    expect(css).toMatch(/\.panes\s*\{[^}]*margin-top: 10px/);
    expect(css).toMatch(
      /\.panes\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/,
    );
    expect(css).not.toMatch(/\.pending-actions\s*\{[^}]*position: absolute/);
    expect(
      readFileSync(
        new URL("./lib/EditorPanes.svelte", import.meta.url),
        "utf8",
      ),
    ).toContain('aria-label="Cancel processing"');
  });
  it("keeps cancel before history and provides recursive tree controls", () => {
    const panes = readFileSync(
      new URL("./lib/EditorPanes.svelte", import.meta.url),
      "utf8",
    );
    expect(panes.indexOf('aria-label="Cancel processing"')).toBeLessThan(
      panes.indexOf('aria-label="Undo document change"'),
    );
    expect(panes).toContain('aria-label="Expand all"');
    expect(panes).toContain('aria-label="Collapse all"');
    expect(panes).toContain("treeEditor.expand([], () => true)");
    expect(panes).toContain("treeEditor.collapse([], true)");
  });
  it("keeps format actions in the toolbar layout while processing", () => {
    const panes = readFileSync(
      new URL("./lib/EditorPanes.svelte", import.meta.url),
      "utf8",
    );
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(panes).toContain("data-processing={state.processing}");
    expect(panes).toContain('class="format-action"');
    expect(panes).toContain('class="minify-action"');
    expect(panes).toContain(
      'class="format-action"\n            disabled={state.processing}',
    );
    expect(panes).toContain(
      'class="minify-action"\n            disabled={!state.analysis?.valid || state.processing}',
    );
    expect(css).not.toMatch(
      /\.pane-actions\[data-processing="true"\][^{]*\{[^}]*visibility:\s*hidden/,
    );
    expect(panes).not.toMatch(/#if !state\.processing && hasContent/);
  });
  it("styles selection tooltips and code-fold controls for visibility", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.selection-actions\s*\{[^}]*z-index:\s*4/);
    expect(css).toMatch(
      /\.selection-actions \.tooltip-bubble\s*\{[^}]*bottom:\s*calc\(100% \+ 7px\)/,
    );
    expect(css).toMatch(/\.cm-foldGutter \.cm-gutterElement/);
    expect(css).toMatch(
      /\.cm-foldGutter \.cm-gutterElement\s*\{[^}]*font-size:\s*18px/,
    );
  });
  it("themes the JSON editor context menu with the active workspace palette", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /--jse-context-menu-background:\s*var\(--jse-panel-background\)/,
    );
    expect(css).toMatch(
      /--jse-context-menu-background-highlight:\s*var\(--jse-hover-background-color\)/,
    );
    expect(css).toMatch(/--jse-context-menu-color:\s*var\(--jse-text-color\)/);
  });
  it("themes the JSON navigation dropdown with readable active and hover colors", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /--jse-navigation-bar-background:\s*var\(--jse-panel-background\)/,
    );
    expect(css).toMatch(
      /--jse-navigation-bar-background-highlight:\s*var\(--jse-hover-background-color\)/,
    );
    expect(css).toMatch(
      /--jse-navigation-bar-dropdown-color:\s*var\(--jse-text-color\)/,
    );
    expect(css).toMatch(
      /--jse-hover-background-color:\s*color-mix\(\s*in srgb,\s*var\(--jse-background-color\) 58%,\s*var\(--jse-selection-background-color\)\s*\)/,
    );
    expect(css).toMatch(
      /--jse-panel-button-background-highlight:\s*var\(--jse-hover-background-color\)/,
    );
    expect(css).toMatch(
      /--jse-panel-button-color-highlight:\s*var\(--jse-text-color\)/,
    );
    expect(css).toMatch(
      /--jse-theme-color-highlight:\s*var\(--jse-hover-background-color\)/,
    );
    expect(css).toMatch(
      /--jse-context-menu-pointer-hover-background:\s*var\(\s*--jse-hover-background-color\s*\)/,
    );
  });
  it("keeps Code search panels and controls on the editor theme", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /\.panes \.cm-editor \.cm-panels\s*\{[^}]*background:\s*var\(--jse-panel-background\)/,
    );
    expect(css).toMatch(/--jse-panel-border:\s*1px solid var\(--border\)/);
    expect(css).toMatch(/--jse-input-border:\s*1px solid var\(--border\)/);
  });
  it("keeps the Tree search backdrop on the editor theme", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /--jse-modal-background:\s*var\(--jse-panel-background\)/,
    );
  });
  it("tightens only the Tree root disclosure and count spacing", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /\.panes \.jse-json-node\.jse-root \.jse-tag \{[\s\S]*?line-height: 1\.2/,
    );
    expect(css).toMatch(
      /\.panes \.jse-json-node\.jse-root \.jse-bracket\.jse-expanded \{[\s\S]*?padding-right: 3px/,
    );
  });
});
