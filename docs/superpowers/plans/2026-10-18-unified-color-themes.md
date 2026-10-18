# Unified Color Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the independent app/editor theme controls with one shared theme family, preserve mode switching, and remove the workspace header's top gap.

**Architecture:** `Preferences` stores one validated `theme` plus the existing appearance, font, and view. The app shell and `EditorPanes` receive the same theme ID; CSS maps it and the active mode to official upstream palette tokens for app and editor. A version-1 preference record migrates to Cobalt2 while preserving compatible settings.

**Tech Stack:** Svelte 5, TypeScript, CSS custom properties, Vitest, Yarn.

**Spec:** `docs/superpowers/specs/2026-10-18-unified-color-themes-design.md`

## Global Constraints

- Keep System / Dark / Light mode; System follows `prefers-color-scheme` live.
- Use the named theme's original palette values; do not recolor or blend palettes to fit JSON Assistant.
- Cobalt2 uses its original palette unchanged for both mode values.
- Add no theme or styling dependency.
- Theme changes must not increment document revision, affect JSON bytes, or disturb undo/redo.
- Never persist document content or editor state.
- Keep the workspace header at the top edge on desktop and mobile without removing horizontal gutters or changing Settings layout.
- Do not run E2E tests.

## Review Focus

- Legacy version-1 records can have conflicting themes; migration must select Cobalt2 while preserving valid mode, font, and explicit view. Pin with `migrates split legacy themes to Cobalt2 and retains compatible preferences` in Task 1.
- Invalid or blocked storage and unknown version-2 theme IDs must still produce safe defaults. Pin with `rejects unknown v2 themes and tolerates unavailable storage` in Task 1.
- System appearance must respond to OS light/dark preference while explicit Dark/Light override it. Pin CSS media/selector coverage with `maps each theme to its official mode variants` in Task 2.
- Cobalt2 must not switch palettes when appearance changes. Pin the absence of a light override plus unchanged editor colors with `keeps Cobalt2 palette identical in both modes` in Task 2.
- The same selected theme must color app chrome and both editor views. Pin selector/attribute propagation with `offers one theme selector for app and Code/Tree` in Task 3.

---

### Task 1: Unify and migrate stored preferences

**Files:**
- Modify: `src/lib/preferences.ts`
- Test: `src/lib/preferences.test.ts`

**Interfaces:**
- Produces `ColorTheme = "cobalt2" | "tokyo-night" | "catppuccin" | "rose-pine" | "solarized" | "vscode-dark-plus" | "github"`.
- Produces `Preferences = { appearance: "system" | "dark" | "light"; theme: ColorTheme; font: "system" | "jetbrains" | "fantasque"; view?: View }`.
- Keeps `loadPreferences(storage: Pick<Storage, "getItem">): Preferences`, `savePreferences(storage: Pick<Storage, "setItem">, preferences: Preferences): void`, and `resolveView(preferences: Preferences, width: number): View`.

- [ ] **Step 1: Write the failing preference tests**

  Replace split palette/editor-theme assertions with tests that:
  - default `theme` to `"cobalt2"`;
  - load every supported version-2 theme and reject an unknown `theme` to Cobalt2;
  - migrate a version-1 record containing conflicting `palette`/`editorTheme` values to `theme: "cobalt2"`, retaining valid `appearance`, `font`, and explicit `view`;
  - save version 2 to `json-workspace.preferences.v2` with `appearance`, `theme`, `font`, and optional explicit `view`, excluding source and obsolete keys;
  - retain the current malformed/blocked-storage and responsive-view behavior.

- [ ] **Step 2: Run the focused tests and verify the expected failures**

  Run: `yarn vitest run src/lib/preferences.test.ts`
  Expected: failures for the missing single-theme schema, version-1 migration, and version-2 storage shape.

- [ ] **Step 3: Implement `ColorTheme`, `Preferences`, and versioned storage in `src/lib/preferences.ts`**

  Read `json-workspace.preferences.v2` first, then the existing `json-workspace.preferences.v1` record for migration. For a v1 record, preserve only valid appearance/font/view and set theme to Cobalt2. Save subsequent changes to the v2 key with `version: 2`; keep storage exceptions non-fatal. Keep the viewport default (`split` at width ≥900px, otherwise `code`) unchanged.

- [ ] **Step 4: Run focused and full tests**

  Run: `yarn vitest run src/lib/preferences.test.ts`
  Expected: all preference tests pass.

  Run: `yarn test`
  Expected: all existing tests pass after the test schema updates.

- [ ] **Step 5: Commit the preference migration**

  ```bash
  git add src/lib/preferences.ts src/lib/preferences.test.ts
  git commit -m "feat: unify color theme preference"
  ```

### Task 2: Map official palettes to shared app/editor tokens

**Files:**
- Create: `docs/research/2026-10-18-theme-palette-sources.md`
- Modify: `src/app.css`
- Test: `src/workspace.test.ts`

**Interfaces:**
- Consumes `ColorTheme` IDs from Task 1 and the existing `data-appearance` mode on `.app-shell`.
- Produces CSS selectors using `data-theme` on `.app-shell` and `.panes`; both selectors map the same family/mode to app and editor variables.

- [ ] **Step 1: Write the failing theme coverage tests**

  Replace assertions for old palette/editor-theme selectors with tests that require all seven theme IDs to have app and editor token rules. Add checks for the official dark/light pairings: Tokyo Night/Day, Catppuccin Mocha/Latte, Rose Pine/Rose Pine Dawn, Solarized Dark/Light, VS Code Dark+/Light+, and GitHub Dark/Light. Assert representative exact source colors for each mapping using the upstream source record created in this task. Assert Cobalt2 has no mode-specific override and its editor token values are the same in both modes.

- [ ] **Step 2: Run the focused test and verify it fails for missing unified rules**

  Run: `yarn vitest run src/workspace.test.ts`
  Expected: failures because the app/editor rules are still keyed independently and the new theme families are absent.

- [ ] **Step 3: Record upstream palette provenance**

  Create `docs/research/2026-10-18-theme-palette-sources.md` with the authoritative upstream repository/file URL and exact variant name for Cobalt2, Tokyo Night/Day, Catppuccin Mocha/Latte, Rose Pine/Rose Pine Dawn, Solarized Dark/Light, VS Code Dark+/Light+, and GitHub Dark/Light. Record the exact upstream values used for semantic app and editor tokens; do not invent or adjust hex colors.

- [ ] **Step 4: Implement shared CSS theme rules in `src/app.css`**

  Define app semantic variables and `svelte-jsoneditor` variables for each theme variant using `data-theme`. Make System select the matching variant through `prefers-color-scheme`; explicit Dark/Light select their variant directly. Keep Cobalt2 token values identical regardless of mode. Keep the existing Cobalt2 dark primary and shared control border/transition behavior. Remove obsolete Ocean/Graphite/Forest and Midnight/Orchid/Paper theme rules once equivalent unified rules exist.

- [ ] **Step 5: Run theme coverage and full tests**

  Run: `yarn vitest run src/workspace.test.ts`
  Expected: theme-token and Cobalt2 invariance assertions pass.

  Run: `yarn test`
  Expected: all tests pass.

- [ ] **Step 6: Commit the palette mapping**

  ```bash
  git add docs/research/2026-10-18-theme-palette-sources.md src/app.css src/workspace.test.ts
  git commit -m "feat: add unified original color palettes"
  ```

### Task 3: Connect one theme selector to app and editors

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/lib/EditorPanes.svelte`
- Test: `src/workspace.test.ts`

**Interfaces:**
- Consumes `Preferences.theme: ColorTheme` from Task 1 and the shared `data-theme` CSS rules from Task 2.
- Produces one `Color theme` dropdown with seven options; `EditorPanes` receives `theme: Preferences["theme"]` and renders `data-theme={theme}`.

- [ ] **Step 1: Write failing UI tests**

  Add `offers one theme selector for app and Code/Tree` asserting Settings includes one **Color theme** dropdown with the seven specified names, omits **Application palette** and **Code and Tree theme**, and the app shell/editor panes expose the same selected theme value. Retain assertions for Mode and Editor font.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `yarn vitest run src/workspace.test.ts`
  Expected: the old two dropdowns and split attributes fail the new single-selector assertions.

- [ ] **Step 3: Update `src/App.svelte` and `src/lib/EditorPanes.svelte`**

  Set `data-theme={preferences.theme}` on `.app-shell`; replace the two theme controls with the single seven-option **Color theme** dropdown; update the `EditorPanes` prop from `editorTheme` to `theme`, pass the preference through, and set `data-theme={theme}` on `.panes`. Keep appearance mode, font, view, settings navigation, and editor lifecycle unchanged.

- [ ] **Step 4: Run UI tests, type checks, and full tests**

  Run: `yarn vitest run src/workspace.test.ts`
  Expected: one selector drives both app and editor attributes.

  Run: `yarn check && yarn test`
  Expected: type/Svelte checks and all tests pass.

- [ ] **Step 5: Commit the unified selector**

  ```bash
  git add src/App.svelte src/lib/EditorPanes.svelte src/workspace.test.ts
  git commit -m "feat: use one shared color theme selector"
  ```

### Task 4: Remove the workspace header top gap

**Files:**
- Modify: `src/app.css`
- Test: `src/workspace.test.ts`

**Interfaces:**
- Consumes the existing `.workspace` and `.workspace-header` layout.
- Produces a workspace header whose border box starts at the viewport's top edge at desktop and mobile sizes, with existing horizontal gutters retained.

- [ ] **Step 1: Write the failing gap regression test**

  Add `places the workspace header flush with the viewport top` asserting workspace top padding is zero and desktop/mobile header top margins are zero while horizontal padding/margins remain 12px desktop and 10px mobile.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `yarn vitest run src/workspace.test.ts`
  Expected: failure against the current 12px workspace top padding and negative header margins.

- [ ] **Step 3: Update workspace top spacing in `src/app.css`**

  Set desktop `.workspace` padding to `0 12px 12px` and `.workspace-header` margin to `0 -12px`; under the existing max-width 700px rule use workspace padding `0 10px 10px` and header margin `0 -10px`. Leave `.settings-page` and `.settings-header` unchanged.

- [ ] **Step 4: Run layout test and verify in the browser**

  Run: `yarn vitest run src/workspace.test.ts`
  Expected: gap regression test passes.

  Inspect existing Chrome page at wide and narrow viewport sizes. Expected: workspace header begins at y=0, settings header remains unchanged, and editor panes retain their bottom/side spacing.

- [ ] **Step 5: Commit the header layout fix**

  ```bash
  git add src/app.css src/workspace.test.ts
  git commit -m "fix: remove workspace header top gap"
  ```

### Task 5: Final verification and theme inspection

**Files:**
- Verify only; no planned code changes.

- [ ] Run `yarn test`; expected all unit and workspace tests pass.
- [ ] Run `yarn check`; expected Svelte and TypeScript checks pass.
- [ ] Run `yarn build`; expected production build succeeds (record any existing bundle-size warning).
- [ ] Run `yarn prettier --check src/App.svelte src/app.css src/lib/EditorPanes.svelte src/lib/preferences.ts src/lib/preferences.test.ts src/workspace.test.ts docs/research/2026-10-18-theme-palette-sources.md` and `git diff --check`; expected clean output.
- [ ] Inspect the existing Chrome app at wide/narrow sizes: every theme in System/Dark/Light, both Code and Tree, primary and hover/focus controls, settings selection, workspace top edge, and unchanged Settings header. Do not run E2E tests.

## Execution Notes

- Existing uncommitted Cobalt2 implementation and button-polish changes are already in the worktree. Preserve them; Tasks 2–4 evolve that work into the approved unified theme design rather than reverting it.
- The spec and this plan do not resolve the existing large-payload release blocker.
