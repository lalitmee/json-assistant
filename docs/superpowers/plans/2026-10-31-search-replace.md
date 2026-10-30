# Compact Search and Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved compact source-search panel without replacing the editor or compromising document undo.

**Architecture:** Attach a scoped adapter to the existing CodeMirror view through its public `EditorView.findFromDOM` API. Configure CodeMirror's `search({ createPanel })` to mount a Svelte panel; reuse native queries, decorations, navigation, and replacement commands. Existing `sourceChanged → onEdit → commit` remains the document-edit path.

**Tech Stack:** Svelte 5, TypeScript, svelte-jsoneditor 3.13.0, CodeMirror 6, Vitest, Playwright, Yarn.

**Spec:** `docs/superpowers/specs/2026-10-31-search-replace-design.md`

## Global Constraints

- Keep the existing JSON editor, source fidelity, cross-pane synchronization, and document undo/redo.
- No AI, structural key/value filters, results sidebar, or editor replacement.
- Existing tree search remains available and unchanged.
- Never parse and reserialize JSON to replace text.
- Counts must reflect the full source, not only the rendered viewport.
- Large-document counting must yield or be cancelable, with obsolete results discarded when query or source changes.
- No commits or pushes without explicit user authorization.
- Repository rules: Node.js 22.12 or newer; Yarn only; no package-lock.json; no CSS/pixel assertions in E2E.

## Review Focus

1. A hidden/recreated source editor must not leave an adapter attached to a stale view; test reattachment in Task 1 and view switching in Task 3.
2. Literal backslashes and regex capture replacement must follow different query semantics; pin both in Task 1.
3. A no-op replacement must not create misleading feedback or an extra history entry; test in Tasks 1 and 3.
4. Undo feedback after another edit must not undo unrelated work; pin revision invalidation in Tasks 1 and 3.
5. Search shortcuts outside the source pane, and ordinary typing inside search fields, must not be intercepted; test in Task 3.

---

## File Responsibilities

- Create `src/lib/sourceSearch.ts`: CodeMirror discovery, extension lifecycle, query state, counting, commands, and revision-bound feedback.
- Create `src/lib/SearchPanel.svelte`: accessible panel controls and theme-aware local layout; no matching engine.
- Modify `src/lib/EditorPanes.svelte`: source-pane lifecycle, Search button, processing/history callbacks, and shortcut scoping. Leave tree search unchanged.
- Modify `package.json` and `yarn.lock`: declare imported CodeMirror packages directly at compatible installed versions.
- Create `src/lib/sourceSearch.test.ts`: state-level query/count/replacement regression tests, using existing Vitest environment.
- Modify `src/workspace.test.ts`: server-rendered panel labels, toggle attributes, and static class hooks.
- Create `tests/search.spec.ts`: real editor attachment, focus, source/history integration, and browser shortcuts.

## Task 1: Prove the Adapter and Search-State Contract

**Files:** `src/lib/sourceSearch.ts`, `src/lib/sourceSearch.test.ts`, `tests/search.spec.ts`, `package.json`, `yarn.lock`; minimal temporary integration in `src/lib/EditorPanes.svelte` if needed for the browser proof.

**Interfaces:**

```ts
type SearchOptions = {
  search: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
};
type SearchSnapshot = {
  options: SearchOptions;
  expanded: boolean;
  counting: boolean;
  current: number;
  total: number;
  error: string | undefined;
  feedback: string;
  canUndoReplacement: boolean;
};
type SearchController = {
  snapshot(): SearchSnapshot;
  subscribe(listener: (snapshot: SearchSnapshot) => void): () => void;
  open(replace?: boolean): void;
  close(): void;
  configure(options: SearchOptions): void;
  expand(expanded: boolean): void;
  next(backward?: boolean): void;
  replace(all?: boolean): void;
  undoReplacement(): void;
  destroy(): void;
};
type SearchHost = {
  isProcessing(): boolean;
  revision(): number;
  undo(): void;
};
// Return null when no live source view is mounted; never fall back to internals.
function attachSourceSearch(
  root: HTMLElement,
  host: SearchHost,
): SearchController | null;
```

- [ ] **Step 1: Read current integration and installed search implementation.** Read `EditorPanes.svelte`, `document.ts`, relevant App history/shortcut handlers, package manifests, Vitest/Playwright configuration, and CodeMirror search implementation. Confirm current docs for Svelte mounting and CodeMirror extension precedence. Verify whether existing search configuration is overridden by `Prec.highest(search({ createPanel }))` in a removable `Compartment`.
- [ ] **Step 2: Add failing browser proof.** In `tests/search.spec.ts`, locate the source view, attach the candidate extension through application code, open the custom panel, then replace one occurrence. Assert the app's source changes exactly once and one toolbar Undo restores it. Update the source externally and prove the same adapter still works. Run `yarn test:e2e tests/search.spec.ts`; expect missing custom-panel behavior to fail.
- [ ] **Step 3: Implement minimal attachment.** Add exact installed compatible versions of `@codemirror/state`, `@codemirror/view`, and `@codemirror/search` as direct dependencies with Yarn. Implement public view discovery and one removable high-precedence search configuration. Mount a minimal custom panel using the supported `createPanel` callback. Run the browser proof and inspect dependency resolution with `yarn why @codemirror/state`, `yarn why @codemirror/view`, and `yarn why @codemirror/search`. Stop and report if duplicate instances, extension precedence, native search replacement, or app history cannot be made reliable without private APIs.
- [ ] **Step 4: Add failing state tests.** Pin literal `a.b` versus regex `a.b`, case sensitivity, whole-word filtering, invalid `[` regex, empty query, empty replacement, capture substitution, Unicode, zero-width matches, wraparound, and no-op replacement. Verify counting reads outside the viewport; cancellation discards an old query's count; closing/destroying cancels work; a recreated editor does not retain old listeners. Pin feedback eligibility to the exact replacement revision. Use actual `EditorState` and CodeMirror queries rather than mocks for matching semantics. Run `yarn vitest run src/lib/sourceSearch.test.ts`; expect new assertions to fail before completing the adapter.
- [ ] **Step 5: Implement the contract above.** Use `SearchQuery` with `literal: true` for plain searches, `setSearchQuery`, public navigation/replacement commands, and `SearchQuery.getCursor` for counts. Advance counting in bounded scheduled batches with cancellation tokens; retain aggregate count/current index rather than every match. Reuse completed counts for selection-only changes. Track transactions through an update listener, not a whole-document Svelte reactive scan. Dispatch no source transaction for navigation. Guard replacement while counting, processing, or invalid. Clear highlights with native panel closure and retain query options in the controller. Unmount and cancel timers on destroy; remove only the adapter's compartment.
- [ ] **Step 6: Verify.** Run `yarn vitest run src/lib/sourceSearch.test.ts`, `yarn test:e2e tests/search.spec.ts`, and `yarn check`; all must pass before proceeding.
- [ ] **Step 7: Review checkpoint.** Inspect the diff for private API use and duplicate history paths. Do not commit; authorization has not been given.

## Task 2: Build and Wire the Compact Panel

**Files:** `src/lib/SearchPanel.svelte`, `src/lib/EditorPanes.svelte`, `src/lib/sourceSearch.ts`, `src/workspace.test.ts`.

**Interfaces:** `SearchPanel.svelte` accepts `controller: SearchController` and `processing: boolean`; subscribes on mount and unsubscribes on destroy. Task 1's `createPanel` mounts it with public Svelte APIs and unmounts it when CodeMirror destroys the panel. Host state getters remain live; propagate processing changes to the mounted panel without remounting its inputs.

- [ ] **Step 1: Read full files before edits.** Read workspace tests, existing theme/control CSS, Tooltip.svelte, and the Task 1 adapter. Keep existing global styling intact; panel-specific layout belongs in the new component.
- [ ] **Step 2: Add failing render tests.** Render the panel with a minimal controller stub. Assert labels `Find in source`, `Replace with`, `Previous match`, `Next match`, `Close search`, `Case sensitive`, `Whole word`, and `Regular expression`; toggle `aria-pressed`; expand-button `aria-expanded`; initial collapsed replacement; `role="status"`; and disabled replacement for invalid/no-match/counting/processing snapshots. Assert named static panel classes rather than computed styles. Run `yarn vitest run src/workspace.test.ts` and observe new failures.
- [ ] **Step 3: Implement panel presentation.** Add an anchored top-right surface with find row, inline current/total count, option toggles with tooltips, expandable replacement row, and `Replace all (count)`. Tag the find input `main-field="true"`. Use existing theme variables, visible focus rings, and wrapping constrained to the source pane. Provide explicit no-match and regex-error copy; count-pending feedback must not display an old total as current. Wire every action only through the Task 1 controller. Avoid global key handlers inside this component.
- [ ] **Step 4: Wire source-pane lifecycle.** Add a `Search in source` header button. Attach after source-editor mounting, retry only when the source DOM becomes available, and destroy/rebind when the underlying view changes. Scope Ctrl/Cmd+F and Ctrl/Cmd+H to the source pane, stopping native editor search only after successful attachment. Preserve browser shortcuts elsewhere and leave tree `openSearch` unchanged. Enter/Shift+Enter navigate from the find field; Escape closes and focuses the source editor. Preserve input focus during query changes and navigation. Wire revision and document Undo to existing callbacks without creating a second edit path.
- [ ] **Step 5: Verify.** Run `yarn vitest run src/workspace.test.ts src/lib/sourceSearch.test.ts`, `yarn check`, and the Task 1 browser proof. All must pass.
- [ ] **Step 6: Review checkpoint.** Confirm no editor migration, unrelated refactor, native tree-search regression, or added matching engine. Do not commit.

## Task 3: Verify Real Search, Replacement, and Document History

**Files:** `tests/search.spec.ts`; localized corrections only in Task 1/2 files if tests expose defects.

**Interfaces:** Use `Search in source`, `Find in source`, `Replace with`, panel button labels from Task 2, and the existing `data-testid="source"` / revision outputs. Follow `tests/workspace.spec.ts`'s source-entry helper and settings-driven view switching.

- [ ] **Step 1: Add failing browser regressions.** Cover header opening; source Ctrl/Cmd+F and Ctrl/Cmd+H; collapsed default; query retention; Enter/Shift+Enter wraparound; Escape focus restoration; find-input focus during navigation; invalid regex; and replacement disabled during processing. Verify typing ordinary letters in search fields does not invoke workspace shortcuts. Outside-source Ctrl/Cmd+F must not open this panel.
- [ ] **Step 2: Add history/data regressions.** Replace all in `{"a":"cat","b":"cat","n":9007199254740993}` and assert exact source preservation except the intended replacement, tree synchronization, and a single document Undo restoring the original. Repeat with keyboard Undo. Verify no-op replacements do not increment revision. After replacement followed by an unrelated edit, assert the replacement-specific Undo action disappears or is disabled. Confirm invalid JSON is searchable without repair/reserialization.
- [ ] **Step 3: Add lifecycle/count regressions.** Search a long document with a target beyond the initial viewport and assert correct count and navigation. Change the query during counting and assert only the latest count appears. Close/reopen, switch Code/Tree/Split layouts, and replace again without stale listeners or duplicate edits. Verify tree search remains usable. Do not assert pixel geometry or computed CSS.
- [ ] **Step 4: Run focused tests and correct root causes.** Run `yarn test:e2e tests/search.spec.ts`; all new regressions must pass. Add or tighten a unit test for any state-machine defect discovered rather than multiplying browser permutations.
- [ ] **Step 5: Format only changed files.** Run `yarn prettier --write` with the explicit changed-file list, including this plan and the spec; do not run the repository-wide formatting writer.
- [ ] **Step 6: Run final gates.** Run `yarn check`, `yarn test`, `yarn test:e2e`, `yarn build`, and `yarn format:check`. Record actual outcomes, distinguishing pre-existing failures and environment blockers. Inspect `git diff --check` and `git status --short` for unintended changes.
- [ ] **Step 7: Review and handoff.** Review against the approved spec, especially source fidelity, large-document responsiveness, accessibility, and stale Undo. Report changed files, verification results, and remaining limitations. Leave changes uncommitted unless the user separately authorizes a commit.
