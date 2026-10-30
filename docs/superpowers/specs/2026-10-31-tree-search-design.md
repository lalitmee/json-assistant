# Shared Tree search and replace

## Scope

Reuse the Code search panel for Tree search with the same Material icons,
inline options, counts, navigation, session-scoped submitted-query history,
draft restoration, preserve-case option, and accessible controls. Keep
unavailable actions visible but disabled. Do not change unrelated workspace work.

## Architecture

Keep CodeMirror search in its existing controller. Add a Tree controller
implementing the existing SearchController contract. Make the shared panel's
accessible region label configurable instead of hardcoding “Search in source”.
Mount the Tree panel in the Tree pane; do not manipulate the library's native
SearchBox or depend on private search APIs. Use public selection, expansion,
and scrolling methods to reveal the active result. Custom inline match
highlighting is out of scope; the selected key or value identifies the result.

## Matching and navigation

Search decoded object keys and primitive values, including collapsed fields,
in document order (key before its value). Do not search JSON punctuation or
container summaries. Represent primitive values using their JSON lexical text,
except strings, which use decoded text. Count individual text occurrences,
including multiple occurrences within one field. Navigation wraps in both
directions and reveals/selects the active field without moving focus out of
the search input. Array indices are not searchable keys.

Support case-sensitive, whole-word, and regular-expression matching with the
same semantics as Code search. Preserve regex replacement capture syntax and
lowercase, uppercase, and title-case replacement behavior. Reuse existing
matching/replacement logic where possible rather than maintaining divergent
rules. Invalid regexes are displayed as errors and cannot trigger replacement.

Recompute results after document revisions. Invalidate pending scans and stale
replacements on revision or query changes; publish counting state before any
intermediate zero count. Batch traversal so large trees do not monopolize the
main thread. Disable replacement while processing or counting, and disable
Tree search when the document is invalid or Tree is unavailable.

## Replacement safety

Keys and string values remain strings. For numbers, booleans, and null,
replace within their lexical text, then parse and require the same original
primitive type and a valid finite number where applicable. Reject invalid
results instead of coercing types. Replacement of containers is out of scope.

Replace One changes the active occurrence. Replace All computes every result
against one document revision, groups occurrences by field, and validates the
complete resulting document before applying anything. Apply text replacements
from right to left within each field. Reject duplicate final keys within an
object, including collisions between renamed and unchanged keys. Reject
unsupported or ambiguous rename batches rather than partially applying them.
Build operations against the original paths, account for ancestor renames,
and order descendant edits before ancestor renames so paths remain valid.

Use own-property-safe traversal and updates, including for keys named
__proto__, constructor, and prototype. Do not mutate the input document.
Show actionable errors and leave the source unchanged on validation failure.

## Document integration and undo

Route each validated replacement batch through the application's explicit
patch/edit flow. Programmatic editor patches do not emit onChange and must
not be assumed to do so. Replace All is one document edit and one shared undo
step. Preserve synchronization between Code and Tree, dirty tracking, and
selection fallback. Replacement undo is enabled only for its matching revision.

Retain the existing Tree serialization behavior: applyTreePatch reparses and
serializes the document with two-space indentation. Original source formatting
preservation is explicitly outside this change and has been approved as such.

## Shortcuts and focus

Ctrl/Cmd+F targets the focused pane. Outside both panes, retain the current
Code default. Ctrl/Cmd+H opens replacement in the targeted pane. Replace the
Tree header's synthetic native-search opening with the shared controller.
Prevent duplicate native Tree search handling. Escape closes the panel and
returns focus to its originating editor. Update shortcut help to describe
pane-aware search. Keep independent panel-session histories for Code and Tree.

## Shortcuts dialog scrollbar fix

The screenshot shows arrow controls at the ends of the dialog scrollbar.
The current dialog itself is the scroll container. Make the rounded dialog
an overflow-clipping shell, keep its header outside the scrolling body, and
move the existing themed scrollbar styles to the inner body. Suppress native
scrollbar arrow buttons where supported. Keep the close button and title
visible throughout scrolling, retain native modal Escape/focus restoration,
and keep the content reachable at narrow viewport sizes.

## Verification

Use unit tests for matching, captures, preserve-case, primitive type checks,
duplicate keys, nested renames, safe property names, and stale revision guards.
Use focused browser tests for revealing collapsed results, pane-specific
shortcuts, focus restoration, Code/Tree synchronization, and shared undo.
Run E2E with four workers. Do not add CSS-, pixel-, or icon-specific tests;
visually inspect the dialog scrollbar fix where browser access is available.

Run the project's check, unit test, build, and focused E2E scripts. Report
existing failures separately; the known JSONPath check failure and full-suite
E2E failures are not implicitly included in this task. Do not commit or push
without separate explicit permission.
