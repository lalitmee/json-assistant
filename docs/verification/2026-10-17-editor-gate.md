# Editor integration gate — BLOCKED / UNREADY

[Certain] The simplest documented two-instance `content`/`parser`/`onChange` integration does **not** preserve untouched string tokens. This is a diagnostic harness, not a completed Task 1 integration or a product UI. Do not proceed to Task 2.

## Reproduce

```sh
npm ci
npx playwright install chromium firefox
npm run test:e2e -- tests/editor-gate.spec.ts --grep 'minimal escaped-string'
```

Alternatively, `npm run dev`, replace Source with the literal input below, double-click `before` in Tree, type `after`, and press Enter:

```json
{"escaped":"\u0061","sibling":"before"}
```

[Certain] Both Chromium and Firefox produce this source through the configured lossless parser:

```json
{
  "escaped": "a",
  "sibling": "after"
}
```

[Certain] The component reports the actual edit as `[{"op":"replace","path":"/sibling","value":"after"}]` (displayed below the panes), but its updated content is structured JSON. Serializing that content with `lossless-json.stringify` cannot recover the original escape spelling. The harness does not use native JSON serialization for document content; `JSON.stringify` is only used to display patch diagnostics.

[Certain] A second case, `{"2":"two","1":"one","sibling":"before"}`, reorders the untouched keys to `"1"`, then `"2"`, after the same edit. The numeric lexemes `9007199254740993`, `1.2300`, `1e+09`, and `-0` **do** survive the tested sibling edit. Do not conflate numeric precision with full source-token fidelity.

## Scope of the conclusion

[Certain] This blocks the tested documented integration, not a proof that every possible integration is impossible. The `redo` patch supplies a possible integration seam. No token-preserving patch adapter was implemented or verified. A single string replacement adapter would not establish preservation for rename, subtree add/remove, array insertion/movement, or operations without `patchResult`; implementing an extensive patch/source reconciliation engine would exceed the requested simple gate attempt. A design decision is needed before investing in that path. Fidelity has not been relaxed and no bespoke editor/parser has been built.

[Certain] Shared-history compatibility remains **unproven**. Toolbar Undo/Redo are bare, unwired harness controls. The shared-history test is intentionally red at its first Undo assertion; this is missing coordinator behavior, **not** evidence that component shared history is impossible. The fidelity failure stopped coordinator, selection, and shell work.

## Versions and environment

[Certain] Recorded from the actual installation:

- Linux; Node `v24.9.0`; npm `11.6.1`.
- Svelte `5.57.2`; svelte-jsoneditor `3.13.0`; lossless-json `4.3.2`; jsonc-parser `3.3.1` (installed as required, unused in this diagnostic).
- Vite `8.3.4`; @sveltejs/vite-plugin-svelte `7.3.1`; TypeScript `6.0.3`; svelte-check `4.7.7`; @types/node `26.6.5`.
- Vitest `5.0.5`; @playwright/test `1.64.1`.
- Playwright bundled Chromium `156.0.8078.4` and Firefox `157.0`, headless. These are the installed Playwright browser builds, not a separately verified stable-channel release certification.

[Certain] All top-level dependency versions are exact and the npm lockfile is committed. Initial unqualified TypeScript installation selected `7.0.2`, outside svelte-check's declared `^5 || ^6` peer range; it was replaced with compatible `6.0.3` before verification. Browser downloads and launches succeeded; final failures are application behavior assertions, not missing browser/system dependencies.

## Commands and actual results

- [Certain] Initial RED: `npm run test:e2e -- tests/editor-gate.spec.ts` — 8 failures on the unsynchronized screen; tree sibling absent. [Full output](editor-gate-evidence/initial-red.log). That initial selector also used an outdated `.jse-value` class, so this run alone is **not** evidence of a component fidelity defect.
- [Certain] Corrected harness: switched to the observed accessible `button "before"`; fixed `Content` discrimination with exported `isTextContent` (callbacks include `text: undefined` alongside `json`). These were harness defects, not product blockers. A resumed, interrupted initial run and a later 150-second runner timeout were rerun to completion.
- [Certain] Final RED: `npm run test:e2e -- tests/editor-gate.spec.ts` — **8 failed, 6 passed (2.1m)**, exit 1. [Full output](editor-gate-evidence/final-e2e.log).
- [Certain] Failing in both browsers: `shared chronological history` (not implemented), `lossless unchanged tokens` (escape normalized), `numeric-looking member order survives a sibling edit` (order changed), `minimal escaped-string sibling case` (escape normalized).
- [Certain] Passing in both browsers: invalid/decoded-equivalent duplicate drafts remain exact with tree hidden; all seven root shapes render unchanged; hostile keys/HTML/URL strings remain inert in the exercised load path. These are diagnostic characterization checks, not completion of every safety requirement.
- [Certain] `npm run check` — exit 0, **0 errors, 0 warnings**. [Output](editor-gate-evidence/check.log).
- [Certain] `npm run build` — exit 0; **815.97 kB** main JS chunk and the default >500 kB chunk warning. [Output](editor-gate-evidence/build.log).
- [Certain] `npm test` — exit 1, **No test files found**; Vitest correctly includes only `src/**/*.test.ts`, not Playwright specs. No pure coordinator implementation/tests were created after the stop gate. This is not reported as GREEN. [Output](editor-gate-evidence/unit.log).
- [Certain] `git diff --check` — exit 0 before diagnostic commit.

## Browser evidence

- [Chromium escaped sibling screenshot](editor-gate-evidence/escaped-sibling-chromium.png)
- [Firefox escaped sibling screenshot](editor-gate-evidence/escaped-sibling-firefox.png)
- [Chromium numeric-looking member order screenshot](editor-gate-evidence/member-order-chromium.png)

[Certain] Local Playwright traces/screenshots remain under ignored `test-results/` and regenerate on the test command. Committed screenshots/logs contain only synthetic fixtures.
[Certain] Captured logs have trailing whitespace removed for Git hygiene; test outcomes and output content are otherwise unchanged.

## Self-review and remaining gates

- [Certain] Only minimal Svelte/Vite configuration, two component instances, source/patch readouts, and bare history buttons were added. The title explicitly says UNREADY. No full shell, workers, IO, persistence, custom parser, or subsequent task code exists in this change.
- [Certain] Syntax/duplicate checks run before updating Tree; invalid source is never sent into its repairing mode. The previous valid tree stays mounted but hidden and read-only when unavailable. Its context menu is disabled; main menus are hidden and ask-to-format is disabled in Source.
- [Certain] The component's default keyboard behavior is **not** fully restricted/coordinated. This diagnostic screen must not be shipped as a safe workspace.
- [Certain] Required `document.ts` coordinator contracts and final `EditorPanes` props were not implemented; they would misleadingly suggest an accepted integration. Shared chronological history, no-echo transaction counting, stale/cancelled deferred callbacks, view/selection retention, deleted-child parent fallback, context-menu history, add/remove/rename/array moves, and IME composition were not verified. Native IME manual check: **NOT PERFORMED**; synthetic composition would not establish actual IME correctness anyway.
- [Certain] No GREEN fidelity run exists. The red assertions remain ordinary failing tests, not expected failures or skipped checks. Only diagnostic work is suitable for commit; the feature must remain blocked pending review.

## Documentation consulted

- [Upstream svelte-jsoneditor README](https://github.com/josdejong/svelte-jsoneditor): native Svelte 5 setup, custom lossless parser, content variants, `onChange`, programmatic update guarantees, selection APIs, context-menu filtering, and tree auto-repair behavior.
- Context7 `/sveltejs/svelte`: current Svelte 5 `mount`, TypeScript preprocessing, legacy-compatible component syntax. Context7 did not return an exact svelte-jsoneditor library; upstream headless README plus installed package source/types were used instead.
- Installed `svelte-jsoneditor/types.d.ts` and `components/modes/treemode/TreeMode.svelte`: `JSONPatchResult.redo`/`undo`, structured callbacks and paths without patch results.
