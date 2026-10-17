# Editor integration gate — PASS (Task 1 only)

## Outcome

The minimal two-pane integration passes the Task 1 automated gate in Playwright's Chromium and Firefox projects. Source is authoritative; a tree operation applies its JSON Patch redo operations to the current lossless source value and serializes with `lossless-json`. This preserves unaffected numeric values while allowing whitespace, string escape spelling, and object-member order to normalize. Selection now walks up to the nearest surviving ancestor if a selected ancestor is removed.

## Exercised checks

- Shared chronological source/tree undo and redo through toolbar, source shortcut, tree shortcut, and editor context menu.
- View changes retain the selected tree path; deleting a selected child or ancestor falls back to the nearest surviving parent.
- Tree replace, object add/remove/rename, and array insertion/movement preserve unaffected values, including `9007199254740993`, `1.2300`, `1e+09`, `-0`, and an escaped string.
- Invalid and decoded-equivalent duplicate-key source remains exact and does not produce an editable tree.
- All seven JSON root types; hostile property names; HTML/URL-looking strings; no unexpected network requests or prototype mutation.
- Programmatic pane synchronization creates no echo callback/extra transaction.
- A synthetic composition-event sequence protects composed text from the app's undo shortcut routing.
- Deferred stale and cancelled completion callbacks are covered by controlled unit tests in `src/lib/document.test.ts`.

The browser operation test uses the editor's documented `patch` API through a development-only gate bridge. User-triggered tree edits use the same patch application helper through the actual `onChange` callback. The bridge is not a product control and is absent from production builds.

## Commands and results

- `npm run test:e2e -- tests/editor-gate.spec.ts` — **24 passed**: 12 Playwright Chromium, 12 Playwright Firefox.
- Stable Google Chrome `154.0.8037.97` — **12 passed** using `/usr/bin/google-chrome`. [Log](editor-gate-evidence/stable-chrome.log)
- System Firefox `157.0` could not launch under this environment (`CanCreateUserNamespace: EPERM`); Playwright Firefox `157.0` passed all 12 tests. This is an environment launch limitation, not a test assertion failure.
- `npm run check` — **0 errors, 0 warnings**.
- `npm test` — **9 passed**.
- `npm run build` — exit 0. Vite reports the existing large main-chunk warning (820.24 kB).

One earlier Chromium run transiently read the invalid draft `{"a":` as `{"a":{}` immediately after `locator.fill`. The focused test passed 11 consecutive retries, and later complete Chromium and Chromium/Firefox runs passed without code changes; the trigger was not established. Keep this as an observed, currently non-reproducible test/editor interaction rather than claiming a root cause.

## Environment

- Linux; Node `v24.9.0`; npm `11.6.1`.
- Svelte `5.57.2`; svelte-jsoneditor `3.13.0`; lossless-json `4.3.2`; Vite `8.3.4`; TypeScript `6.0.3`; Vitest `5.0.5`; Playwright `1.64.1`.
- Playwright bundled Chromium `156.0.8078.4` and Firefox `157.0`; system Google Chrome `154.0.8037.97` and system Firefox `157.0`.

## IME limitation

The composition test dispatches synthetic `CompositionEvent`s and a synthetic composing Ctrl+Z event, then verifies browser-editor text input. **Manual native IME verification was not performed.** Automation does not prove behavior with an operating-system IME; this remains a human check before release.

## Scope and privacy

This is only the Task 1 diagnostic/integration gate, not the polished workspace. It adds no worker, file/clipboard I/O, persistence, or product shell. Fixtures are synthetic. Source and invalid drafts remain in browser memory and are not persisted or transmitted.

## Evidence files

- [Final browser run](editor-gate-evidence/final-e2e.log)
- [Stable Google Chrome run](editor-gate-evidence/stable-chrome.log)
- [Type check](editor-gate-evidence/check.log)
- [Unit tests](editor-gate-evidence/unit.log)
- [Production build](editor-gate-evidence/build.log)
