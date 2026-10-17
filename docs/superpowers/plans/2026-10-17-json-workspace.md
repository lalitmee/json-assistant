# JSON Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-processing JSON workspace for API debugging with synchronized code/tree editing and safe export.

**Architecture:** One Svelte screen owns one source-authoritative document. Two existing editor instances expose code/tree views; a coordinator owns chronological document transactions, while cancellable workers validate and format revisions. Prove component compatibility before investing in the shell; no custom editor fallback.

**Tech Stack:** Svelte 5, TypeScript, Vite, svelte-jsoneditor 3.x, lossless-json, jsonc-parser for source-token operations; Vitest for pure state/processing checks and Playwright for browser integration. npm lockfile; no backend, router, state library, UI kit, or remote assets.

**Spec:** [Revised release-1 design](../specs/2026-10-17-json-workspace-design.md)

**Status:** Revised plan approved by the user on 2026-10-17. The user selected Subagent-driven execution. Task 1 remains a blocking integration gate; an integration failure stops all later tasks.

## Global Constraints

- Source text is authoritative, including invalid drafts. One in-memory document; no automatic persistence.
- Accept objects, arrays, strings, numbers, booleans, and null at the root. No arbitrary upload quota or unlimited-memory promise.
- Use Svelte 5 with TypeScript and Vite, and the existing svelte-jsoneditor component natively.
- Format uses two-space indentation; Format and Minify change whitespace only, preserving value tokens and member order.
- Default to Split when the workspace is at least 900 CSS pixels wide and Code otherwise; explicit selection survives resizing. Narrow Split stacks panes.
- Undo/redo spans source edits, tree edits, formatting, and minification in chronological order. View switches must not reset content, history, or representable selections.
- Invalid/stale trees are visibly unavailable or read-only. Duplicate keys preserve source and disable tree editing and subtree export; never show a last-key-wins tree as faithful.
- Processing, cancellation, file, clipboard, and export errors preserve the document; ignore stale revision results.
- No payload transmission, accounts, analytics, third-party scripts/fonts, automatic repair, remote-resource previews, or schema resolution.
- No schemas/linting, graph/table, AI, conversions, URL import, multi-document tabs, offline-install promise, or persistent recovery in this release.
- Benchmark 100 KB, 1 MB, 10 MB, and 100 MB across broad arrays, deep objects, and long strings. The 1 MB core workflow must work without an unresponsive-page warning.
- Test current stable Chromium and Firefox. Unintended value changes, lost drafts, falsely current trees, reset history, and payload transmission block release.

## Review Focus

1. Keys named `__proto__`, `constructor`, and escaped-equivalent duplicate keys must behave as data without prototype mutation or hidden duplicate collapse (Tasks 1–2).
2. A pending file open or format result followed by typing, undo, or another open must never overwrite the newer draft (Tasks 2 and 5).
3. IME composition and browser/editor undo shortcuts must use the same history as toolbar actions, without dropping composed text or undoing a view switch (Tasks 1 and 4).
4. Clipboard rejection, denied downloads, or a cancelled replacement prompt must preserve exact source and dirty/export state (Task 5).
5. A hidden pane becoming visible, narrow Split, and a deleted selection must retain usable focus/cursor or choose a surviving parent (Tasks 1 and 4).

## File map and shared contracts

Task 1 creates only the minimum integration screen and its checks. Later tasks evolve it in place, not a second throwaway application.

- Root: `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, `playwright.config.ts`, `.gitignore` — build, Svelte checks, focused tests, ignored generated output.
- `src/main.ts`, `src/App.svelte`, `src/app.css` — app mount, workspace/toolbar/status, responsive accessible styling.
- `src/lib/EditorPanes.svelte` — two editor bindings, selection restoration, callback suppression, shared undo routing, restricted editor menus.
- `src/lib/document.ts` — source revision, transactions, selection, validation state, dirty/export state; no DOM or worker creation.
- `src/lib/process.ts`, `src/lib/process.worker.ts`, `src/lib/processing.ts` — pure processing, worker endpoint, cancellable client respectively.
- `src/lib/io.ts` — file reading, clipboard, source/subtree download primitives; no hidden persistence.
- `src/lib/document.test.ts`, `src/lib/process.test.ts`, `src/lib/processing.test.ts`, `src/lib/io.test.ts` — focused invariant checks alongside their code.
- `tests/editor-gate.spec.ts`, `tests/workspace.spec.ts`, `tests/privacy.spec.ts` — real editor gate, complete workflow, network/resource checks.
- `scripts/benchmark.mjs`, `docs/verification/2026-10-17-editor-gate.md`, `docs/verification/2026-10-17-release.md`, `README.md` — reproducible generated fixtures, evidence, setup/limitations. Never commit user payloads or generated large fixtures.

Define these application contracts in `document.ts`; use editor-exported types rather than copying their definitions:

```ts
import type { JSONEditorSelection } from 'svelte-jsoneditor'

type View = 'split' | 'code' | 'tree'
type Path = Array<string | number>
type Selection = { code?: JSONEditorSelection; tree?: JSONEditorSelection }
type Diagnostic = { kind: 'syntax' | 'duplicate'; message: string; offset: number; line: number; column: number }
type Analysis = { revision: number; bytes: number; valid: boolean; diagnostics: Diagnostic[]; depth: number; nodes: number }
type Snapshot = { source: string; selection: Selection }
type DocumentState = {
  source: string; revision: number; selection: Selection; analysis?: Analysis;
  past: Snapshot[]; future: Snapshot[]; exportedSource: string;
  processing: boolean; mode: 'edit' | 'inspect' | 'unavailable'; error?: string
}
createDocument(source?: string): DocumentState
commit(state: DocumentState, next: Snapshot): DocumentState
undo(state: DocumentState): DocumentState
redo(state: DocumentState): DocumentState
acceptAnalysis(state: DocumentState, result: Analysis): DocumentState
isDirty(state: DocumentState): boolean
```

Every source transition, including undo/redo, increases `revision`; history snapshots do not restore old revision numbers. Equal-source updates update selection but do not create transactions. One explicit format/minify action is one `commit`. Source changes invalidate current analysis immediately. New documents reset history only after confirmed successful replacement. Dirty compares exact source against the last opened/exported source, not a revision that might be revisited through undo. Keep history only within measured editing guardrails; do not build an unbounded snapshot history for inspection-only files.

`EditorPanes.svelte` consumes `{ state: DocumentState, view: View, onEdit: (next: Snapshot) => void, onSelection: (selection: Selection) => void, onHistory: (direction: 'undo' | 'redo') => void }`. Programmatic propagation must not emit `onEdit`. Task 1 must prove this interface can satisfy the spec without competing user-visible histories; if not, stop rather than forcing it.

## Task 1: Prove the two-pane integration before building the shell

**Files:** Create root configuration, `src/main.ts`, minimal `src/App.svelte`, `src/lib/EditorPanes.svelte`, `src/lib/document.ts`, `tests/editor-gate.spec.ts`, and `docs/verification/2026-10-17-editor-gate.md`; update `.gitignore`.

**Interfaces:** Produces the coordinator contracts and editor props above. Uses documented editor `content`, `parser`, `selection`, `onChange`, `onSelect`, `update`, `select`, and `scrollTo` APIs. Do not assume exported history types imply a shared-history property.

- [ ] **Step 1: Establish only the gate harness.** After plan approval, inspect current package manifests/docs and select compatible stable releases; record Node/npm and installed versions in the evidence file. Add the Svelte/Vite screen with two labeled editor regions and bare undo/redo buttons. Define scripts `dev`, `check` (svelte-check plus TypeScript), `test` (Vitest run), `test:e2e` (Playwright), and `build`. Limit Vitest discovery to `src/**/*.test.ts` so it does not execute Playwright files. Configure Playwright Chromium/Firefox projects against a loopback Vite server. Ignore `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, and generated benchmark fixtures, retaining the existing `.superpowers/` ignore. Install only the stack listed above; lock versions. No polished toolbar/layout work yet.
- [ ] **Step 2: Write failing browser checks** in `tests/editor-gate.spec.ts`: `shared chronological history` types a source change, edits a tree field, undoes both from either pane and toolbar, then redoes to the expected source; `view and selection survive` hides/reveals each pane and deletes the selected child, expecting its surviving parent; `tree edits preserve unaffected values` edits a sibling of `9007199254740993`, `1.2300`, `1e+09`, `-0`, and `"\u0061"`, asserting the requested change and lossless equality of every unaffected value without requiring identical whitespace, escape spelling, or object-member order. Include object add/remove/rename and array insert/move operations in the same semantic-value checks. Test root values `['{}','[]','"x"','0','true','false','null']` and strings resembling HTML/URLs.
- [ ] **Step 3: Add gate safety checks:** incomplete source remains exact with no repaired tree, `{"a":1,"\u0061":2}` cannot produce an editable/copyable collapsed tree, hostile keys do not mutate prototypes, programmatic synchronization creates no echo transaction, cancelled/stale completion callbacks cannot replace source. Use a controlled deferred completion at this gate; Task 2 verifies real worker termination. Test Ctrl/Cmd+Z and redo while each pane is focused, including editor context menus and a composition event sequence; explicitly record a manual native IME check as browser automation is not proof of actual IME behavior.
- [ ] **Step 4: Run the red gate:** `npm run test:e2e -- tests/editor-gate.spec.ts`. Expected: behavior assertions fail on the minimal unsynchronized screen, not module/configuration failures. Save the failures; repair harness errors before drawing conclusions.
- [ ] **Step 5: Implement the smallest integration.** Supply lossless-json as the editor parser. Start with immutable text content and the documented update/selection callbacks. Route user-visible undo buttons, shortcuts, and editor menu actions through one coordinator; keep panes mounted when hidden and refresh visible text rendering. Never feed invalid or duplicate-key text into tree mode: its documented auto-repair behavior is incompatible with this spec. Disable repair, transform, sorting, schema, and format actions not routed through the coordinator. Do not serialize precision-sensitive values through native JSON or assume lossless-json preserves string escapes/member ordering. Verify that replace/add/remove/rename and array insertion/movement apply only the requested operation and preserve all unaffected values with lossless numeric semantics; whitespace, escape spelling, and object-member order may normalize. No custom token-preserving adapter is required.
- [ ] **Step 6: Re-run the full gate**, `npm run check`, and `npm run build`. Expected: both browser projects pass, zero type errors, successful build. Record versions, exercised operations, and actual failures/limitations. **If shared undo, semantic preservation of unaffected values, selection, or safe invalid/duplicate handling cannot pass, mark the gate blocked and stop. Present the concrete failing case for a spec/plan revision; do not start Task 2 or quietly weaken the contract.**
- [ ] **Step 7: Commit the independently verified gate:** `git add package.json package-lock.json index.html vite.config.ts tsconfig.json svelte.config.js playwright.config.ts .gitignore src tests/editor-gate.spec.ts docs/verification/2026-10-17-editor-gate.md` then `git commit -m "feat: verify synchronized json editor integration"`.

## Task 2: Validate and format source in a cancellable worker

**Files:** Create `src/lib/process.ts`, `src/lib/process.worker.ts`, `src/lib/processing.ts`, `src/lib/process.test.ts`, `src/lib/processing.test.ts`, `src/lib/document.test.ts`; extend `src/lib/document.ts` and gate integration.

**Interfaces:** Consumes `Analysis`, `Diagnostic`, and revision matching from Task 1. Produces:

```ts
type ProcessRequest = { revision: number; source: string; operation: 'analyze' | 'format' | 'minify' }
type ProcessResult = { analysis: Analysis; source?: string }
processSource(request: ProcessRequest): ProcessResult
createProcessor(): { run(request: ProcessRequest): Promise<ProcessResult>; cancel(): void; dispose(): void }
```

- [ ] **Step 1: Write failing pure tests.** Assert `processSource({revision:7,source:'{"n":1.2300,"s":"\\u0061"}',operation:'format'}).source === '{\n  "n": 1.2300,\n  "s": "\\u0061"\n}'`; minifying that output returns the original compact source. Include huge integers, exponents, negative zero, braces/quotes/escaped whitespace inside strings, Unicode, numeric-looking member keys, and all roots. Duplicates are syntactically valid with duplicate diagnostics, not safe trees; malformed JSON, comments, trailing commas, NaN, Infinity, and empty input are invalid with 1-based line/column. Escaped-equivalent duplicate keys and `__proto__` are in this test group. UTF-8 bytes for `"é"` equal 4.
- [ ] **Step 2: Write failing worker/coordinator tests.** A fake worker resolves revision 7 after revision 8; source/analysis remain revision 8. Cancelling terminates the worker, settles pending work, ignores late messages, and permits a fresh worker. A worker error preserves source and returns an actionable error. A format result arriving after typing or undo is discarded, not committed. Test worker disposal on teardown.
- [ ] **Step 3: Run red:** `npm test -- src/lib/process.test.ts src/lib/processing.test.ts src/lib/document.test.ts`; expected behavior assertions fail.
- [ ] **Step 4: Implement the functions above.** Use a jsonc-parser scanner for iterative size/shape preflight before invoking any recursive visitor/parser; then use strict visitor options and offsets for diagnostics. Use raw source slices, never numeric token values, for fidelity. Validate structured conversion with lossless-json and duplicate reporting. Format through source edits (`format`/`applyEdits`) with two spaces and LF; minify by concatenating original non-whitespace token slices after validation. Never accept tolerant recovered output as valid JSON. Run expensive processing in the worker. Do not send LosslessNumber instances through structured cloning: send source and plain metadata, then construct editor values only inside measured safe render limits. Reject unsafe depth/shape before invoking recursive parsers. Cancellation terminates/replaces the worker, and stale replies cannot commit.
- [ ] **Step 5: Run green:** repeat unit command and `npm run test:e2e -- tests/editor-gate.spec.ts`; expected all pass in both browsers. Any UI-thread parser work remains bounded by the preflight guardrail, not applied to arbitrary payload sizes.
- [ ] **Step 6: Commit:** `git add src/lib tests/editor-gate.spec.ts` then `git commit -m "feat: process json revisions in a cancellable worker"`.

## Task 3: Deliver one coherent editing and inspection workflow

**Files:** Extend `src/App.svelte`, `src/lib/EditorPanes.svelte`, `src/lib/document.ts`; create `tests/workspace.spec.ts` and extend document tests.

**Interfaces:** Consumes Task 1 editor/coordinator and Task 2 processor. `App.svelte` owns processor lifetime and applies matching results. Editor integration uses the component's built-in search, path serialization, selection, and ancestor-reveal APIs rather than a second search engine.

- [ ] **Step 1: Write failing unit and browser assertions:** paste/edit invalid then valid source; source/tree converge only at the latest revision; Format and Minify each undo in one action, redo returns exact output, and a new edit clears redo. Search a key and value inside collapsed branches and navigate to the match. Select a punctuation/quote/backslash key, copy its escaped JSONPath-style path, and round-trip through the component's path parser. Deleting a selected array/object child selects a surviving parent.
- [ ] **Step 2: Run red:** `npm test -- src/lib/document.test.ts` and `npm run test:e2e -- tests/workspace.spec.ts`; expected missing workflow behavior fails.
- [ ] **Step 3: Connect toolbar actions** Open file, Format, Minify, Undo, Redo, Copy JSON, Download (I/O is completed in Task 5). Implement source/tree search and selected-path actions with existing editor capabilities. No fake enabled I/O buttons: keep unavailable actions disabled until wired. Format/minify commit only a current validated result; expose processing and Cancel. Display current validity, duplicate/syntax location and explanation, UTF-8 bytes, dirty state, local-processing/no-recovery notice, and edit/inspection/unavailable mode. Invalid/duplicate source disables tree mutation/subtree export, while retaining code editing and raw export. Do not label syntax validation as schema validation or linting.
- [ ] **Step 4: Run green:** repeat the two red commands plus gate tests; expected pass. Verify no component menu can bypass duplicate/invalid restrictions or introduce repair/query/schema features.
- [ ] **Step 5: Commit:** `git add src tests/workspace.spec.ts` then `git commit -m "feat: add json editing formatting and inspection workflow"`.

## Task 4: Add the responsive, keyboard-accessible workspace

**Files:** Extend `src/App.svelte`, `src/lib/EditorPanes.svelte`, `tests/workspace.spec.ts`; create `src/app.css` and import it from `src/main.ts`.

**Interfaces:** Consumes `View` and existing editor props. Layout selection is shell-local in-memory state; no storage API. Use native labeled buttons and a focusable ARIA separator with keyboard controls, not a UI dependency.

- [ ] **Step 1: Write failing browser assertions:** initial workspace width 900 selects Split and 899 selects Code; choosing Tree then resizing retains Tree; narrow explicit Split stacks rather than horizontal overflow. After changing views, source/history/representable selection remain. Divider Arrow keys resize panes, Home/End reach bounds, focus remains visible, controls expose names and active view, both editors are keyboard reachable. A hidden text pane correctly refreshes when revealed. Include keyboard shortcuts after source/tree focus, light/dark system preferences, and a non-ASCII composition sequence.
- [ ] **Step 2: Run red:** `npm run test:e2e -- tests/workspace.spec.ts`; expected layout/accessibility assertions fail.
- [ ] **Step 3: Implement layout and styles.** Wide Split uses CSS grid with a keyboard/pointer-operable separator; narrow Split stacks. Clamp divider to keep both panes reachable; expose its orientation, current/min/max values and accessible name. Use system fonts, neutral borders, readable contrast/focus, system dark theme plus editor theme variables. Do not persist layout or introduce unrelated navigation/tabs. Resize must not remount editors or change an explicitly selected view.
- [ ] **Step 4: Run green:** workspace plus editor-gate suites and `npm run check`. Perform a keyboard-only pass and native IME manual check; record results, not just automated claims.
- [ ] **Step 5: Commit:** `git add src tests/workspace.spec.ts` then `git commit -m "feat: add responsive accessible json workspace layouts"`.

## Task 5: Complete loss-resistant file, clipboard, and export handling

**Files:** Create `src/lib/io.ts`, `src/lib/io.test.ts`; extend `src/App.svelte`, document tests, and `tests/workspace.spec.ts`.

**Interfaces:** `readFile(file: File, signal: AbortSignal): Promise<string>`, `copyText(text: string): Promise<void>`, `downloadText(text: string, filename: string): void`, `subtreeSource(source: string, path: Path): string`. Subtree extraction uses validated, duplicate-free source offsets, not parse/stringify. Shell owns replacement confirmation/load generation and marks `exportedSource` only after successful initiation.

- [ ] **Step 1: Write failing checks:** opening/pasting a replacement or clearing dirty content requires confirmation; rejection retains exact source/history. Slow file A finishing after B, cancellation, a failed read, or an edit/undo during a pending open cannot overwrite the newer draft without fresh confirmation. Clipboard rejection retains dirty/source. Copy never clears dirty. Download exports current source (including invalid drafts with a warning), revokes its object URL, and marks only that successfully initiated source as exported; synchronous initiation failure does not mark exported. Later edits remain dirty even if an earlier asynchronous export finishes. Browser disk confirmation is never claimed.
- [ ] **Step 2: Add exact-source assertions:** copy/download preserve unsafe numbers and escapes; subtree slicing preserves its tokens; subtree unavailable for invalid/stale/duplicate trees. Filenames are ordinary local names with no payload text. Register/remove a best-effort beforeunload handler according to dirty state; browser suppression is a documented limitation, not a failed guarantee.
- [ ] **Step 3: Run red:** `npm test -- src/lib/io.test.ts src/lib/document.test.ts` and `npm run test:e2e -- tests/workspace.spec.ts`; expected I/O assertions fail.
- [ ] **Step 4: Implement native I/O.** Use abortable FileReader (not a non-cancellable full read wrapped in a cosmetic Cancel button), Clipboard API with actionable permission error, Blob/object URL download, and native confirmation. Preflight File.size before allocating a full source buffer; do not make arbitrary product quotas. Preserve committed content until the replacement is read, checked, and still authorized for the current document generation. Never log source, store payloads, or put them in URLs. Add raw-source export warnings for invalid drafts and honest “download initiated” wording.
- [ ] **Step 5: Run green:** repeat unit/browser commands; test a rejected clipboard operation and cancelled file load in both browser projects. Expected previous source and history remain intact.
- [ ] **Step 6: Commit:** `git add src tests/workspace.spec.ts` then `git commit -m "feat: add safe local json file and clipboard actions"`.

## Task 6: Measure guardrails and verify the release

**Files:** Create `scripts/benchmark.mjs`, `tests/privacy.spec.ts`, `docs/verification/2026-10-17-release.md`, `README.md`; adjust `src/lib/process.ts`, `src/App.svelte`, and tests only where measured limits require it. Add `benchmark` script to `package.json`.

**Interfaces:** Consumes analysis `bytes/depth/nodes` and `DocumentState.mode`. Produces documented size/shape operation guardrails, not a universal size guarantee. Gate remains blocked if no safe inspection mode exists for an input; the previous document survives.

- [ ] **Step 1: Write failing safety checks:** exceed an injected test guardrail and assert no unsafe editor mounting/full parse, visible inspection/unavailable reason, available safe source export, no unbounded retry, and preserved previous document on refusal. Test broad, deeply nested, and single-long-string shapes separately. Add privacy test with a distinctive synthetic canary: after initial static load, edit/search/format/export without any unexpected network request, beacon, WebSocket, external resource preview, storage write, or payload in location/history. Mock clipboard only where necessary; include a separate actual download-content check.
- [ ] **Step 2: Run red:** `npm run test:e2e -- tests/privacy.spec.ts tests/workspace.spec.ts`; expected missing enforced guardrails/privacy instrumentation fails.
- [ ] **Step 3: Implement benchmark generation** in `scripts/benchmark.mjs`, invoked by `npm run benchmark`. Generate synthetic broad arrays, deep objects, and long strings at approximately 100 KB, 1 MB, 10 MB, 100 MB; record exact UTF-8 bytes and depth (including intentionally unsafe depths). Run one case at a time in Chromium/Firefox via Playwright, with process timeouts and cleanup. Record browser/version, OS/hardware, load/analyze/format/cancel times, usable modes, main-thread responsiveness probes, peak memory only where actually measurable, and failures. Synthetic fixtures stay generated/ignored. Treat process crashes as failures, not missing samples.
- [ ] **Step 4: Tune the smallest safety policy from measurements.** Begin conservatively for unmeasured size/depth/node shapes, then allow only demonstrated modes. Keep inspection read-only with lazy expansion where needed, prohibit unbounded expand-all, and stop gracefully when even safe inspection is unavailable. File-read and source-buffer costs count; worker cancellation is not protection against all memory exhaustion. Record precise policy constants, rationale, tested hardware, and untested ranges in release notes. This step cannot waive the 1 MB core-workflow requirement.
- [ ] **Step 5: Run complete verification:** `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run benchmark`, `git diff --check`. Expected zero check/test/build failures, both browser suites pass, 1 MB workflow passes without browser hang warning, larger cases each have measured outcomes and honestly enforced limits. Do a manual keyboard/IME/browser-console/network pass against the production build; automated responsiveness probes do not establish the absence of a native hang dialog. Document any browser-specific limitation and do not claim inaccessible checks passed.
- [ ] **Step 6: Write setup/limitations** in `README.md` and evidence in the release report. Include local-only boundaries/static hosting distinction, no automatic recovery, supported modes/benchmarks, script commands, integration evidence, and links to spec/research/roadmap. No deployment or publishing is implied by this task; ask separately if wanted.
- [ ] **Step 7: Commit verified deliverable:** `git add package.json scripts src tests docs/verification README.md` then `git commit -m "test: verify json workspace safety privacy and performance"`. Keep the private repository private. Review the whole branch before considering release/integration.

## Planning self-review and execution boundary

- Spec coverage: Tasks 1–2 cover unaffected-value fidelity, duplicates, synchronization, selection/history, async failure/cancellation, and exact-token Format/Minify; Task 3 covers controls/search/validation; Task 4 covers layout/accessibility; Task 5 covers files/export/privacy boundaries; Task 6 covers measured guardrails, browsers, privacy evidence, and release documentation.
- No arbitrary capacity value is invented here: Task 6 must measure and record actual guardrails; Task 1 cannot pass through unverified component behavior.
- Review Focus items map to explicit test steps, including hostile keys, pending-file races, composition/undo, rejected I/O, and hidden/deleted selections.
- Contracts intentionally keep worker messages source/plain-data based; revision increases across undo; dirty state compares source, avoiding false clean/dirty states after undo.
- Dependency API evidence is from upstream READMEs/types, not a demonstrated full integration. lossless-json preserves numeric tokens but may normalize string-token spelling during tree edits; this is allowed if values remain identical. jsonc-parser is used strictly for syntax/source operations (including exact-token Format/Minify), not to allow JSONC or trust tolerant parsed values.
- Before execution: user reviews and approves this revised plan. The prior execution-method choice was Subagent-driven; confirm it remains appropriate for this revision. Reuse and verify the already-established isolated worktree at `../json-assistant-worktrees/json-workspace`; do not create another worktree during planning. Brain logging remains pending the already reported personal-brain layout clarification.
- Native means this session implements each task, then a fresh whole-branch review. Subagent-driven means a fresh implementer and reviewer per task plus whole-branch review. Neither selection waives the Task 1 stop gate or authorizes unrelated features/deployment.

## Documentation consulted for planning

- [svelte-jsoneditor README/API](https://github.com/josdejong/svelte-jsoneditor): immutable content, parser, callbacks, selection/update methods, automatic tree repair, lazy array sections; no documented shared-history prop.
- [svelte-jsoneditor types](https://github.com/josdejong/svelte-jsoneditor/blob/main/src/lib/types.ts): content, selections, patch callbacks, history types.
- [lossless-json README](https://github.com/josdejong/lossless-json): numeric lexemes, duplicate-key handling, browser support; slower than native parsing.
- [jsonc-parser README](https://github.com/microsoft/node-jsonc-parser): source offsets, strict parse options, scanner, formatting edits. Its tolerant recovery must never authorize invalid input.
