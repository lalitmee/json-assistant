# JSON Workspace UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing local JSON editor into the approved focused, responsive and accessible workspace without changing document semantics.

**Architecture:** Keep `App.svelte` as the document/action coordinator, `EditorPanes.svelte` as the existing editor integration, and `app.css` as the shared layout/theme layer. Move controls visually without replacing editor callbacks; scope tree hit-target CSS to the installed editor's actual disclosure buttons. Font preference lives in memory and is passed to both panes as a presentation-only value.

**Tech Stack:** Existing Svelte 5, TypeScript, Vite, svelte-jsoneditor, CSS, locally bundled font files and inlined SVG; no new UI/styling/icon dependency.

**Spec:** `docs/superpowers/specs/2026-10-18-workspace-ui-redesign-design.md`

## Global Constraints

- Preserve local-only source/tree editing, shared undo/redo, invalid/duplicate-key safeguards, confirmations, cancellation, raw-source export, subtree checks, current wide/narrow initial view defaults, and explicit-view retention.
- No accounts, uploads, tracking, persistence, external scripts/fonts/icons, new CSS frameworks, or third-party styling package.
- Icon-only buttons: accessible name, hover/focus tooltip, visible focus, minimum 40 × 40 CSS-pixel target (44 × 44 narrow/touch). Text remains on Open JSON, Paste, Format, Minify, Search fields, Copy subtree, font choices, and Split/Code/Tree.
- Tree disclosure: enlarge the actual button to 40 × 40 desktop / 44 × 44 narrow/touch without turning the entire editable row into a toggle. Stop for design revision if the library cannot support this safely.
- Font choice is memory-only, affects presentation only, includes a system monospace choice and two locally bundled licensed monospace choices where redistribution is verified.
- **Do not run E2E tests** for this redesign. Use check/unit/build/format verification and manual Chrome DevTools interaction. Chrome verification does not prove Firefox behavior or native IME.
- Prior 1 MB guardrail failure remains a separate release blocker; do not claim release-ready.

## File responsibilities

- `src/App.svelte`: existing actions and document state, visual control placement, icon buttons and shared font preference. Preserve current functions; avoid rewriting coordinator logic.
- `src/lib/EditorPanes.svelte`: pane-local Format/Minify callbacks, selected-field controls, editor font styling hook, and existing editor instances/divider. Do not reimplement the tree.
- `src/app.css`: layout, light/dark tokens, targets, scoped library disclosure overrides, local `@font-face` declarations. Prefer CSS to JS for responsive layout.
- `src/assets/fonts/`: redistributed WOFF2 font assets plus their license texts. Use upstream official font sources; verify license files and font weights before bundling. If one candidate cannot be verified, replace it with another licensed candidate rather than pulling from a CDN.
- `docs/verification/2026-10-18-ui-redesign.md`: actual Chrome DevTools observations, commands/results, browser limitations and unchanged release blocker.

## Review Focus

1. A Code-only or Tree-only view must keep shared Undo/Redo available and source/selection stable after switching back — inspect in Task 1.
2. An invalid or duplicate-key draft must show readable diagnostics while the Tree remains unavailable and raw copy/download still work — inspect in Task 1.
3. Loading, processing and clipboard failures must keep actionable text and retain source; cancel controls appear only while applicable — inspect in Task 3.
4. A nested tree node near the left edge must have a full hit target without hiding its key or conflicting with editing — inspect geometry and clicks in Task 2.
5. Long filenames, narrow widths and disabled controls must remain understandable with keyboard focus and accessible names — inspect in Tasks 1 and 3.

---

### Task 1: Workspace hierarchy and actions

**Files:** Modify `src/App.svelte`, `src/lib/EditorPanes.svelte`, `src/app.css`.

**Interfaces:** `EditorPanes` consumes existing `state`, `view`, `onEdit`, `onSelection`, `onHistory`, `onCopyPath`, `onCopySubtree`; add `onFormat: () => void`, `onMinify: () => void` so Code-pane controls call the existing revision-gated `runOperation`. No document coordinator API changes.

- [ ] **Step 1: Record the current visual failure** — in the existing Chrome DevTools page, note fixed 65vh panes, undifferentiated global toolbar, narrow layout and current control labels. This is the baseline; do not run Playwright.
- [ ] **Step 2: Rearrange controls** — update App header (Open JSON, Paste, icon Copy JSON/Download, labeled Clear), textual view choices/status, shared icon Undo/Redo strip, contextual active Cancel controls, and readable footer/diagnostics. Put Format/Minify on Code and Search/path/subtree on Tree; preserve every existing action handler and disabled condition. Use inline SVG for the five familiar icon actions; no empty overflow menu.
- [ ] **Step 3: Style layout** — CSS for viewport-filling wide panes, existing divider and stacked narrow Split, system dark/light palettes, responsive overflow, readable status, button target/focus/tooltip states. Match approved hybrid mock direction rather than cloning its static HTML.
- [ ] **Step 4: Verify** — `npm run format:check`, `npm run check`, `npm test`, `npm run build` all exit 0; Chrome DevTools confirms each view, control labels/targets, format transaction and shared Undo/Redo, invalid/duplicate draft protection, long filename and narrow layout. No E2E suite.
- [ ] **Step 5: Commit** — stage only Task 1 files; `git commit -m "feat: organize json workspace controls"`.

### Task 2: Local fonts and tree disclosure targets

**Files:** Modify `src/App.svelte`, `src/lib/EditorPanes.svelte`, `src/app.css`; create font assets and licenses under `src/assets/fonts/`.

**Interfaces:** Add `fontFamily: 'system' | 'jetbrains' | 'plex'` prop to `EditorPanes`; App owns `let fontFamily` and a labeled Code-pane selector via callback `onFontChange: (fontFamily: 'system' | 'jetbrains' | 'plex') => void`. No storage or document mutation. If a font's redistribution rights cannot be verified, revise names in this interface to the verified alternatives before implementation.

- [ ] **Step 1: Inspect the real tree DOM** — Chrome DevTools inspect `.jse-expand` dimensions, nesting, buttons' accessible names/expanded states and keyboard behavior; record the actual baseline. Confirm scoped CSS can enlarge its hit area without overlapping key, add/remove controls or nested indentation. If the library cannot supply meaningful button semantics or safe target geometry, stop for a design change rather than patching library DOM imperatively.
- [ ] **Step 2: License/font selection** — obtain two lightweight WOFF2 monospaced fonts (candidate families JetBrains Mono and IBM Plex Mono) from official sources, check redistribution terms/weight availability, and include the corresponding license texts with bundled files. If either check fails, select another verified font or request a design revision if two cannot be shipped.
- [ ] **Step 3: Add presentation controls** — font selector (system plus two local families), local `@font-face` declarations and CSS variables for both editors; selection and view changes retain the chosen family in memory, JSON bytes/history unchanged. Scope `.jse-expand` sizing/focus styling to Tree and adjust indentation/row height so target 40 × 40 desktop and 44 × 44 narrow/touch is real and nonoverlapping. Do not replace expansion behavior.
- [ ] **Step 4: Verify** — run format/check/unit/build; Chrome DevTools measure actual target rectangles and visually inspect deeply nested rows in wide/narrow layout, Enter/Space, hover/focus tooltip, light/dark contrast and font network requests (all local). Confirm source content and dirty flag do not change on font choice.
- [ ] **Step 5: Commit** — stage only Task 2 files; `git commit -m "feat: improve editor fonts and tree targets"`.

### Task 3: Manual acceptance and evidence

**Files:** Create `docs/verification/2026-10-18-ui-redesign.md`; only modify UI files if the manual inspection exposes a specific defect (document it and verify the narrow fix).

**Interfaces:** Consumes Task 1/2 UI; produces the verification record, not new runtime APIs.

- [ ] **Step 1: Check the built UI in the existing browser tab** — run Vite if needed; with Chrome DevTools inspect desktop/narrow widths, view changes, source edit, tree edit/selection/copy, Open/Paste, Format/Minify, Undo/Redo, invalid/duplicate drafts, failure messaging, keyboard-only access, hover/focus tooltips and disclosure target geometry. Inspect console and network for errors or unintended payload transmission; use synthetic JSON only.
- [ ] **Step 2: Record evidence and limits** — document exact Chrome/browser version, widths, which interactions and accessibility checks were actually performed, commands/results, network observations, manual limitations (including Firefox/native IME), and the existing 1 MB release blocker. No E2E runs.
- [ ] **Step 3: Reverify and commit** — `npm run format:check`, `npm run check`, `npm test`, `npm run build`, `git diff --check` all exit 0; stage verification doc and any narrowly justified fixes, then `git commit -m "docs: verify accessible json workspace ui"`.

## Execution handoff

Review this plan and its referenced spec before implementation. Earlier subagent-driven execution applied to the previous implementation plan, not automatically to this UI redesign; choose whether to use subagent-driven or native execution for this plan. Neither option authorizes running E2E tests.
