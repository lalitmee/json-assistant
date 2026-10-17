# Task 2 result — strict JSON processing

## Outcome

Implemented strict JSON analysis, source-preserving formatting and minification, and a cancellable module worker coordinator. The Task 1 document revision gate rejects stale analysis and formatting results. Processing uses `jsonc-parser`'s scanner for iterative depth/node preflight before strict parse/format; source token slices are retained for minification, while formatting applies source edits to preserve number spelling and string escapes. Duplicate keys are syntax-valid diagnostics (including decoded-equivalent keys and `__proto__`); invalid input produces no transformed source. No LosslessNumber instances cross the worker boundary.

The integration remains a gate, not a full product UI: browser tests exercise worker format/minify through a development-only bridge; the App owns and disposes its processor.

## Verification

- `npm test -- src/lib/process.test.ts src/lib/processing.test.ts src/lib/document.test.ts` — **26 passed** after the preflight fix.
- `npm test` — **26 passed** after the preflight fix.
- `npm run check` — **0 errors, 0 warnings**.
- `npm run build` — passed; Vite retains its existing large main-chunk warning (~821 kB).
- `npm run test:e2e -- tests/editor-gate.spec.ts` — **26/26 passed** after changing the shared source fixture helper to select-all and use Playwright's paste-style `keyboard.insertText` rather than `locator.fill`. The invalid-draft case then passed 10 repetitions in each browser (20/20), followed by the full suite (13 Chromium, 13 Firefox). The earlier `fill` mismatch is consistent with editor input-method behavior: a direct character-by-character probe auto-closed braces; the exact cause of the previous `fill` trace remains unproven, so it is disclosed rather than claimed fixed in product code.
- `npm run check` — **0 errors, 0 warnings** (fresh run after test-helper change).
- `npm run build` — exit 0, existing large main-chunk warning at 821.23 kB.

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
- The first post-fix `npm run test:e2e -- tests/editor-gate.spec.ts` was **22/26 passed** with four editor-fill failures. The test source helper was changed to a paste-style insertion; subsequent repeated invalid-draft runs and the full suite passed as documented above.

The deferred Minor finding about the stale-revision coordinator test remains unchanged and outstanding. Manual native IME verification remains outstanding.

## Final review disposition

The reviewer’s Major concern that duplicate-key analysis was not connected to the tree gate was re-reviewed and found to be a false positive. `EditorPanes.sourceChanged` parses current source with `lossless-json`; duplicate keys (including decoded-equivalent keys and `__proto__`) throw, which sets the unavailable state, displays a status, and hides the tree while retaining source. Direct parser checks and the targeted Chromium/Firefox test confirm this behavior. Scoped reviewer `ses_eb4e70747ffeLksUBLLT20I4qe` returned Spec compliance PASS and quality PASS, with no new Critical/Important findings.

The deferred Minor stale-coordinator test gap and unverified manual native IME check remain explicit limitations.
