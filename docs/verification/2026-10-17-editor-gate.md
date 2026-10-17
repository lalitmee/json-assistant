# Editor integration gate — PASS (Task 1 only)

## Outcome

The minimal two-pane integration passes the Task 1 automated gate in Playwright Chromium and Firefox. Source is authoritative; a tree operation applies its JSON Patch redo operations to the current lossless source value and serializes with `lossless-json`. This preserves unaffected numeric values while allowing whitespace, string escape spelling, and object-member order to normalize.

## Exercised checks

- Shared chronological source/tree undo and redo through toolbar, source shortcut, tree shortcut, and editor context menu.
- View changes retain the selected tree path; deleting a selected child falls back to its surviving parent.
- Tree replace, object add/remove/rename, and array insertion/movement preserve unaffected values, including `9007199254740993`, `1.2300`, `1e+09`, `-0`, and an escaped string.
- Invalid and decoded-equivalent duplicate-key source remains exact and does not produce an editable tree.
- All seven JSON root types; hostile property names; HTML/URL-looking strings; no unexpected network requests or prototype mutation.
- Programmatic pane synchronization creates no echo callback/extra transaction.
- A synthetic composition-event sequence protects composed text from the app's undo shortcut routing.
- Deferred stale and cancelled completion callbacks are covered by controlled unit tests in `src/lib/document.test.ts`.

The browser operation test uses the editor's documented `patch` API through a development-only gate bridge. User-triggered tree edits use the same patch application helper through the actual `onChange` callback. The bridge is not a product control and is absent from production builds.

## Commands and results

- `npm run test:e2e -- tests/editor-gate.spec.ts` — **22 passed**: 11 Chromium, 11 Firefox. [Full output](editor-gate-evidence/final-e2e.log)
- `npm run check` — **0 errors, 0 warnings**. [Output](editor-gate-evidence/check.log)
- `npm test` — **8 passed**. [Output](editor-gate-evidence/unit.log)
- `npm run build` — exit 0. Vite reports the existing large main-chunk warning (820.04 kB). [Output](editor-gate-evidence/build.log)
- `git diff --check` — pass.

## Environment

- Linux; Node `v24.9.0`; npm `11.6.1`.
- Svelte `5.57.2`; svelte-jsoneditor `3.13.0`; lossless-json `4.3.2`; Vite `8.3.4`; TypeScript `6.0.3`; Vitest `5.0.5`; Playwright `1.64.1`.
- Playwright bundled Chromium `156.0.8078.4` and Firefox `157.0`.

## IME limitation

The composition test dispatches synthetic `CompositionEvent`s and a synthetic composing Ctrl+Z event, then verifies browser-editor text input. **Manual native IME verification was not performed.** Automation does not prove behavior with an operating-system IME; this remains a human check before release.

## Scope and privacy

This is only the Task 1 diagnostic/integration gate, not the polished workspace. It adds no worker, file/clipboard I/O, persistence, or product shell. Fixtures are synthetic. Source and invalid drafts remain in browser memory and are not persisted or transmitted.

## Evidence files

- [Final browser run](editor-gate-evidence/final-e2e.log)
- [Type check](editor-gate-evidence/check.log)
- [Unit tests](editor-gate-evidence/unit.log)
- [Production build](editor-gate-evidence/build.log)
