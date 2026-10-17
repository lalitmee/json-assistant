# JSON Assistant enhancement roadmap

Status: Candidate enhancements, not committed scope or delivery dates.

## Release 1 baseline

Local-only developer web workspace for API debugging, using an existing editor with Split / Code / Tree layouts. See the [design specification](superpowers/specs/2026-10-17-json-workspace-design.md).

## Visualization candidates

- Table view for comparing arrays of records. Revisit when real debugging sessions repeatedly require row/column comparison.
- Graph view for explaining nesting and structural relationships. Revisit when users cannot answer those questions efficiently with the tree; benchmark node counts before selecting a renderer.
- Structure summaries and type/shape statistics. Revisit when search and tree navigation are insufficient for understanding unfamiliar payloads.

Do not build renderer registries, graph dependencies, or generic visualization plugins in release 1.

## Inspection and validation candidates

- JSONPath or jq querying with preview-only results before any transformation.
- JSON Schema validation with explicit draft support, resource limits, and no automatic remote-reference fetching.
- Optional lint rules with warnings clearly separated from syntax errors.
- JSONL, JSONC, or JSON5 as explicitly selected input modes, not silent relaxation of strict JSON.
- Repair suggestions with a change preview and explicit acceptance.
- Structural comparison between responses and selective redaction before export.

Prioritize these from actual API-debugging friction. Validate query security and data fidelity before introducing transformations.

## Workflow candidates

- Multiple documents when repeated copy/paste between responses justifies tabs.
- Opt-in local recovery with clear retention and deletion controls; no default storage of sensitive payloads.
- Offline installation after a caching and update strategy is designed.
- Desktop, browser-extension, and editor-extension distribution only after the web workflow proves useful.
- Explicit URL import only after defining CORS, credential handling, and whether local-only operation can be retained.

## Scale candidates

Use release-1 benchmarks to identify the actual bottleneck before introducing streaming parsers, partial indexes, disk-backed processing, or custom tree rendering. Document which operations work at each measured size and shape; never advertise unlimited capacity.

## Deliberate non-goals

AI, cloud sharing, accounts, and collaboration are not implied by the name or this roadmap. Each would require a separate purpose, privacy review, approved design, and implementation plan.
