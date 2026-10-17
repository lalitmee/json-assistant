# JSON Workspace UI Redesign

## Intent and scope

Make the existing browser-only JSON workspace feel like a focused developer tool: easy to understand at first glance, efficient during API debugging, and usable by keyboard and pointer. Keep the established document semantics, local-only processing, source/tree editing, history, invalid-draft safeguards, and Split/Code/Tree views. This is a presentation and interaction redesign, not a new editor engine or a release-readiness claim.

The agreed visual direction combines a dense, full-height, dark developer workspace with the clearer hierarchy of a guided interface. Light mode follows the user's system preference. The disposable visual companion mockups `workspace-icons-and-tooltips.html` and `workspace-tree-hit-targets.html` informed this specification; the mockups themselves are not product code.

## Information architecture

- Header: product identity, current document/unsaved state, prominent **Open JSON** and labeled **Paste**, then compact Copy JSON and Download icon buttons. No permanently visible buttons for actions that only exist during a file load or processing job. **Clear** remains discoverable as a labeled secondary action; do not create empty overflow menus. A contextual menu is acceptable only when it contains real, labeled actions.
- Workspace row: textual Split / Code / Tree view choices, current validity and payload size. Preserve explicit view choice through resize; keep the existing wide/narrow initial defaults.
- Shared edit-history strip directly above the panes: icon-only Undo and Redo, with tooltips that include shortcuts. History remains shared across both editors.
- Code pane header: labeled Format and Minify adjacent to the source, plus a font selector. Tree pane header: labeled Search fields; selected-field controls appear with a selected path, icon-only Copy path and labeled Copy subtree. Keep controls near the object they operate on; do not duplicate commands in the global header.
- Panes occupy the available viewport height on wide screens rather than a fixed 65vh island; retain the accessible resize divider, limits, and narrow stacked Split behavior. Source and Tree remain independently recognizable even when the tree is unavailable. A compact bottom status area explains validity, processing, local-only/privacy, errors, and export cautions in readable text.

## Icon and typography rules

- Use a small consistent set of bundled/inlined SVG icons for familiar actions (Undo, Redo, Copy JSON, Download, Copy path). Keep Open JSON, Paste, Format, Minify, Search fields, Copy subtree, font choices, and view choices labeled. Do not replace ambiguous actions or error messages with icons alone.
- Every icon-only action is a real button with an accessible name, at least a 40 × 40 CSS-pixel interactive area on desktop and 44 × 44 on narrow/touch layouts, visible hover and keyboard-focus states, and a tooltip on hover and focus. Tooltips supplement, never replace, labels/diagnostics; disabled actions remain understandable. Avoid remote icon fonts or network assets.
- Ship a small selection of locally bundled developer-friendly monospaced fonts with redistribution licenses included in the repository, plus a system monospace option. The dropdown changes only editor typography (Code and Tree where supported), not JSON content or history. Font choice is memory-only, like the current view preference; never fetch fonts from a CDN. Verify license and available font weights before selecting exact files during implementation; if redistribution cannot be verified, omit that font rather than shipping it unlicensed.
- Preserve legibility in light and dark system themes; text and interactive controls need visible contrast and focus indication. Do not rely on color alone for invalidity, selection, or unavailable state.

## Tree disclosure accessibility

The third-party tree editor owns expand/collapse behavior. Enlarge its actual disclosure **button** hit target, not merely the arrow glyph: target 40 × 40 CSS pixels on desktop and 44 × 44 on narrow/touch layouts, with a visible focused state and meaningful accessible expanded/collapsed labeling. The arrow can remain visually small inside the button. Keep the field text/row for selection and editing; do not toggle the entire row, which would conflict with editing. Preserve indentation without overlapping adjacent text or controls. Validate the actual rendered DOM and keyboard Enter/Space behavior. If supported styling cannot safely enlarge targets without breaking the tree, stop and revisit the approach rather than reimplementing the tree just for this redesign.

## Interaction and safety

Reuse the existing document coordinator and editor callbacks. Rearranging controls must not reset document source, undo/redo, selection where representable, or dirty status. Formatting/minifying remain explicit revision-gated transactions. Invalid or duplicate-key drafts stay exact in Code and do not expose a misleading editable Tree. Open/Paste/Clear confirmations, cancellation, raw-source copy/download, subtree guards, and error preservation keep their current behavior. Do not introduce accounts, uploads, telemetry, persistence, remote fonts/scripts, or new CSS frameworks. Use existing Svelte component styling and the smallest practical icon treatment; avoid React-only styled-components and an additional styling dependency for a one-screen redesign.

## Verification and boundaries

The user explicitly requested **no E2E test runs** for this redesign. Use `npm run check`, `npm test`, `npm run build`, and formatting verification where applicable; inspect the running UI with the existing Chrome DevTools browser session at wide and narrow widths, light and dark preference where possible, keyboard focus/tooltip behavior, pointer hit geometry for tree disclosures, and console/network activity. Report which accessibility checks were actually performed and which remain unverified; do not describe a Chrome-only manual inspection as cross-browser proof. Browser checks should cover opening/pasting a sample, formatting, tree selection/copy, layout changes, Undo/Redo, and invalid-draft messaging without uploading payload data.

This UI work does not erase the prior release blocker: the documented 1 MB broad-array fixture exceeded the current inspection guardrail, and large-payload verification remains a separate follow-up. Do not claim release-ready based on visual polish alone. Existing uncommitted Prettier changes are separate user work and must be preserved, not swept into a redesign commit.
