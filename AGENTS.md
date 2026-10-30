# Repository instructions

- Use Yarn only; `yarn.lock` is the dependency lockfile. Install with `yarn install --frozen-lockfile`; do not create or restore `package-lock.json`.
- Requires Node.js 22.12 or newer. Run scripts with `yarn <script>`: `dev`, `check`, `test`, `test:e2e`, `build`, `format:check`, or `benchmark`.
- Focused unit tests: `yarn vitest run src/lib/process.test.ts` (tests are included from `src/**/*.test.ts`).
- Browser tests: `yarn test:e2e`; Playwright config runs Chromium in parallel (and Firefox in CI or when `ALL_BROWSERS=1`) and starts or reuses its Vite server.
- App entrypoint is `src/main.ts` mounting `src/App.svelte`. JSON processing logic and its unit tests live in `src/lib/process.ts` and `src/lib/*test.ts`; browser-level tests live in `tests/`.
- `yarn benchmark` generates fixtures in `benchmarks/generated/`, which is gitignored.

## Testing guidelines

- **No CSS or pixel testing in E2E:** Do not assert computed styles, font sizes, bounding box dimensions, pixel heights, z-index, or color values in Playwright tests. These create brittle tests with zero functional safety. Static class names and accessibility attributes are verified in unit tests via `src/workspace.test.ts`.
- **Quality over test volume:** E2E tests must focus strictly on meaningful application state and real browser integrations (Web Worker message channels, clipboard I/O, file downloads, cross-pane synchronization, dirty baseline tracking, and focus management).
- **Shift logic down the pyramid:** Async state machines, race conditions, and data transformations should be covered in fast Vitest unit tests rather than end-to-end browser workflows.
