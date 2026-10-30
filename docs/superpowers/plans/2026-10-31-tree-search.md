# Shared Tree Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development if the user selects delegation. Track steps with checkboxes.

**Goal:** Give Tree the existing compact search panel with safe structured replacement and fix the shortcuts dialog scrollbar corners.

**Architecture:** Retain the Code controller and add a Tree implementation of SearchController. Reuse matching and replacement semantics, use public Tree navigation APIs, and send validated edits through the existing shared document history.

**Tech Stack:** Svelte, TypeScript, CodeMirror search, svelte-jsoneditor, immutable-json-patch, Vitest, Playwright; existing dependencies only.

**Spec:** `docs/superpowers/specs/2026-10-31-tree-search-design.md`

## Global Constraints

- Node.js 22.12 or newer; Yarn only, preserve yarn.lock.
- Material icons; unavailable controls stay visible and disabled.
- Preserve history/draft restoration, regex captures, and preserve-case behavior.
- Tree edits retain existing two-space serialization, not original source formatting.
- No CSS-, pixel-, or icon-specific tests. E2E uses four workers.
- Preserve unrelated workspace changes. No commits or pushes without separate explicit approval.
- Read complete files before editing. Consult current library documentation for API usage; use installed declarations to verify the installed version's surface.

## Review Focus

- Empty/zero-width regex matches must terminate and navigate deterministically (Task 1).
- Escaped keys, root primitives, and hostile property names must not corrupt paths or prototypes (Task 2).
- Ancestor renames and sibling collisions must not cause partial edits (Task 2).
- Document/query changes during counting must invalidate pending results (Task 3).
- Input focus and pane switching must not open both native and custom panels (Task 4).

## File Map

- `src/lib/sourceSearch.ts`: existing shared types, Code controller, and reusable text matching/replacement semantics; avoid a broad controller rewrite.
- `src/lib/treeSearch.ts` (new): Tree match traversal, replacement validation/planning, and Tree controller.
- `src/lib/treeSearch.test.ts` (new): pure matching/planning and controller race tests.
- `src/lib/sourceSearch.test.ts`: regression coverage for shared text semantics.
- `src/lib/SearchPanel.svelte`: configurable region label, defaulting to current Code label.
- `src/lib/EditorPanes.svelte`: mount Tree panel, public reveal APIs, patch/history integration, lifecycle and keyboard handling.
- `src/App.svelte`: pane-aware global search routing.
- `src/lib/KeyboardShortcuts.svelte`: updated help and clipped dialog with inner scrolling body.
- `tests/search.spec.ts`: focused browser integrations.

### Task 1: Reusable field-text matching and replacement

**Interfaces:** In sourceSearch.ts export `FieldMatch = { from: number; to: number; captures?: RegExpExecArray }`, `findFieldMatches(text: string, options: SearchOptions): FieldMatch[]`, and `replaceFieldMatch(text: string, match: FieldMatch, options: SearchOptions): string` (returns replacement text only).

- [ ] Add failing sourceSearch.test.ts cases asserting literal/case/whole-word behavior, invalid regex reporting, capture replacement, preserve-case, and terminating zero-width matches. Assert replacing the capture in `cat12` with `$1` preserves the same semantics as the Code path.
- [ ] Run `yarn vitest run src/lib/sourceSearch.test.ts`; confirm the new tests fail for the missing helpers.
- [ ] Implement helpers using existing SearchQuery/cursor and replacement logic. Adapt Code replacement to reuse the replacement helper without changing existing default replacement behavior. Keep capture offsets consistent with cursor offsets.
- [ ] Run `yarn vitest run src/lib/sourceSearch.test.ts`; require all tests passing.

### Task 2: Structured matching and atomic replacement planning

**Interfaces:** In treeSearch.ts export `TreeMatch = FieldMatch & { path: string[]; field: "key" | "value"; text: string }`, `collectTreeMatches(json: unknown, options: SearchOptions): TreeMatch[]`, and `planTreeReplacement(json: unknown, matches: TreeMatch[], options: SearchOptions): JSONPatchDocument`. Planner throws an actionable Error before returning any operations on invalid input. Matching core must support incremental iteration for Task 3; the collection helper drains that iterator for tests.

- [ ] Add failing treeSearch.test.ts cases: keys before values, nested/collapsed data, multiple occurrences, array indices excluded, decoded strings and root primitives. Pin examples such as `{cat:"cat cat"}` producing three matches for `cat`.
- [ ] Add planner cases asserting string types remain strings; replacing `2` with `3` in number 12 produces number 13; invalid numeric text, boolean-to-number, and null-to-string are rejected. Verify original input remains unchanged.
- [ ] Add cases for renamed key collisions with unchanged/renamed siblings, nested ancestor/descendant renames, JSON-pointer escaping, own `__proto__`/constructor/prototype properties, and root replacement. Assert rejected batches leave source/history untouched at the caller boundary. Explicitly reject rename cycles/swaps rather than inventing temporary-key machinery.
- [ ] Run `yarn vitest run src/lib/treeSearch.test.ts`; verify failures precede implementation.
- [ ] Implement traversal over own enumerable properties only; apply field occurrences right-to-left, validate complete final sibling key sets and primitive types, and emit descendant operations before ancestor moves using escaped JSON pointers. Use safe own-property checks and existing patch utilities. Ensure zero-width matches terminate.
- [ ] Run `yarn vitest run src/lib/treeSearch.test.ts src/lib/sourceSearch.test.ts`; require passing tests.

### Task 3: Tree search controller

**Interfaces:** Export `TreeSearchHost = { source(): string; revision(): number; isProcessing(): boolean; available(): boolean; apply(operations: JSONPatchDocument): void; reveal(match: TreeMatch): void; focus(): void; undo(): void; visibility(open: boolean): void }` and `createTreeSearch(host: TreeSearchHost): SearchController` from treeSearch.ts. Consume Task 2 matching/planning. Errors are exposed through SearchSnapshot.error/feedback, not uncaught event-handler exceptions.

- [ ] Add failing fake-timer controller cases: open/configure/count/navigate wrap; pending state precedes counts; query/revision changes cancel stale scans; unavailable/processing states reject edits; Replace All submits once; replacement undo is revision-gated; destroy cancels work. Include multiple occurrences in a selected field and empty query behavior.
- [ ] Run `yarn vitest run src/lib/treeSearch.test.ts`; verify new controller cases fail.
- [ ] Implement the existing SearchController contract with batched traversal (at most 500 visited nodes or matches per scheduled slice), generation cancellation, revision revalidation immediately before apply, and one host.apply call per replacement action. Recount after edits and retain a valid active index; never apply a cached stale path. close returns editor focus; open uses host.visibility to mount/focus the panel.
- [ ] Run `yarn vitest run src/lib/treeSearch.test.ts`; require passing tests.

### Task 4: Shared panel, pane routing, and browser integration

**Interfaces:** Add optional `label?: string` to SearchPanel props, default `Search in source`; Tree supplies `Search in tree`. Expose `openSearchForPane(pane: "code" | "tree", replace?: boolean): void` from EditorPanes. Extend `openSourceSearch(replace = false)` only if still needed by existing callers.

- [ ] Read complete App.svelte, EditorPanes.svelte, SearchPanel.svelte, and search.spec.ts. Inspect all search opening callers and installed public Tree selection/scroll/expand declarations. Fetch current official library documentation, falling back to upstream docs if Context7 has no relevant entry.
- [ ] Add focused failing browser cases: Tree Ctrl/Cmd+F opens only the shared Tree panel; navigating a collapsed result reveals its key/value while input keeps focus; Escape restores Tree focus; Replace All synchronizes Code and Tree and one undo restores both; duplicate-key/type errors leave source unchanged. Add pane-switch/default-Code routing and panel-session history/draft cases without cosmetic assertions.
- [ ] Run `yarn test:e2e tests/search.spec.ts --workers=4`; establish new failures separately from known baseline failures.
- [ ] Mount the shared panel in Tree using a controller host. Reveal with public createKeySelection/createValueSelection, expand, select, and scrollTo APIs, verified against installed types. Use EditorPanes.applyPatch for exactly one explicit onEdit/history commit; revalidate availability/revision before applying. Destroy controllers and cancel scans on teardown; synchronize document and processing changes.
- [ ] Replace synthetic native Tree search opening. Route keyboard capture once: focused pane first, remembered originating pane while its panel has focus, Code outside panes. Preserve unrelated text inputs' editing shortcuts; intercept Tree native find before its handler. Global App routing must not force Code when Tree owns the event. Focus the panel search field after mount/open.
- [ ] Update KeyboardShortcuts copy for pane-aware Find, replacement, and Escape. Keep all existing accessible labels and history behavior except the intentional region-label parameter.
- [ ] Run `yarn test:e2e tests/search.spec.ts --workers=4` and `yarn test`; require passing focused coverage, reporting any independently verified baseline failures.

### Task 5: Shortcuts dialog scrollbar containment

**Files:** Modify src/lib/KeyboardShortcuts.svelte only; reuse existing help browser coverage.

- [ ] Confirm the screenshot diagnosis by inspecting the dialog's current overflow and scrollbar rules; inspect a rendered page if browser access permits. Follow pre-existing tab read-only ownership rules and close only newly created tabs.
- [ ] Wrap grouped sections in an inner scrolling body. Make dialog a flex-column clipping shell with zero padding and the existing rounded border/max-height; make header non-scrolling with its existing padding, border, and background, removing negative-margin sticky offsets. Give the body min-height: 0, overflow: auto, and 24px padding. Transfer themed scrollbar rules to it and suppress native arrow buttons where supported. Keep native dialog display:none behavior when closed by applying flex display only to dialog[open].
- [ ] Run `yarn prettier --check src/lib/KeyboardShortcuts.svelte` and `yarn test:e2e tests/search.spec.ts --workers=4`; require formatting and existing help/focus checks to pass. Visually inspect upper/lower corners and narrow viewports when browser access is available; otherwise explicitly report visual verification unavailable. Add no cosmetic-only tests.

### Task 6: Final validation and review

- [ ] Run `yarn check`, `yarn test`, `yarn build`, and `yarn test:e2e tests/search.spec.ts --workers=4`. Compare failures with baseline; do not label pre-existing failures fixed or new without evidence.
- [ ] Run `yarn prettier --check` with the explicit changed source/test/document paths, avoiding unrelated formatting changes.
- [ ] Review the diff against each spec section, especially atomic collision rejection, revision races, type safety, focus, and undo. Confirm no private library imports, new dependencies, cosmetic tests, package-lock.json, or unrelated edits.
- [ ] Report verified results and remaining limitations. Leave all changes uncommitted unless separately authorized.
