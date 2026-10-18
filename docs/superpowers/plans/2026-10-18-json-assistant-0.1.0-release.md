# JSON Assistant 0.1.0 Release Plan

> **For agentic workers:** Use `superpowers:executing-plans` to carry out this plan task-by-task. The user has explicitly authorized a 0.1.0 colleague-testing release with the documented 1 MiB limitation; do not represent that limitation as resolved.

**Goal:** Deploy the merged JSON Assistant 0.1.0 candidate on the user's Vercel Hobby team and publish an annotated `v0.1.0` tag/release for the exact deployed commit, for colleague testing.

**Architecture:** Keep the existing `feat/json-workspace` branch as the integration source. Document the explicitly accepted 1 MiB limitation, review and verify the candidate, then deploy through a Git-linked Vercel project from `main` and tag that exact deployed commit. Do not deploy dirty local files.

**Tech Stack:** Git/GitHub, npm, Vite/Svelte, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-17-json-workspace-design.md`; release requirements and blocker evidence in `docs/verification/2026-10-17-release.md`.

## Global Constraints

- JSON processing remains local to the browser; static hosting serves app assets only.
- The 1 MiB broad-array workflow is known to fail; the user accepts that limitation for this colleague-testing release. Do not raise guardrails or imply support without representative resource evidence.
- Never imply unlimited payload capacity; document measured limitations.
- Preserve all existing working-tree changes; stage only reviewed release files.
- The `0.1.0` tag must identify the exact commit verified as deployed.

## Review Focus

- The 1 MiB broad-array failure is prominently disclosed; this candidate makes no support claim for that input.
- Current uncommitted changes must be reviewed and intentionally committed; no unrelated or generated files enter the release.
- Vercel must build the same `main` commit that receives the release tag.
- Production privacy behavior must not be inferred from local tests alone; inspect live production requests.
- Existing bundle-size warning and measured large-payload limitations must be documented rather than hidden.

---

## Current Evidence and Preconditions

- `feat/json-workspace`, local `main`, and `origin/main` are at `28f3a2e` before this release-documentation update.
- The feature worktree is clean; the primary checkout has an unrelated untracked `yarn.lock`, which must be preserved and excluded.
- No `0.1.0` tag was found locally or remotely.
- The 1 MiB broad-array core workflow is refused by the current 100,000-token guardrail; the attempted 1,100,000-token candidate caused editor failures. 100 MB cases crash or time out. User accepts these documented limits for colleague testing only.
- Vercel Hobby team `Lalit Kumar's projects` is available (team ID `team_lLuUUVbToa0f9vtq1MAGp2w1`); no project is linked to `lalitmee/json-assistant` yet.
- User selected project slug/target hostname `json-assistant` / `json-assistant.vercel.app`. This `.vercel.app` subdomain is assigned on project creation; registrar availability checks do not determine its availability.

## Tasks

### Task 1: Record the accepted candidate limitation

- [x] Preserve the measured failure evidence and explicitly record the user's decision to ship 0.1.0 for colleague testing without claiming 1 MiB support.
- [x] Update the README and release verification status so the known limitation is clear to colleagues.

### Task 2: Prepare a clean release candidate

- [ ] Review the complete diff and untracked files on `feat/json-workspace`; preserve unrelated user changes and exclude generated output/secrets.
- [x] Resolve the app name consistently as **JSON Assistant** in visible UI/document metadata (including the browser title, README, main heading, Settings brand, and tests); retain internal preference keys.
- [ ] Run `npm ci`, `npm run check`, `npm test`, `npm run test:e2e`, `npm run format:check`, `npm run build`, and `git diff --check`.
- [ ] Review the full branch diff against `origin/main`, then commit only reviewed release changes.

### Task 3: Merge to `main` (already completed for the UI candidate)

- [x] The UI candidate is already merged to `main` at `28f3a2e`; fast-forward `main` with the reviewed release documentation after checks and verify the resulting commit/tree.

### Task 4: Link and deploy through Vercel

- [ ] Create/link the Vercel project with slug `json-assistant`; verify the assigned `json-assistant.vercel.app` hostname after creation.
- [ ] In the Hobby team, link or create the Vercel project with project slug `json-assistant` for GitHub repository `lalitmee/json-assistant`, with `main` as the production branch and the repository root as the Vite app root.
- [ ] Verify build/install/output settings against the repository (`npm run build`, output directory `dist`) and ensure required environment variables are absent or explicitly configured without exposing values.
- [ ] Deploy the merged `main` commit; inspect build logs and deployment state, then smoke-test the production URL and confirm no JSON payload is sent to a remote service.

### Task 5: Tag and publish 0.1.0

- [ ] After production deployment is verified, create annotated tag `v0.1.0` on the exact deployed `main` commit (confirm whether the user requires bare `0.1.0` instead).
- [ ] Push the tag and verify the remote tag resolves to the deployed commit.
- [ ] Publish `docs/releases/0.1.0.md` as concise release notes with shipped capabilities, measured limits, and known limitations; do not claim support beyond the evidence.
