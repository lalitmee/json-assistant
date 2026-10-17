# JSON Assistant release 1 design

Date: 2026-10-17

Status: Revised specification pending user review. The user approved semantic-value fidelity instead of exact text-token fidelity for tree edits on 2026-10-17. Implementation requires approval of this revision and the updated plan.

## Objective and agreed intent

Build a developer-focused, browser-based JSON workspace for daily API debugging. The first workflow is: paste a response or open a file, inspect nested fields, search, edit, format, and copy or download the result.

The user explicitly selected an existing editor component, local-only processing, code and tree views, and inspection-first handling of large payloads. They requested documentation for future enhancements, not their implementation in release 1.

“Any payload” means no restriction to one JSON shape and no product-imposed upload quota. It does not mean unlimited memory, guaranteed performance at every size, support for every data format, or unlimited nesting. Accept objects, arrays, strings, numbers, booleans, and null at the root. Invalid input remains editable.

## Scope

Release 1 includes one in-memory document, file opening, text paste, code/tree navigation, search, field-path and subtree copying, structured editing, formatting/minification, undo/redo, copy/download, and a Split / Code / Tree view selector.

Release 1 excludes accounts, payload uploads, cloud sharing, tracking, automatic persistent storage, AI, graph/table views, schema validation, automatic repair, JSONC/JSON5/JSONL support, URL fetching, format conversions, and multiple-document tabs. These exclusions do not prohibit retaining invalid source for manual correction.

The separate [roadmap](../../roadmap.md) records future candidates and evidence needed before adding them.

## Technical direction

Use the existing `svelte-jsoneditor` component rather than building a source editor or editable tree. The proposed implementation stack for written-spec review is Svelte 5 with TypeScript and Vite, using the component natively. This stack detail was not separately approved in conversation; approving this specification approves it. No SvelteKit server, router, global state library, database, or backend is needed for this single-screen application.

The editor README documents Svelte 5 compatibility, code/tree modes, custom parsing, search, validation hooks, and undo/redo. Those documented features do not prove that two synchronized panes preserve history and selection, or that every operation preserves numbers. Verify integration before committing to it.

Use a lossless JSON parser compatible with the component wherever conversion to structured data is required. Do not use a plain native parse/stringify round trip for precision-sensitive operations. Select the parser version and verify behavior during implementation planning and the integration check; dependency versions are not fixed by this product specification.

## Architecture and boundaries

- Workspace shell: toolbar, layout selector, accessible controls, document status, errors, and local-processing explanation.
- Document coordinator: owns source revision, dirty state, diagnostics, current selection, and transactions shared between the views. Reuse component state/history APIs where they satisfy these requirements rather than maintaining competing histories.
- Editor integration: binds source and structured views to the same document and avoids feedback loops when programmatic updates propagate between them.
- Processing boundary: runs expensive parsing, indexing, and formatting in a cancellable worker. Rendering and worker scheduling are separate responsibilities. The worker is not a backend and cannot transmit payloads.
- File and clipboard boundary: handles user-initiated input/output with native browser APIs and reports failures without discarding content.

These are responsibilities, not a requirement for separate files or a plugin framework. Keep the implementation small and split modules only where the real integration needs it.

## Source, synchronization, and history

Source text is authoritative. Keep the exact current draft even when it is incomplete or invalid. Associate asynchronous results with the source revision and ignore results for superseded revisions.

For valid input, source edits update the tree after processing. Tree edits produce an explicit document transaction and update the source. A tree edit may normalize whitespace, string escape spelling, and object-member order. Apply only the requested operation; all values outside the operation's affected path must remain identical, including large integers, high-precision decimals, exponent-form numbers, and negative zero. Use lossless numeric handling rather than JavaScript `Number` for synchronization. Source text stays exact until an edit or explicit formatting action changes it. Invalid drafts remain exact in source mode.

While source is invalid, disable tree editing and display a visible stale/unavailable label. A last-valid tree may remain visible only with that label; it must not claim to represent the current draft. Source errors include a location and a useful explanation. No automatic repair occurs.

Undo/redo spans source edits, tree edits, formatting, and minification in chronological order. Each explicit formatting/minification action is one undoable transaction. View switching must not reset history or content. Preserve selected field and source cursor position where the view can represent them; after a field is deleted, move selection to a surviving parent rather than a nonexistent path.

If shared history or semantic-value-preserving structured editing cannot be achieved reliably with the chosen component, stop at the integration gate and revise the design with the user. Do not silently ship inconsistent histories or substitute a bespoke editor. Exact preservation of untouched token spelling and member order across tree edits is not a release requirement.

## Workspace and controls

Provide a three-way segmented selector:

- Split: source and tree side by side, with a resizable divider.
- Code: source uses the full workspace.
- Tree: structured view uses the full workspace.

Default to Split when the workspace is at least 900 CSS pixels wide and Code otherwise. Resizing does not repeatedly override an explicit user selection. For a narrow viewport in Split mode, stack panes rather than requiring a minimum desktop width. Layout choices stay in memory for the current visit; do not persist them automatically.

The toolbar exposes Open file, Format, Minify, Undo, Redo, Copy JSON, and Download. View-specific controls expose source search and tree key/value search. Tree search covers collapsed branches; choosing a match reveals its ancestors. Highlight selected paths and provide Copy path and Copy subtree. Use an escaped JSONPath-style field path; keys containing punctuation must not produce an ambiguous path. Copy subtree exports the selected current value; after a tree edit, its whitespace and escape spelling need not match the original source.

Status displays validity, UTF-8 document size, unsaved changes, and any inspection-only or processing state. State explicitly that processing is local and documents are not automatically saved between visits. Provide light/dark styling following system preference, readable focus indicators, labeled controls, and keyboard-operable navigation and resizing.

The mockups are layout explorations, not commitments to typography, color values, exact toolbar spacing, or multiple file tabs. The selected direction combines both mockups through the view selector.

## Formatting, validation, and data fidelity

Syntax validation is included. Schema validation and style linting are separate future features and must not be implied by a “Valid JSON” status.

Format and Minify are explicit actions on syntactically valid input. They change whitespace only, preserving value tokens and member order. Use two-space indentation for Format in release 1. Neither operation sorts keys, coerces values, repairs syntax, or converts a JSON string into embedded JSON.

Detect duplicate object keys before structured editing can collapse them. Preserve their original source, show a warning, and disable tree editing and subtree export for the ambiguous document. Source copy/download remains available. Source-only whitespace formatting may remain available only if it demonstrably preserves every member. Never present a collapsed, last-key-wins tree as a faithful representation.

Tests must cover integers beyond JavaScript's safe integer range, high-precision decimals, exponent notation, negative zero, escaped strings, Unicode, empty collections, all root types, and repeated object keys. Tree-edit tests compare JSON values with lossless numeric semantics: changing one path must not alter any other value, even when serialization changes token spelling or object-member order. Separate tests verify that Format and Minify preserve value tokens and member order. Protect value fidelity across editing, view switching, formatting, and export. Render payload text as text, never executable HTML; do not automatically load URLs contained in values.

## Large payloads and cancellation

Inspection takes priority over full editing. There is no arbitrary upload quota, but there are explicit safety guardrails for operations that could exhaust browser resources. Report size and operation limits honestly rather than promising unlimited files.

Before full rendering, inspect size and shape in the processing boundary. Avoid expanding the whole document or mounting all rows. Use the component's lazy rendering where adequate. If it cannot provide responsive inspection, report the limitation rather than introducing a custom streaming engine without design review.

Show a processing state and Cancel for long-running work. Cancellation terminates or replaces the worker; a cancelled or superseded result cannot replace the current document. Retain the last committed document until a newly opened file has been read successfully. Oversized source buffers and rendering also consume memory; workers alone do not solve those costs.

When editing/rendering is unsafe, explain which capabilities are unavailable and retain safe source export where available. Do not attempt unlimited retries or force a full parse on the UI thread. If the document cannot be inspected safely at all, stop with a clear resource-limit error and preserve the previous document.

Benchmark fixtures at 100 KB, 1 MB, 10 MB, and 100 MB across broad arrays, deep objects, and long strings. Record browser, hardware, timings, peak memory when measurable, usable modes, and failures. These are test sizes, not promised support levels. The release must pass the core workflow on the 1 MB fixture without an unresponsive-page warning; larger results determine documented mode guardrails. If that minimum is not achieved, revise the integration before release.

## Files, export, and privacy

All payload processing stays on the device. No accounts, network payload submission, analytics, third-party scripts, remote fonts, automatic schema resolution, or automatic remote-resource previews. Hosting may receive ordinary static-asset requests; local-only describes document handling, not absence of a web server delivering the app.

Opening another document or clearing the workspace prompts before discarding dirty content. Use a browser-supported unload warning while dirty, but do not promise the browser will always display it. Copying does not clear the dirty state because it does not establish a saved file. A successfully initiated download may mark the current revision as exported; the interface must not claim the browser confirmed a write to disk.

Copy JSON and Download export current source, including invalid drafts, with a visible warning when invalid. Copy subtree is available only for a current, valid, unambiguous tree. File-read, clipboard, worker, and export failures leave the document intact and provide an actionable error. Never place payload content in the URL or error telemetry.

Offline installation and persistent document recovery are not release-1 promises. They are separate roadmap candidates.

## Verification and release gates

Before building the full shell, verify the existing-editor integration with two views: synchronization, shared undo, selection retention, semantic preservation of untouched values (including lossless numbers), duplicate-key handling, invalid drafts, and cancellation boundaries. A tree edit may normalize whitespace, escape spelling, or object-member order; these representation changes are not failures if all unaffected values remain semantically identical. This is planned implementation validation, not permission to implement before the revised plan is approved.

Keep focused automated checks for document transitions and a browser-level test of the complete paste/open, inspect/search, edit, format, switch-view, undo, and export loop. Include adversarial payloads, worker failure, stale results, cancelled file loads, and clipboard rejection. Unit tests alone do not establish a functional editor integration.

Check keyboard access, focus visibility, accessible names, narrow layouts, and divider operation. Test current stable Chromium and Firefox and record any browser-specific limitations. Verify network activity during representative workflows: document contents must never be transmitted and third-party resources must not load.

The release is not ready if it changes an unintended value, loses source on an error, mislabels a stale tree, resets undo on view changes, or transmits payloads. Representation changes after a tree edit are allowed as stated above. Document measured performance and inspection-only limitations with the release.

## References and approval boundary

- [Competitor research](../../research/2026-10-17-json-tools.md)
- [Future-enhancement roadmap](../../roadmap.md)
- [Existing editor documentation](https://github.com/josdejong/svelte-jsoneditor)
- [Svelte TypeScript documentation](https://svelte.dev/docs/svelte/typescript)
- [Svelte getting started](https://svelte.dev/docs/svelte/getting-started)

Conversation approval covered the brief, existing-editor approach, architecture, data-safety rules, view selector, and reliability section. This written specification makes additional concrete defaults visible for review. Its approval permits writing an implementation plan, not beginning implementation. The plan must then be reviewed and an execution method selected.
