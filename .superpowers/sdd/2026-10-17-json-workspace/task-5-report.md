# Task 5 implementation report

## Summary

Implemented native local file, clipboard, and download actions. File opens are abortable and generation-gated; they preserve the live document until read success and require fresh confirmation if the document changed during the read. Other whole-document replacements invalidate pending file opens. Paste-as-document also checks for a document change during clipboard read. Paste and clear confirm dirty replacements. Copy/download preserve raw source; invalid downloads warn first. Successful download initiation alone updates `exportedSource`. Dirty documents install a best-effort `beforeunload` listener. `subtreeSource` validates current source and slices the original token range, refusing invalid/duplicate trees. Tree selection copy is wired to that helper; code edits clear any previous tree selection, and array indexes retain numeric path segments.

## Commands and results

Commands are listed in execution order; initial exploratory failures are retained here rather than hidden.

1. `git status --short && git log -4 --oneline` — clean worktree at start; branch `feat/json-workspace`, HEAD `dfaa8c2`.
2. `npm test -- src/lib/io.test.ts src/lib/document.test.ts` — passed 11 existing document tests; the new I/O test did not exist yet, so this was not a red run.
3. `npm test -- src/lib/io.test.ts src/lib/document.test.ts` — expected red: `src/lib/io.test.ts` could not import missing `./io` (11 other tests passed).
4. `npm run test:e2e -- tests/workspace.spec.ts` — expected red on initial I/O behavior (clipboard rejection bubbled; Open file control absent); command exceeded the 120-second tool timeout partway through Firefox.
5. A subsequent E2E invocation was interrupted by the harness. The orphaned Vite server then made the next targeted run fail because port 5173 was occupied. `ps -eo pid,command | grep '[v]ite --host 127.0.0.1 --port 5173'` identified the two server processes from that interrupted run; `kill 3643672 3643676` stopped only those processes.
6. `npm run test:e2e -- tests/workspace.spec.ts -g 'copy preserves exact dirty source|dirty file replacement'` — 4 passed in Chromium/Firefox.
7. `npm run test:e2e -- tests/workspace.spec.ts -g 'copy preserves exact dirty source|dirty file replacement|download initiates|clearing dirty source'` — 8 passed in Chromium/Firefox.
8. `npm test -- src/lib/io.test.ts src/lib/document.test.ts` — 14 passed across 2 files.
9. `npm run test:e2e -- tests/workspace.spec.ts -g 'cancelling a pending file read|late earlier file read'` — 4 passed in Chromium/Firefox.
10. `npm run test:e2e -- tests/workspace.spec.ts -g 'an edit during file loading'` — Chromium timed out because a synchronous confirmation dialog blocked `page.evaluate`; Firefox passed. The test was corrected to trigger the callback asynchronously.
11. `npm run test:e2e -- tests/workspace.spec.ts -g 'an edit during file loading'` — 2 passed in Chromium/Firefox after the test correction.
12. `npm run test:e2e -- tests/workspace.spec.ts` — 40 passed in Chromium/Firefox.
13. `npm run check` — first run found one TypeScript mismatch (`unknown[]` vs `ParseError[]`); corrected to the parser’s `ParseError[]` type.
14. `npm test` — 30 passed across 4 test files.
15. `npm run build` — succeeded; emitted the existing warning that the minified main chunk exceeds 500 kB.
16. `npm run test:e2e -- tests/workspace.spec.ts` — 42 passed in Chromium/Firefox, including failed-read, file-ordering, and dirty-edit-during-read cases.
17. `npm run check` — passed with 0 errors and 0 warnings.
18. `npm test` — 30 passed across 4 test files.
19. `npm run build` — succeeded; the >500 kB chunk-size warning remains.
20. `npm run test:e2e -- tests/workspace.spec.ts` — 44 passed (22 Chromium, 22 Firefox), 1 worker.
21. After the final replacement-confirmation adjustment, `npm run check` — passed with 0 errors and 0 warnings.
22. `npm test` — 30 passed across 4 test files.
23. `npm run build` — succeeded; the >500 kB chunk-size warning remains.
24. Final `npm run test:e2e -- tests/workspace.spec.ts` — 44 passed (22 Chromium, 22 Firefox), 1 worker.
25. Following a final review that found and closed races between pending file opens and later whole-document replacements, `npm run check` — passed with 0 errors and 0 warnings.
26. `npm test` — 30 passed across 4 test files.
27. `npm run build` — succeeded; the >500 kB chunk-size warning remains.
28. Final `npm run test:e2e -- tests/workspace.spec.ts` — 46 passed (23 Chromium, 23 Firefox), 1 worker. Covers dirty confirmation, raw export, clipboard/read failures, cancellation, late file ordering, edit-during-load, replacement invalidation, and dirty-state unload handling.
29. `git diff --check && git status --short && git diff --stat` — no whitespace errors; only Task 5 source/tests were modified before adding this report.
30. `git diff --check` — passed with no output.
31. `git add src/App.svelte src/lib/io.ts src/lib/io.test.ts tests/workspace.spec.ts .superpowers/sdd/2026-10-17-json-workspace/task-5-report.md` — source/tests staged; Git rejected the ignored `.superpowers` report path.
32. `git status --short && git diff --cached --check` — source/tests staged and no whitespace errors.
33. `git add -f .superpowers/sdd/2026-10-17-json-workspace/task-5-report.md && git diff --cached --check` — force-added the explicitly requested report despite `.superpowers` being ignored; staged diff check passed.

## Limitations and concerns

- Browser `beforeunload` prompts are best effort; browsers may suppress or customize them. The implementation does not claim disk-write confirmation: the status explicitly says “Download initiated.”
- Browser clipboard permission behavior remains browser-controlled; rejection is surfaced as an actionable error.
- The production bundle still triggers Vite’s >500 kB chunk warning; splitting was not part of Task 5.
- No payloads are written to browser storage or network, and generated download filenames do not include document content.

## Review fixes and verification

The follow-up review found that the existing helper was not connected to the UI, invalid-download warning was only in the confirmation prompt, and download URLs were revoked immediately. The UI now has **Copy subtree**, with current valid/duplicate-free tree gating and exact source slicing; editing source clears the prior tree selection. Invalid drafts show a persistent warning explaining that the exact raw source, including invalid content, will be exported. Download object URLs are revoked 1 second after successful anchor activation and immediately if activation throws; Chromium and Firefox tests assert revocation does not precede the browser download event and that cleanup eventually happens.

The `Number.isSafeInteger(file.size)` check remains metadata validation only, not an allocation ceiling. No arbitrary quota was added because no documented, cross-browser supported `FileReader` maximum was established; there is no product size limit.

Review-phase commands and results:

1. `git status --short && git log -1 --oneline` — clean worktree at prior Task 5 commit `11a7bf5`.
2. `npm run test:e2e -- tests/workspace.spec.ts -g 'download initiates|copy subtree preserves|source edits invalidate'` — expected red: missing visible invalid-export warning and missing Copy subtree UI in both browsers (6 failed).
3. After adding UI assertions, the same focused E2E command — 4 subtree tests passed; invalid-download warning locator was ambiguous because both tree and export use `role=status` (2 failed). The assertion was narrowed to the warning text.
4. `npm run test:e2e -- tests/workspace.spec.ts -g 'download initiates|copy subtree preserves|source edits invalidate'` — 6 passed in Chromium/Firefox, including delayed URL revocation.
5. `npm test -- src/lib/io.test.ts` — expected red: numeric array path `[0]` returned empty source because the helper converted numeric segments to strings.
6. `npm test -- src/lib/io.test.ts` — 4 passed after preserving numeric path segments.
7. `npm run check` — passed with 0 errors and 0 warnings.
8. `npm test` — 31 passed across 4 test files.
9. `npm run build` — succeeded; Vite reported the existing main-chunk size warning (>500 kB).
10. `npm run test:e2e -- tests/workspace.spec.ts` — 50 passed (25 Chromium, 25 Firefox), 1 worker.
11. `git diff --check && git status --short && git diff --stat` — passed with no whitespace errors; only the review fixes and updated report are modified.
