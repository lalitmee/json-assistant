# JSON Assistant

A local, single-document JSON editor for source/tree inspection, search, edits, formatting, and export.

## Local use

Requires Node.js 22.12 or newer and Yarn. Run `yarn install --frozen-lockfile`, `yarn dev`, then open the local Vite URL. `yarn check`, `yarn test`, `yarn build`, and `yarn test:e2e` verify the app. `yarn benchmark` runs generated browser fixtures; generated files under `benchmarks/generated/` are ignored.

Document processing is local to the browser. Static hosting still serves ordinary app assets; “local” does not mean no hosting requests. Payloads are not automatically persisted or recovered. Browser memory and responsiveness vary: benchmark sizes are test inputs, not quotas or unlimited-size promises. The 1 MiB broad-array workflow is currently unsupported; see [`docs/verification/2026-10-17-release.md`](docs/verification/2026-10-17-release.md) for measured limitations.

See the [design specification](docs/superpowers/specs/2026-10-17-json-workspace-design.md), [research](docs/research/2026-10-17-json-tools.md), and [roadmap](docs/roadmap.md).
