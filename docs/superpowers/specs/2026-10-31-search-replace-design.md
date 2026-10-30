# Compact search and replace

## Intent and approved scope

Replace the dated search UI with an anchored, top-right search panel. Keep the
existing JSON editor, source fidelity, cross-pane synchronization, and document
undo/redo. The user approved the compact design and the expanded custom integration
scope. No AI, structural key/value filters, results sidebar, or editor replacement.

## Interaction

- Find opens from a Code header button or Ctrl/Cmd+F while focus is in the source
  pane. Ctrl/Cmd+H opens it with replacement expanded. Browser shortcuts outside
  the workspace remain untouched.
- The first row contains an expand-replacement button, labeled search input,
  current/total match count, previous/next controls, and close.
- Case-sensitive, whole-word, and regex toggles have accessible names, tooltips,
  and pressed states. Search is literal and case-insensitive by default.
- Replacement starts collapsed; collapsing does not discard either input.
  Its row contains a labeled replacement input, Replace, and Replace all (count).
- Enter advances, Shift+Enter reverses, and Escape closes and restores editor
  focus. Closing retains the query for the next opening.
- Highlight every match, distinguish the active match, and scroll navigation
  targets into view without moving focus away from the search input.
- Show no-match and invalid-regex feedback inline in a polite live region.
  Replacement is disabled for an empty query, invalid regex, no matches, or while
  a document-processing operation is running.
- Replace all is one document-history entry. Announce the replacement count and
  offer Undo only while that replacement is still the latest document revision;
  subsequent edits must not be silently undone by stale feedback.
- On narrow panes the panel wraps within the pane rather than overflowing it.
  Use existing theme tokens, controls, and focus treatment.

## Integration boundary

The source editor is svelte-jsoneditor 3.13.0. Its public component API has no
search-panel or CodeMirror-extension hook. A custom integration therefore needs
one narrowly isolated CodeMirror adapter rather than scattered DOM manipulation.

Use CodeMirror's public EditorView.findFromDOM on the source pane's editor DOM to
obtain the existing view. Use public search state, search commands, and query
effects for matching, navigation, and decorations. Do not access Svelte component
internals, recreate the editor, synthesize clicks on hidden controls, or maintain
a competing matching engine. Keep DOM discovery confined to the adapter, scoped
to the source pane, and clean up listeners/extensions when the view is destroyed.

Declare any imported CodeMirror packages as direct dependencies, using versions
compatible with the editor's installed dependency graph and Yarn lockfile. Verify
that the bundle resolves a single compatible CodeMirror instance. This dependency
configuration is part of the approved integration, not an editor migration.

Before building the panel, verify that attaching search state to the existing
view works and survives editor updates. If that cannot be done reliably, stop and
report the limitation rather than ship a fragile private-API workaround.

The panel replaces the source pane's native search entry points. Existing tree
search remains available and unchanged: structural tree matching is a different
operation and is not silently converted into text search. A split-view source
search is scoped and labeled as source search.

## Source and history

EditorPanes.svelte owns the panel and adapter lifecycle. Search navigation is not
a document edit. Replacement goes through the existing source-change/onEdit path
to App.svelte's commit function, preserving exact source text and producing one
application history entry per action. Never parse and reserialize JSON to replace
text. Invalid JSON remains searchable and editable.

Native search commands must not create a second history authority. Test both
toolbar Undo and keyboard Undo after replacement. Source changes, document loads,
undo/redo, and pane visibility changes recompute search state without retaining
stale match positions. Closing the panel removes its highlights.

Regex mode uses CodeMirror's supported replacement and whole-word semantics.
Test capture substitutions, zero-width matches, Unicode, and empty replacement.
Do not scan the entire document in a Svelte reactive loop on every selection
change; reuse CodeMirror's search machinery. Counts must reflect the full source,
not only the rendered viewport. Large-document counting must yield or be
cancelable, with obsolete results discarded when query or source changes.

## Verification

- Unit tests for adapter query state, invalid regex, navigation wraparound,
  replacement semantics, stale-result cancellation, and revision-bound Undo.
- Existing workspace unit tests cover accessible labels and static hooks, not
  computed CSS or pixel dimensions.
- Browser tests cover opening via header/shortcuts, search focus, navigation,
  replacement, one-step document undo, cross-pane synchronization, and panel
  reopening. Include a match outside the virtualized viewport.
- Run yarn check, yarn test, yarn test:e2e, yarn build, and yarn format:check.
  Report any pre-existing failures separately. No commits or pushes without
  explicit user authorization.
