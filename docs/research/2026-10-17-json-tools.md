# Research: JSON viewers, editors, formatters, and validators

Generated: 2026-10-17. Status: initial desk research, not an approved product design.

## Executive summary

[Certain] Established products already combine editing, trees, formatting, repair, queries, and schema validation. JSON Editor Online also advertises offline support and files up to 512 MB. A feature checklist alone does not establish a market gap. [Likely] A focused, trustworthy everyday workflow is a better initial hypothesis than another everything-in-one toolkit. The intended user and their most frequent task remain unconfirmed.

## Scope and evidence quality

- [Certain] Research covered web search, GitHub READMEs, community discussions, and official product documentation. No app was interactively tested and no performance, accessibility, or network audit was performed.
- [Certain] This is a representative shortlist, not a measured ranking of user preference or market share. Search rankings and GitHub stars do not establish user satisfaction.
- [Certain] GitHub API reported 44,496 stars for JSON Crack during this research; its marketing page showed 44,410. These are discovery signals, not comparable product adoption figures.
- [Certain] Community evidence is anecdotal. The detailed HN discussion is from 2023, so it informs workflow questions, not claims about current defects. Recent Reddit search results were mostly product announcements; direct access to one thread returned 403.
- [Certain] Tags: [official] means publisher documentation; [opinion] means an individual account or our recommendation; [debated] means competing preferences. No broad community consensus is established here.

## Competitor findings

### JSON Editor Online and svelte-jsoneditor

- [Certain] [official] Offers text, editable tree, and table modes; formatting, repair, comparison, querying, schema validation, and offline support.
- [Certain] [official] Advertises documents up to 512 MB. Its component separately defaults to warning above 10 MB in text mode. Neither is an independently measured performance guarantee.
- [Certain] [official] The free website documents advertising and tracking. Local documents stay local according to its policy; public cloud documents are accessible to anyone with the document ID. Paid private cloud documents are also offered. Its FAQ contains both general cloud warnings and private-document exceptions, so privacy must be described by operation, not by a blanket label.
- [Certain] [official] The component supports undo/redo, accessible labels, custom parsers including lossless-json, and configurable query languages. These are not unserved features.
- [Likely] [opinion] Opportunity: a deliberately simpler, ad-free workflow with explicit persistence controls. Inferior usability of the existing product has not been demonstrated.
- Sources: [website](https://jsoneditoronline.org), [component README](https://github.com/josdejong/svelte-jsoneditor).

### JSON Crack

- [Certain] [official] Strong graph-oriented visualization; also documents formatting, validation, conversions, queries, schema/type generation, image export, and browser-local processing.
- [Certain] [official] Its README exposes a configurable node limit. An exact current hosted limit was not verified; a search snippet mentioning approximately 300 KB is not adopted as a confirmed limit.
- [Likely] [opinion] Graphs may help explain relationships but may be less efficient than a tree for repetitive field inspection. This is a usability hypothesis, not a tested flaw.
- [Likely] [opinion] Opportunity: make navigation and editing the primary loop, with graphs added only when user evidence supports them.
- Sources: [website](https://jsoncrack.com), [README](https://github.com/AykutSarac/jsoncrack.com).

### JSONLint

- [Certain] [official] Current navigation includes repair, comparison, schema tools, JSONPath, and a tree viewer in addition to validation and formatting. Calling it only a syntax checker would be outdated.
- [Certain] [official] The website says its current engine, @jsonlint/core, reports multiple errors and warnings in one pass. This claim was not independently tested.
- [Likely] [opinion] Opportunity to investigate: whether a continuous editor/inspector workspace saves steps compared with separate utility pages. Navigation alone does not prove that synchronization is missing.
- Source: [website](https://jsonlint.com).

### JSONFormatter.org

- [Certain] [official] Documents tree and graph views, formatting, minification, validation, repair, conversions, local storage, import/export, and online sharing.
- [Certain] [official] Its FAQ says saving online without logging in makes data public. This is a concrete privacy distinction between local formatting and publishing.
- [Likely] [opinion] Opportunity: keep local export clearly separate from any future publish/share feature, and avoid a large utility-directory interface.
- Source: [website](https://jsonformatter.org).

### jq

- [Certain] [official] A command-line processor for filtering and transforming JSON, rather than a point-and-click structured editor.
- [Certain] [opinion] HN participants describe both reliance on jq and friction remembering its query syntax. Others defend its concision; preference is debated.
- [Likely] [opinion] Opportunity: let people navigate and copy a field or subtree without first writing a query. This complements rather than replaces jq.
- Sources: [README](https://github.com/jqlang/jq), [HN discussion](https://news.ycombinator.com/item?id=37567009).

### jless and the fx workflow reference

- [Certain] [official] jless offers collapsible structures, regex search, and Vim-inspired terminal navigation. Its documented focus is viewing, not the requested graphical editing workspace.
- [Certain] [opinion] The fx HN discussion contains specific requests for scroll position, predictable keyboard behavior, discoverable navigation, and clearer examples. These are historical design lessons, not verified current bugs.
- [Likely] [opinion] Opportunity: combine discoverable keyboard navigation with visible controls rather than assuming every user wants terminal conventions.
- Sources: [jless README](https://github.com/PaulJuliusMartinez/jless), [fx discussion](https://news.ycombinator.com/item?id=37567009).

## Best practices

- [Likely] [opinion] Distinguish syntax validation, schema validation, and optional lint warnings. Passing one does not promise that the document meets the other checks.
- [Likely] [opinion] Preserve source text while users edit invalid intermediate JSON; never replace their work with an empty document or an unlabeled stale tree.
- [Likely] [opinion] Require an explicit repair action and preserve undo history. Formatting should not silently become repair or coercion.
- [Certain] [official] svelte-jsoneditor permits custom lossless parsing. Numeric precision is therefore an existing design concern, not a novel feature. Number fidelity and duplicate-key handling need explicit acceptance tests before claiming safe round trips.
- [Likely] [opinion] Publish measured size limits by mode and test broad arrays, deep nesting, long strings, and invalid input. Do not promise unlimited files based on rendering virtualization alone.
- [Likely] [opinion] Verify privacy with network inspection and dependency configuration; local parsing alone does not establish a tracker-free application.
- [Certain] [official] Ajv treats schemas as trusted application code and warns about expensive or deeply nested untrusted schemas. If schema import is added, define size/depth/time limits and remote-reference behavior.

## Trends and patterns

- [Certain] [official] Existing browser tools combine multiple views and processing utilities; multi-view support is not novel.
- [Certain] [official] Browser-local processing is advertised by both JSON Crack and JSON Editor Online; offline support is advertised by the latter.
- [Likely] [opinion] Differentiation is more plausibly in the clarity, safety, and speed of a particular workflow than in adding every format converter.
- [Certain] [official] Reusable editing components already exist. Building a parser, text editor, or editable tree from scratch is not a justified default.

## Candidate gaps to validate

- [Certain] Observed distinction: free-tier ads/tracking in JSON Editor Online; unauthenticated public saves in JSONFormatter.org.
- [Likely] Workflow hypothesis: synchronized source and structured navigation with clear invalid-input behavior could improve daily inspection.
- [Likely] Trust hypothesis: explicit local-only operation, opt-in persistence, and no accidental publish flow could matter for sensitive payloads.
- [Likely] Reliability hypothesis: preserving numbers, warning on duplicate keys, and reversible operations may matter more than diagram polish.
- [Guessing] These hypotheses are underserved for the intended audience. No user interviews or hands-on comparison currently establish that claim.

## Recommendations

- [Likely] [opinion] First establish the audience and recurring task before choosing a stack, view layout, or feature backlog.
- [Likely] [opinion] Candidate first loop: paste/open JSON, inspect, find a field, edit safely, format, copy/download. This is a discussion prompt, not approved scope.
- [Likely] [opinion] Evaluate an existing editor component before implementing bespoke editing infrastructure.
- [Likely] [opinion] Defer AI, accounts, collaboration, conversions, and graph rendering unless the agreed first workflow depends on them. The project name does not imply AI functionality.

## Understanding to confirm

- [Certain] User requested a private GitHub repository and a progressively built JSON tool, beginning with a polished viewer, visualization, formatting, and editing.
- [Certain] User requested research into preferred viewers/linters and their shortcomings before design.
- [Certain] Subsequent brainstorming confirmed developers debugging APIs in a local-only web app, with code/tree views and an existing editor component.
- [Certain] The user prioritized inspection for oversized payloads and approved a Split / Code / Tree selector. Practical performance limits require measurement; future enhancements belong in a separate roadmap.

## Brainstorming checklist

- [x] Classify as architectural and inspect project context: directory was empty before repository creation.
- [x] Complete explicitly requested private-repository setup and verify origin and visibility.
- [x] Conduct initial competitor desk research and record limitations.
- [x] Clarify audience and purpose, one focused question at a time; confirm the brief.
- [x] Offer a visual companion only when a concrete visual decision needs it.
- [x] Present two or three approaches with trade-offs.
- [x] Present design sections and obtain approval.
- [x] Write the specification and roadmap from the approved sections; include them in the design-document commit.
- [x] Self-review the specification for ambiguity, consistency, and scope.
- [x] Obtain user review of the written specification.
- [x] Invoke writing-plans and write the implementation plan.
- [ ] Obtain plan review and an execution-method choice before implementation.

## Artifact and environment notes

- [Certain] Private repository: [lalitmee/json-assistant](https://github.com/lalitmee/json-assistant). No product code or dependencies created.
- [Certain] The current workspace has no discoverable managed Canvas directory in ~/.cursor/projects; no unsupported canvas path was invented. Findings are retained in this Markdown artifact. A separate user-approved brainstorming companion served HTML layout mockups; its local session files are ignored by Git.
- [Certain] Personal ai-brain repository exists, but its required brain/ directory does not. Its current AGENTS.md describes a different layout. Brain logging is pending clarification rather than silently substituting a location.

## Sources

- [JSON Editor Online product, FAQ, news, and privacy statements](https://jsoneditoronline.org)
- [svelte-jsoneditor README and documentation](https://github.com/josdejong/svelte-jsoneditor)
- [JSON Crack product website](https://jsoncrack.com)
- [JSON Crack README](https://github.com/AykutSarac/jsoncrack.com)
- [JSON Crack GitHub metadata](https://api.github.com/repos/AykutSarac/jsoncrack.com)
- [JSONLint current website](https://jsonlint.com)
- [JSONFormatter.org product and FAQ](https://jsonformatter.org)
- [jq README](https://github.com/jqlang/jq)
- [jless README](https://github.com/PaulJuliusMartinez/jless)
- [Awesome JSON discovery index](https://github.com/burningtree/awesome-json)
- [HN: fx terminal JSON viewer, 2023](https://news.ycombinator.com/item?id=37567009)
- [Reddit: local JSON visualizer, search-result context only](https://www.reddit.com/r/dataengineering/comments/1lto3h0/i_built_an_opensource_json_visualizer_that_runs/)
- [Ajv security guidance, retrieved through Context7](https://ajv.js.org/security.html)
- [Ajv strict mode, retrieved through Context7](https://ajv.js.org/strict-mode)
