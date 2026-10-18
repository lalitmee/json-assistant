# Unified Color Themes

## Intent and scope

Replace the independent application-palette and Code/Tree-editor-theme choices with one color-theme choice that colors the full workspace consistently. Keep the existing System / Dark / Light mode control for now; mode selects each theme's official light or dark variant. Fix the 12px strip above the workspace header shown in the supplied screenshot. This is a presentation/settings change and must not affect JSON source, editor state, history, or processing.

## Theme selection and appearance

- Provide one **Color theme** setting with these families: **Cobalt2**, **Tokyo Night**, **Catppuccin**, **Rose Pine**, **Solarized**, **VS Code Dark+**, and **GitHub**. Remove Ocean, Graphite, Forest, Midnight, Orchid, and Paper as selectable themes.
- A selected family applies to application chrome and both Code and Tree views. Remove the separate application-palette and Code/Tree-theme controls and their independent preference values.
- Preserve **System / Dark / Light** mode. System follows `prefers-color-scheme` live; Dark and Light override it. For paired upstream palettes use Tokyo Night / Tokyo Day, Catppuccin Mocha / Latte, Rose Pine / Rose Pine Dawn, Solarized Dark / Solarized Light, VS Code Dark+ / Light+, and GitHub Dark / GitHub Light.
- Use each named theme's original palette values; do not recolor or blend palettes to fit JSON Assistant. Record the authoritative upstream source and palette variant for each family during implementation. Cobalt2 uses its original palette unchanged for both mode values.
- Define shared theme tokens so shell surfaces, controls, status/diagnostic states, focus, CodeMirror syntax, Tree values, selection, and editor panels stay coherent under the same selection. Use the existing Svelte/CSS and `svelte-jsoneditor` CSS-variable integration; add no theme or styling dependency.
- Preserve readable text, visible keyboard focus, selected/invalid state distinction, and reduced-motion behavior for every mode/theme pairing.

## Preference storage and migration

- Replace `palette` and `editorTheme` with one validated `theme` preference. Keep `appearance`, `font`, and explicitly chosen `view`; never persist document content or editor state.
- Migrate the existing version-1 preference record: preserve valid appearance, font, and explicit view. Since legacy palette/editor choices may conflict and most legacy choices are being removed, set the unified theme to Cobalt2. Persist the new shape/version only after the user changes a preference; malformed or unavailable storage must still fall back safely.
- Keep Settings navigation and editor instances/state unchanged. Theme selection must not increment document revision, affect JSON bytes, or disturb undo/redo.

## Workspace header gap

- The screenshot's highlighted strip is 12px. Live layout inspection found `.workspace` begins at `y=0` while its header begins at `y=12`; the current workspace top padding and negative header margin do not place the sticky flex header at the page edge. The Settings page has no corresponding top padding.
- Adjust workspace top spacing so the workspace header begins at the top edge on desktop and mobile while preserving horizontal gutters, the intended header height, pane sizing, and Settings layout. Do not mask the gap with a visual overlay or alter the editor's content spacing.

## Verification and boundaries

- Cover preference validation/migration/defaults, the single theme selector, shared theme application to app and Code/Tree, and the workspace header top edge with focused tests.
- Run `yarn test`, `yarn check`, `yarn build`, formatting verification, and `git diff --check`. Inspect the running UI at wide and narrow widths, each theme in System/Dark/Light, and both Code and Tree. Do not run E2E tests; report browser checks actually performed.
- Theme-source inspection must verify exact official color values and variant names before implementation. Keep upstream attribution/provenance in the implementation notes. This does not establish performance or release readiness; the existing large-payload release blocker remains separate.
