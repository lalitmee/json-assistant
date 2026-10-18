# Repository instructions

- Use Yarn only; `yarn.lock` is the dependency lockfile. Install with `yarn install --frozen-lockfile`; do not create or restore `package-lock.json`.
- Requires Node.js 22.12 or newer. Run scripts with `yarn <script>`: `dev`, `check`, `test`, `test:e2e`, `build`, `format:check`, or `benchmark`.
- Focused unit tests: `yarn vitest run src/lib/process.test.ts` (tests are included from `src/**/*.test.ts`). Browser tests: `yarn test:e2e`; Playwright config runs Chromium and Firefox sequentially and starts its own Vite server.
- App entrypoint is `src/main.ts` mounting `src/App.svelte`. JSON processing logic and its unit tests live in `src/lib/process.ts` and `src/lib/*test.ts`; browser-level tests live in `tests/`.
- `yarn benchmark` generates fixtures in `benchmarks/generated/`, which is gitignored.
