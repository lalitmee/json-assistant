# Task 2 result — strict JSON processing

## Outcome

Implemented strict JSON analysis, source-preserving formatting and minification, and a cancellable module worker coordinator. The Task 1 document revision gate rejects stale analysis and formatting results. Processing uses `jsonc-parser`'s scanner for iterative depth/node preflight before strict parse/format; source token slices are retained for minification, while formatting applies source edits to preserve number spelling and string escapes. Duplicate keys are syntax-valid diagnostics (including decoded-equivalent keys and `__proto__`); invalid input produces no transformed source. No LosslessNumber instances cross the worker boundary.

The integration remains a gate, not a full product UI: browser tests exercise worker format/minify through a development-only bridge; the App owns and disposes its processor.

## Verification

- `npm test -- src/lib/process.test.ts src/lib/processing.test.ts src/lib/document.test.ts` — **25 passed**.
- `npm test` — **25 passed**.
- `npm run check` — **0 errors, 0 warnings**.
- `npm run build` — passed; Vite retains its existing large main-chunk warning (~821 kB).
- `npm run test:e2e -- tests/editor-gate.spec.ts` — **25/26 passed** on its latest complete run. Both browser projects passed the new worker format/minify test. An existing source-editor race intermittently appended `{}` immediately after `locator.fill` in the hostile-key source case (Firefox in latest complete run; Chromium in an earlier run); the focused hostile-key test passed in both browsers on a separate retry. No cause is established, and no source was altered to mask it. This is recorded as the previously documented transient invalid-source/editor test mismatch, not as a processing failure.

## Existing limitations retained

- **Manual native IME verification was not performed.** The existing synthetic composition test is not evidence of OS IME behavior.
- No full workflow UI or file I/O was added.

## Files

- `src/lib/process.ts`, `src/lib/process.worker.ts`, `src/lib/processing.ts`
- `src/lib/process.test.ts`, `src/lib/processing.test.ts`, `src/lib/document.test.ts`
- `src/App.svelte`, `tests/editor-gate.spec.ts`

## Review fix — preflight must stop recursive parsing

The Important review finding was valid: scanner guardrail diagnostics previously did not stop the unconditional `parseJsonc` call. Added a regression using 10,000 nested arrays. Before the fix, it failed with `RangeError: Maximum call stack size exceeded`; after the fix, scanner diagnostics prevent parse and format paths from running.

- Focused: `npm test -- src/lib/process.test.ts src/lib/processing.test.ts src/lib/document.test.ts` — **26 passed**.
- Full unit suite: `npm test` — **26 passed**.
- `npm run check` — **0 errors, 0 warnings**.
- `npm run build` — passed; existing large main-chunk warning remains.
- `npm run test:e2e -- tests/editor-gate.spec.ts` — **22/26 passed**. Four failures were the known intermittent editor-fill race, where `{}` appeared appended after `locator.fill` (three Chromium cases and one Firefox case). The new worker operation cases passed in both browsers.

The deferred Minor finding about the stale-revision coordinator test remains unchanged and outstanding. Manual native IME verification remains outstanding.
