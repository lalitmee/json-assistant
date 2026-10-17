# JSON Workspace Settings and Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent presentation-only Settings page, independent application/editor themes, licensed local fonts, accessible tree disclosures, and clear formatting feedback without saving or transmitting JSON.

**Architecture:** Keep `App.svelte` as document coordinator and owner of navigation/preferences; isolate storage parsing in a small pure module. Keep `EditorPanes.svelte` mounted behind Settings and pass only editor appearance/font inputs; style with existing CSS tokens and patch the pinned editor's disclosure component reproducibly at install time.

**Tech Stack:** Existing Svelte 5, TypeScript, Vite, Vitest, CSS, `svelte-jsoneditor@3.13.0`; one patch maintenance dev dependency only if needed.

**Spec:** `docs/superpowers/specs/2026-10-18-settings-and-themes-design.md` (supersedes conflicting parts of the original UI redesign spec and remaining original plan tasks). Task 1 of the original plan was committed as `706e897`; do not redo it.

## Global Constraints

- Only appearance, palette, editor theme, font, and explicitly chosen view may persist; never JSON, file metadata, selections, history, analysis, or clipboard data. No uploads, accounts, telemetry, remote assets, or automatic recovery.
- Defaults: System appearance, Ocean application palette, Midnight shared Code/Tree theme, system monospace font; responsive view Split at width ≥900px and Code below 900px until explicitly chosen.
- Application palettes Ocean/Graphite/Forest each need light and dark background, foreground, surface, border, focus, accent tokens; editor themes Midnight/Orchid/Paper are independent of app appearance and cover delimiters, disclosures, and selections.
- Maintain mounted editor instances and original document semantics, 40 × 40 desktop / 44 × 44 narrow/touch disclosure targets, accessible names and `aria-expanded`, reduced-motion behavior, and valid bundled font licenses.
- **Do not run E2E tests.** Use unit/check/build/format and manual Chrome DevTools checks only. Preserve the existing 1 MB and 100 MB release blockers; do not claim release readiness.

## File responsibilities

- `src/lib/preferences.ts`: types, defaults, validation, guarded load/save (UI primitives only).
- `src/lib/preferences.test.ts`: storage/default/failure tests.
- `src/App.svelte`: Settings/Back flow, focus handoff, preference ownership, CSS data attributes, existing document coordinator unchanged.
- `src/lib/EditorPanes.svelte`: existing editors, shared editor-theme/font presentation props, Format/Minify entry points callable for invalid drafts but not while processing.
- `src/app.css`: application/editor tokens, navigation styling, fonts, motion/targets.
- `src/assets/fonts/`: two redistribution-verified WOFF2 families and corresponding licenses; actual names set after license verification.
- `patches/svelte-jsoneditor+3.13.0.patch`, `package.json`, `package-lock.json`: deterministic installed-dependency disclosure fix (use `patch-package` as a dev dependency with `postinstall`; do not edit `node_modules` as the only copy).
- `docs/verification/2026-10-18-settings-themes.md`: exact manual observations and unresolved coverage.

## Review Focus

1. Malformed/old or blocked browser storage must fall back safely; narrow defaults to Code but saved Split survives resize — Task 1 tests and Task 2 manual inspection.
2. Back from Settings with an unsaved invalid draft or in-flight processing must keep the mounted editor and existing history — Task 2 test and manual inspection.
3. Paper editor in dark Forest application (and Midnight in light Ocean) must retain readable brackets, arrows and selection — Task 3 manual checks.
4. Nested arrays/objects expanded by pointer, keyboard or programmatic action must expose matching state and nonoverlapping hit targets — Task 5 patch check and manual inspection.
5. Invalid/duplicate-key formatting, worker rejection, or a stale completion must not show false success or mutate the draft — Task 4 tests and manual inspection.

---

### Task 1: Validated UI preferences

**Files:** Create `src/lib/preferences.ts`, `src/lib/preferences.test.ts`.

**Interfaces:** Export `type Preferences = { appearance: 'system' | 'dark' | 'light'; palette: 'ocean' | 'graphite' | 'forest'; editorTheme: 'midnight' | 'orchid' | 'paper'; font: 'system' | 'local-a' | 'local-b'; view?: View }`, `const defaultPreferences: Preferences`, `resolveView(preferences: Preferences, width: number): View`, `loadPreferences(storage: Pick<Storage, 'getItem'>): Preferences`, `savePreferences(storage: Pick<Storage, 'setItem'>, preferences: Preferences): void`. Use `View` from `src/lib/document.ts`; the font IDs map to the two verified families chosen in Task 3. A versioned key such as `json-workspace.preferences.v1` stores only these fields.

- [ ] **Step 1: Write failing tests** — assert missing, malformed, unknown-version, out-of-range enum and throwing `getItem` all yield validated defaults; mixed valid/invalid fields retain only valid options; `setItem` exceptions do not throw; saved JSON has no document/source fields; `resolveView(defaultPreferences, 899) === 'code'`, at 900 is `'split'`, and explicit `'split'` wins at 400.
- [ ] **Step 2: Run** `npx vitest run src/lib/preferences.test.ts`; expect failures for missing exports.
- [ ] **Step 3: Implement** named exports above with a minimal per-field allowlist and guarded storage calls; never save the computed responsive view.
- [ ] **Step 4: Run** focused test and `npm run check`; expect exit 0.
- [ ] **Step 5: Commit** only the two files (`feat: validate workspace preferences`).

### Task 2: Settings page without unmounting editors

**Files:** Modify `src/App.svelte`, `src/app.css`, `src/workspace.test.ts`.

**Interfaces:** App owns `let preferences: Preferences`, `let page: 'workspace' | 'settings'`; imports Task 1 helpers and updates preferences via one controlled setter. Settings renders labeled appearance/palette/editor-theme/font selectors and Split/Code/Tree buttons, with Settings trigger and Back to workspace; `EditorPanes` remains inside a hidden workspace container instead of a conditional page branch. On mount load preferences, respect explicit view and resize default; save only on user changes. Focus Settings heading on entry and Settings trigger on return (after DOM update).

- [ ] **Step 1: Write failing SSR structure tests** in `src/workspace.test.ts`: rendered workspace has Settings action and no Split/Code/Tree layout nav; Settings markup exists and describes local preferences versus unsaved JSON; editor pane markup stays within a hideable workspace container, not a conditional destroyed subtree. Add a small state test at the nearest viable component boundary for unchanged document/revision when switching page, if SSR cannot exercise clicks; use Chrome manually for actual mounted-instance identity.
- [ ] **Step 2: Run** `npx vitest run src/workspace.test.ts`; expect failures for missing Settings markup.
- [ ] **Step 3: Implement** navigation/controls, guarded preference initialization, focus transition and hide/show without changing document callbacks; remove only the old layout navigation. If hidden editor APIs misbehave, fix visibility lifecycle in place, never recreate document state on Back.
- [ ] **Step 4: Run** focused test and `npm run check`; inspect Chrome at 1280px and 650px: switch view, edit/undo, open Settings, Back, verify source/selection/history and invalid-draft diagnostics remain, and resize with default versus selected view.
- [ ] **Step 5: Commit** these files (`feat: add persistent workspace settings page`).

### Task 3: Distinct palettes, editor themes, local fonts

**Files:** Modify `src/App.svelte`, `src/lib/EditorPanes.svelte`, `src/app.css`; create verified font assets and license texts under `src/assets/fonts/`.

**Interfaces:** `EditorPanes` receives `editorTheme: Preferences['editorTheme']` and `font: Preferences['font']` as presentation props; App applies `data-appearance` / `data-palette` to the page root and passes both editor props. CSS handles live System preference and editor themes independently; no content/history writes.

- [ ] **Step 1: Write a focused SSR test** asserting chosen presentation props/attributes do not change the source or revision (or a pure token-mapping test if component SSR cannot expose state); run it and see failure before implementation.
- [ ] **Step 2: Verify font provenance** from official upstream sources; select two WOFF2 monospace families with compatible redistribution licenses, keep their license texts next to files, rename Task 1's `local-a`/`local-b` IDs to meaningful verified names in tests and code before shipping. If two cannot be licensed, stop and revise the spec instead of using a CDN.
- [ ] **Step 3: Implement** six app palette variants and three editor variable groups; explicitly cover `--jse-delimiter-color`, disclosure icon color, selected text/background, panel and syntax colors in both modes; prefer CSS `prefers-color-scheme` / `prefers-reduced-motion` media queries and a short transition. Bundle `@font-face` and apply one font to both panes where supported.
- [ ] **Step 4: Run** focused tests, `npm run check`, `npm run build`; Chrome inspect all six app pairings, each editor theme in Code and Tree (including Paper/dark Forest and Midnight/light Ocean), system-color change, reduced motion, contrast, selection and network requests for fonts only from local origin.
- [ ] **Step 5: Commit** only this task's changes (`feat: theme workspace and editors with local fonts`).

### Task 4: Format and Minify feedback

**Files:** Modify `src/App.svelte`, `src/lib/EditorPanes.svelte`, `src/app.css`; test in `src/workspace.test.ts` and the smallest focused operation-feedback test where a mocked processor can drive the result.

**Interfaces:** Keep `runOperation(operation: ProcessRequest['operation']): Promise<ProcessResult>` and existing processor; add `runWithFeedback(operation: 'format' | 'minify'): Promise<void>` in App. The toast state holds `{ kind: 'success' | 'error'; message: string } | undefined`; one timeout handles success dismissal and is cleared on replacement/unmount. Do not persist toast state or include source/diagnostic text in it.

- [ ] **Step 1: Write failing tests** — invalid syntax and duplicate-key Format/Minify attempts show a dismissible error and preserve exact source/revision; valid completion shows a polite success toast that clears after a few seconds; processor rejection shows persistent error; stale completion after another edit/cancel shows no success. Assert inline diagnostics remain rendered and both actions are disabled only while processing.
- [ ] **Step 2: Run** focused tests; expect failure for missing feedback/action wiring.
- [ ] **Step 3: Implement** the wrapper over `runOperation`: capture both revision and `processId` before invoking; do not show feedback unless both still match after completion (covers cancellation/replacement/edit), and show success only with valid returned source. Show generic source-free errors for invalid/duplicate or failure; a new toast replaces the previous one. Keep existing analysis/commit gating, catch rejections at the user action boundary, preserve the current draft, and allow invalid drafts to click Format/Minify when idle. Announce success politely and errors assertively with a dismiss button; preserve existing diagnostics. Never emit success for background `analyze`.
- [ ] **Step 4: Run** focused tests, `npm run check`; manually inspect Chrome for invalid JSON, duplicate keys, successful Format and Minify, processing failures/cancellation, Settings navigation and toast focus/timeout.
- [ ] **Step 5: Commit** only Task 4 changes (`feat: report formatting results accessibly`).

### Task 5: Accessible tree disclosures and verification

**Files:** Modify `package.json`, `package-lock.json`, `src/app.css`; create `patches/svelte-jsoneditor+3.13.0.patch`, a small patch regression check, `docs/verification/2026-10-18-settings-themes.md`.

**Interfaces:** Patch both array and object `.jse-expand` buttons in installed `components/modes/treemode/JSONNode.svelte` to bind `aria-expanded={expanded}` and meaningful target-specific `aria-label` from existing node context, without changing `toggleExpand` or editing interactions. `postinstall` reapplies the patch on clean install.

- [ ] **Step 1: Write failing patch check** that asserts both disclosure branches in the installed component have stateful ARIA markup and the patch exists; run `npm test` to see the failure. Add a targeted browser validation for live expanded/collapsed state rather than assuming markup alone proves runtime semantics.
- [ ] **Step 2: Produce reproducible patch** with `patch-package` (pin dev dependency and lockfile), or if that tool cannot patch published source safely, stop for revision. CSS scopes actual button boxes to Tree: ≥40px desktop / ≥44px narrow or touch, visible focus, preserve indentation and row editing.
- [ ] **Step 3: Verify clean install** with `npm ci`, focused patch check, `npm run check`, `npm test`, `npm run build`, `npm run format:check`, `git diff --check`. Do not run `npm run test:e2e` or Playwright.
- [ ] **Step 4: Manual Chrome DevTools acceptance**: keyboard Enter/Space and pointer expansion on nested arrays/objects, programmatic expand if available, names/state and measured boxes without overlap; Settings/Back with edits, history and in-flight work; wide/narrow layout, fonts/colors, focus and reduced motion; console/network inspection for errors and payload transmission. Record observed checks and unverified browsers/IME plus existing large-payload blockers in the verification document.
- [ ] **Step 5: Commit** only patch/config/CSS/check/verification files (`fix: expose accessible tree disclosure state`).

## Execution handoff

Review this plan and its referenced approved spec before implementation. The previous choice of native execution for the old redesign does not bypass review of this replacement plan; once confirmed, continue natively without E2E runs.
