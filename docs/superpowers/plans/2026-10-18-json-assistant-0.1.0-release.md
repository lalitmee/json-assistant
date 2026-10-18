# JSON Assistant 0.1.0 Release Plan

> **For agentic workers:** Use `superpowers:executing-plans` to carry out this plan task-by-task. Do not merge, tag, or deploy until the release gate is explicitly cleared.

**Goal:** Safely merge the JSON Assistant release candidate to `main`, deploy it on the user's Vercel account, and publish a `0.1.0` release tag for the exact deployed commit.

**Architecture:** Keep the existing `feat/json-workspace` branch as the integration source. Clear documented release blockers and review current working-tree changes before merging; deploy through the Git-linked Vercel project from `main`, then create the version tag on that verified commit. Do not deploy dirty local files.

**Tech Stack:** Git/GitHub, npm, Vite/Svelte, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-17-json-workspace-design.md`; release requirements and blocker evidence in `docs/verification/2026-10-17-release.md`.

## Global Constraints

- JSON processing remains local to the browser; static hosting serves app assets only.
- The required 1 MB core workflow must pass before release; do not raise guardrails without representative resource evidence.
- Never imply unlimited payload capacity; document measured limitations.
- Preserve all existing working-tree changes; stage only reviewed release files.
- The `0.1.0` tag must identify the exact commit verified as deployed.

## Review Focus

- 1 MB broad-array JSON must support the documented core workflow without refusal or an unresponsive-page warning.
- Current uncommitted changes must be reviewed and intentionally committed; no unrelated or generated files enter the release.
- Vercel must build the same `main` commit that receives the release tag.
- Production privacy behavior must not be inferred from local tests alone; inspect live production requests.
- Existing bundle-size warning and measured large-payload limitations must be documented rather than hidden.

---

## Current Evidence and Preconditions

- `feat/json-workspace` is 29 commits ahead of `origin/main`; it is not behind.
- The working tree contains modifications and untracked assets/components. These have not been reviewed as a single release commit and must not be swept into a merge.
- No `0.1.0` tag was found locally or remotely.
- `docs/verification/2026-10-17-release.md` marks release blocked: 1 MB broad-array core workflow is refused by the current 100,000-token guardrail; 100 MB cases crash or time out.
- Vercel workspace is the Hobby team `Lalit Kumar's projects`. Its listed Git-linked projects do not include `lalitmee/json-assistant`; querying that team for `json-assistant` returned no project. Project setup/selection remains a required decision.
- Desired Vercel project slug and default hostname: `json-assistant` / `json-assistant.vercel.app`, subject to availability. A custom domain has not been specified.

## Tasks

### Task 1: Clear the release gate

- [ ] Diagnose and address the 1 MB broad-array core-workflow blocker using measured browser resource behavior; do not merely raise the token limit.
- [ ] Re-run the representative benchmark and complete the supported core workflow on the 1 MB fixture.
- [ ] Update `docs/verification/2026-10-17-release.md` with exact measured evidence, environment, guardrails, limitations, and commands.
- [ ] If the 1 MB requirement cannot be met safely, stop release work and ask the user whether to defer 0.1.0 or explicitly revise the release requirement.

### Task 2: Prepare a clean release candidate

- [ ] Review the complete diff and untracked files on `feat/json-workspace`; preserve unrelated user changes and exclude generated output/secrets.
- [ ] Resolve the app name consistently as **JSON Assistant** in visible UI/document metadata (including the pending page title, main heading, Settings brand, and tests); retain internal preference keys unless migration is separately required.
- [ ] Run `npm ci`, `npm run check`, `npm test`, `npm run test:e2e`, `npm run format:check`, `npm run build`, and `git diff --check`.
- [ ] Review the full branch diff against `origin/main`, then commit only reviewed release changes.

### Task 3: Merge to `main`

- [ ] Refresh `origin/main` and confirm the feature branch remains based on the expected main commit.
- [ ] Review the proposed merge diff and run the release checks against the exact merge candidate.
- [ ] Merge `feat/json-workspace` into `main` using the repository's agreed merge method; verify the resulting commit and clean tree.

### Task 4: Link and deploy through Vercel

- [ ] Check availability of `json-assistant.vercel.app`; use it as the production hostname if available. If unavailable, ask the user for a preferred custom domain or fallback slug.
- [ ] In the Hobby team, link or create the Vercel project with project slug `json-assistant` for GitHub repository `lalitmee/json-assistant`, with `main` as the production branch and the repository root as the Vite app root.
- [ ] Verify build/install/output settings against the repository (`npm run build`, output directory `dist`) and ensure required environment variables are absent or explicitly configured without exposing values.
- [ ] Deploy the merged `main` commit; inspect build logs and deployment state, then smoke-test the production URL and confirm no JSON payload is sent to a remote service.

### Task 5: Tag and publish 0.1.0

- [ ] After production deployment is verified, create annotated tag `v0.1.0` on the exact deployed `main` commit (confirm whether the user requires bare `0.1.0` instead).
- [ ] Push the tag and verify the remote tag resolves to the deployed commit.
- [ ] Publish concise release notes with shipped capabilities, measured limits, and known limitations; do not claim support beyond the evidence.
