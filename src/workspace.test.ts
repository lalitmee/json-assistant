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
  it("removes redundant pane subtitles and the history label", () => {
    const { body } = render(App);
    expect(body).toContain("<h2>Code</h2>");
    expect(body).toContain("<h2>Tree</h2>");
    expect(body).not.toContain('class="history-label"');
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
  it("keeps document bytes independent of presentation preferences", () => {
    const { body } = render(App);
    expect(body).toContain('data-appearance="system"');
    expect(body).toContain('data-theme="cobalt2"');
    expect(body).toContain('aria-label="Color theme"');
    expect(body).toContain('data-editor-font="system"');
    expect(body).toContain('<pre data-testid="source">{}</pre>');
    expect(body).toContain('data-testid="revision" hidden="">0');
  });
  it("offers one theme selector for app and Code/Tree", () => {
    const app = readFileSync(new URL("./App.svelte", import.meta.url), "utf8");
    const { body } = render(App);
    expect(app.match(/label="Color theme"/g)).toHaveLength(1);
    expect(body).toContain('aria-label="Mode"');
    expect(body).toContain('aria-label="Editor font"');
    expect(body).not.toContain("Application palette");
    expect(body).not.toContain("Code and Tree theme");
    for (const label of [
      "Cobalt2",
      "Tokyo Night",
      "Catppuccin",
      "Rosé Pine",
      "Solarized",
      "VS Code Dark+",
      "GitHub",
    ]) {
      expect(app).toContain(`label: "${label}"`);
    }
    expect(body).toContain(
      'class="panes" data-view="split" data-theme="cobalt2"',
    );
  });
  it("uses a labeled icon-only Back action alongside the app mark", () => {
    const { body } = render(App);
    expect(body).toMatch(/aria-label="Back to workspace"[^>]*><svg/);
    expect(body).toContain('class="brand-mark"');
    expect(body).toContain("JSON Assistant");
    expect(body).not.toContain("JSON workspace");
  });
  it("uses JSON Assistant as the browser tab title", () => {
    const html = readFileSync(
      new URL("../index.html", import.meta.url),
      "utf8",
    );
    const readme = readFileSync(
      new URL("../README.md", import.meta.url),
      "utf8",
    );
    expect(html).toContain("<title>JSON Assistant</title>");
    expect(readme).toMatch(/<h1>JSON Assistant<\/h1>/);
  });
  it("groups filename and status and uses the same logo asset in both headers", () => {
    const { body } = render(App);
    expect(body).toMatch(
      /class="document-meta"[\s\S]*document\.json[\s\S]*class="status-badge"/,
    );
    expect(
      body.match(
        new RegExp(`src="${import.meta.env.BASE_URL}logo\\.svg"`, "g"),
      ),
    ).toHaveLength(2);
    expect(body).toMatch(/aria-label="Open settings"[^>]*><svg/);
    expect(body).toMatch(
      /aria-label="Undo document change"[\s\S]*role="tooltip"[^>]*>Undo document change/,
    );
    expect(body).toMatch(
      /aria-label="Open settings"[^>]*><svg[^>]*><path d="M19\.14,12\.94/,
    );
    expect(body).toMatch(
      /aria-label="Undo document change"[^>]*><svg[^>]*><path d="M280-200v-80h284/,
    );
    expect(body).toMatch(
      /aria-label="Redo document change"[^>]*><svg[^>]*><path d="M396-200q-97 0-166\.5-63T160-420/,
    );
  });
  it("resolves logos and appearance icons relative to the app path", () => {
    const app = readFileSync(new URL("./App.svelte", import.meta.url), "utf8");
    const segmentedControl = readFileSync(
      new URL("./lib/SegmentedControl.svelte", import.meta.url),
      "utf8",
    );
    expect(app.match(/import\.meta\.env\.BASE_URL\}logo\.svg/g)).toHaveLength(
      2,
    );
    expect(segmentedControl).toContain(
      'url("${import.meta.env.BASE_URL}icons/material/${option.icon}.svg")',
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
    expect(css).toMatch(/\.workspace-header\s*\{[^}]*padding:\s*6px 12px/);
    expect(css).toMatch(
      /\.brand-mark\s*\{[^}]*height:\s*34px[^}]*width:\s*34px/,
    );
    expect(css).toMatch(/\.identity p\s*\{[^}]*line-height:\s*1\.2/);
  });
  it("places the workspace header flush with the viewport top", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.workspace\s*\{[^}]*padding:\s*0 12px 12px/);
    expect(css).toMatch(/\.workspace-header\s*\{[^}]*margin:\s*0 -12px/);
    expect(css).toMatch(
      /@media \(max-width: 700px\)[\s\S]*?\.workspace\s*\{[^}]*padding:\s*0 10px 10px/,
    );
    expect(css).toMatch(
      /@media \(max-width: 700px\)[\s\S]*?\.workspace-header\s*\{[^}]*margin:\s*0 -10px[^}]*padding:\s*6px 10px/,
    );
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
    expect(body).toContain('aria-label="Color theme" aria-expanded="false"');
    expect(body).toContain('aria-label="Editor font" aria-expanded="false"');
    expect(body).not.toContain("<select");
  });
  it("does not apply app button sizing to embedded editor controls", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /button:where\(:not\(\.jse-main button\)\) \{[\s\S]*?min-height: 40px/,
    );
    expect(css).toMatch(
      /\.icon-button\s*\{[^}]*width:\s*40px[^}]*height:\s*40px/,
    );
    expect(css).toMatch(
      /\.icon-button svg\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/,
    );
  });
  it("raises hovered tooltips above neighboring pane controls", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    const tooltip = readFileSync(
      new URL("./lib/Tooltip.svelte", import.meta.url),
      "utf8",
    );
    expect(tooltip).toMatch(
      /\.tooltip-anchor:is\(:hover, :focus-within\)\s*\{[^}]*z-index:\s*31/,
    );
    expect(css).not.toMatch(/\.pane-header\s*\{[^}]*z-index:/);
    expect(css).not.toMatch(/\.selection-actions\s*\{[^}]*z-index:/);
  });
  it("animates tooltip entrances and respects reduced motion", () => {
    const tooltip = readFileSync(
      new URL("./lib/Tooltip.svelte", import.meta.url),
      "utf8",
    );
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(tooltip).toMatch(/\.tooltip-bubble\s*\{[^}]*scale:\s*0\.9/);
    expect(tooltip).toMatch(/transition:[\s\S]*?scale 180ms ease-out/);
    expect(tooltip).toMatch(/transform-origin:\s*top center/);
    expect(tooltip).toMatch(
      /\.tooltip-anchor:is\(:hover, :focus-within\) \.tooltip-bubble\s*\{[^}]*scale:\s*1/,
    );
    expect(css).toMatch(
      /\.selection-actions \.tooltip-bubble\s*\{[^}]*transform-origin:\s*bottom right/,
    );
    expect(tooltip).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.tooltip-bubble\s*\{[^}]*transition:\s*none/,
    );
  });
  it("uses Material Symbols artwork for tree expand and collapse", () => {
    const panes = readFileSync(
      new URL("./lib/EditorPanes.svelte", import.meta.url),
      "utf8",
    );
    expect(panes).toMatch(
      /aria-label="Expand all"[\s\S]*?viewBox="0 -960 960 960"[\s\S]*?M480-80 240-320l57-57 183 183 183-183 57 57L480-80Z/,
    );
    expect(panes).toMatch(
      /aria-label="Collapse all"[\s\S]*?viewBox="0 -960 960 960"[\s\S]*?m296-80-56-56 240-240 240 240-56 56-184-184L296-80/,
    );
  });
  it("bounds the editor and keeps processing cancellation in the pane toolbar", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.workspace\s*\{[^}]*height: 100dvh/);
    expect(css).toMatch(/\.panes\s*\{[^}]*min-height: 0/);
    expect(css).not.toMatch(/\.panes\s*\{[^}]*margin-top:/);
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
  it("shows which JSON operation is in progress", () => {
    const app = readFileSync(new URL("./App.svelte", import.meta.url), "utf8");
    expect(app).toMatch(/processingOperation === "format"\s*\?\s*"Formatting"/);
    expect(app).toMatch(/processingOperation === "minify"\s*\?\s*"Minifying"/);
    expect(app).toContain('"Analyzing"');
  });
  it("styles selection tooltips and code-fold controls for visibility", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/\.selection-actions\s*\{[^}]*z-index:/);
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
  it("maps the unified theme families to official dark and light palettes", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    const themes = [
      "cobalt2",
      "tokyo-night",
      "catppuccin",
      "rose-pine",
      "solarized",
      "vscode-dark-plus",
      "github",
    ];
    for (const theme of themes) {
      expect(css).toMatch(
        new RegExp(`\\.app-shell\\[data-theme="${theme}"\\]`),
      );
      expect(css).toMatch(new RegExp(`\\.panes\\[data-theme="${theme}"\\]`));
    }
    for (const variant of [
      "Tokyo Night Light",
      "Catppuccin Latte",
      "Rosé Pine Dawn",
      "Solarized Light",
      "Light+",
      "GitHub Light Default",
    ]) {
      expect(css).toContain(variant);
    }
    for (const sourceColor of [
      "#193549",
      "#e6e7ed",
      "#1e1e2e",
      "#eff1f5",
      "#191724",
      "#faf4ed",
      "#002b36",
      "#fdf6e3",
      "#1e1e1e",
      "#ffffff",
      "#1f2428",
      "#ffffff",
    ]) {
      expect(css).toContain(sourceColor);
    }
    const cobalt = css.match(
      /\.app-shell\[data-theme="cobalt2"\]\s*\{([^}]*)\}/,
    )?.[1];
    expect(cobalt).toContain("background: #193549");
    expect(css).toMatch(/--editor-key: #ffc600/);
    expect(css).toMatch(/--jse-key-color: var\(--editor-key\)/);
    expect(css).not.toMatch(
      /\[data-appearance="(?:system|light)"\]\[data-theme="cobalt2"\]/,
    );
  });
  it("maps every Cobalt2 JSON value to its syntax color", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    const cobalt = css.match(
      /\.panes\[data-theme="cobalt2"\]\s*\{([^}]*)\}/,
    )?.[1];
    expect(cobalt).toContain("--jse-value-color-string: #a5ff90");
    expect(cobalt).toContain("--jse-value-color-url: #a5ff90");
    expect(cobalt).toContain("--jse-value-color-number: #ff628c");
    expect(cobalt).toContain("--jse-value-color-boolean: #ff628c");
    expect(cobalt).toContain("--jse-value-color-null: #ff628c");
  });
  it("themes Tree search highlights from the selected palette", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /--jse-search-match-color:\s*color-mix\([\s\S]*?var\(--editor-selection\)[\s\S]*?\);/,
    );
    expect(css).toContain(
      "--jse-search-match-active-color: var(--editor-selection)",
    );
    expect(css).toContain(
      "--jse-search-match-outline: 1px solid var(--editor-key)",
    );
  });
  it("keeps editor gutters compact and scrollbars theme-aware", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /\.panes \.cm-foldGutter \.cm-gutterElement\s*\{[^}]*min-width: 16px/,
    );
    expect(css).toMatch(
      /\.panes \.cm-lineNumbers \.cm-gutterElement\s*\{[^}]*padding: 0 3px/,
    );
    expect(css).toMatch(
      /\.panes \.cm-scroller,\s*\.panes \.jse-contents\s*\{[^}]*scrollbar-color: var\(--editor-selection\) var\(--editor-panel\)/,
    );
    expect(css).toMatch(
      /\.panes \.cm-scroller::-webkit-scrollbar-thumb,\s*\.panes \.jse-contents::-webkit-scrollbar-thumb/,
    );
  });
  it("offers indentation guide controls and an equal-split divider gesture", () => {
    const app = readFileSync(new URL("./App.svelte", import.meta.url), "utf8");
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    const panes = readFileSync(
      new URL("./lib/EditorPanes.svelte", import.meta.url),
      "utf8",
    );
    expect(app).toContain('label="Animated indentation guides"');
    expect(app).not.toContain("Rainbow indentation guides");
    expect(app).toContain('role="switch"');
    expect(app).toContain('class="toggle-thumb"');
    expect(app).not.toContain('type="checkbox"');
    expect(css).toContain('.preference-toggle[aria-checked="true"]');
    expect(css).toContain(".toggle-thumb");
    expect(panes).toContain("ondblclick={() => (split = 50)}");
    expect(css).toContain("--indent-marker-bg-color: color-mix(");
    expect(css).toContain("@keyframes indentation-guide-pulse");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toContain("data-rainbow-indent-guides");
  });
  it("uses a readable error color for light variants", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /\.app-shell\[data-appearance="light"\]:not\(\[data-theme="cobalt2"\]\)\s*\{[^}]*--error: #a61e4d/,
    );
    expect(css).toMatch(
      /@media \(prefers-color-scheme: light\)[\s\S]*?\.app-shell\[data-appearance="system"\]:not\(\[data-theme="cobalt2"\]\)\s*\{[^}]*--error: #a61e4d/,
    );
  });
  it("keeps Cobalt2 primary buttons dark and hover borders clean", () => {
    const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /\.app-shell\[data-theme="cobalt2"\]\s*\{[^}]*--primary: #0050a4/,
    );
    expect(css).toMatch(
      /button:where\(:not\(\.jse-main button\)\)\s*\{[^}]*background-clip: padding-box/,
    );
    expect(css).toMatch(
      /button:where\(:not\(\.jse-main button\)\)\s*\{[^}]*transition:/,
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
