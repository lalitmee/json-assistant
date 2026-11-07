<script lang="ts">
  import { onMount, tick, flushSync } from "svelte";
  import SearchPanel from "./SearchPanel.svelte";
  import { createTreeSearch } from "./treeSearch";
  import Tooltip from "./Tooltip.svelte";
  import { attachSourceSearch, type SearchController } from "./sourceSearch";
  import {
    JSONEditor,
    Mode,
    isTextContent,
    stringifyJSONPath,
    parseJSONPath,
    createKeySelection,
    createValueSelection,
  } from "svelte-jsoneditor";
  import type {
    Content,
    JSONEditorSelection,
    OnChangeStatus,
  } from "svelte-jsoneditor";
  import type { JSONPatchDocument } from "immutable-json-patch";
  import type { Preferences } from "./preferences";
  import type { ProcessRequest } from "./process";
  import { parse, stringify } from "lossless-json";
  import {
    applyTreePatch,
    fallbackSelection,
    type DocumentState,
    type Selection,
    type Snapshot,
    type View,
  } from "./document";

  export let state: DocumentState;
  export let hasContent: boolean;
  export let view: View;
  export let theme: Preferences["theme"];
  export let processingOperation: ProcessRequest["operation"] | undefined;
  export let font: Preferences["font"];
  export let animatedIndentGuides: boolean;
  export let onEdit: (snapshot: Snapshot) => void;
  export let onSelection: (selection: Selection) => void;
  export let onHistory: (direction: "undo" | "redo") => void;
  export let onCancel: () => void;
  export let onCopyPath: (path: string) => void;
  export let onCopySubtree: (path: Array<string | number>) => void;
  export let onFormat: () => void;
  export let onMinify: () => void;

  const parser = { parse, stringify };
  let split = 50;
  let code: Content = { text: state.source };
  let tree: Content = { text: state.source };
  let sourceVersion = state.source;
  let unavailable = false;
  let echoCount = 0;
  let suppressEditorCallback = false;
  let codeEditor: InstanceType<typeof JSONEditor>;
  let treeEditor: InstanceType<typeof JSONEditor>;
  let sourcePane: HTMLElement;
  let treePane: HTMLElement;
  let treeSearchOpen = false;
  const treeSearch = createTreeSearch({
    source: () => state.source,
    revision: () => state.revision,
    isProcessing: () => state.processing,
    available: () => !unavailable,
    apply: (operations) =>
      flushSync(() => {
        applyPatch(operations);
      }),
    reveal: (match) => {
      treeEditor.expand(match.path.slice(0, -1));
      const selection =
        match.field === "key"
          ? createKeySelection(match.path)
          : createValueSelection(match.path);
      treeEditor.select(selection);
      onSelection({ ...state.selection, tree: selection });
      void treeEditor.scrollTo(match.path).catch(() => {});
    },
    focus: () => treeEditor.focus(),
    undo: () => onHistory("undo"),
    visibility: (open) => {
      treeSearchOpen = open;
      if (open)
        void tick().then(() =>
          treePane
            ?.querySelector<HTMLInputElement>('[main-field="true"]')
            ?.focus(),
        );
    },
  });
  let sourceSearch: SearchController | null = null;
  let observedSearchRevision = state.revision;
  let observedProcessing = state.processing;
  let treeTimer: number | undefined;
  let treeFrame: number | undefined;
  let treeGeneration = 0;

  export function openSourceSearch(replace = false) {
    sourceSearch?.open(replace);
  }
  export function openTreeSearch(replace = false) {
    treeSearch.open(replace);
  }

  onMount(() => {
    let cancelled = false;
    void tick().then(() => {
      if (!cancelled)
        sourceSearch = attachSourceSearch(sourcePane, {
          isProcessing: () => state.processing,
          revision: () => state.revision,
          undo: () => onHistory("undo"),
        });
    });
    return () => {
      cancelled = true;
      treeSearch.destroy();
      sourceSearch?.destroy();
      sourceSearch = null;
    };
  });

  export function applyPatch(operations: JSONPatchDocument): string {
    const baseSource = sourceVersion;
    suppressEditorCallback = true;
    try {
      treeEditor.patch(operations);
    } finally {
      suppressEditorCallback = false;
    }
    const next = applyTreePatch(baseSource, operations);
    if (next !== baseSource) cancelTreeOperation();
    const selection = fallbackSelection(
      state.selection.tree,
      next,
      removedPaths(operations),
    );
    onEdit({
      source: next,
      selection: { ...state.selection, tree: selection },
    });
    return next;
  }

  $: if (state.source !== sourceVersion) {
    cancelTreeOperation();
    sourceVersion = state.source;
    code = { text: state.source };
    tree = { text: state.source };
    try {
      parse(state.source);
      unavailable = false;
    } catch {
      unavailable = true;
    }
    if (codeEditor) codeEditor.update(code);
    if (treeEditor && !unavailable) treeEditor.update(tree);
  }
  $: unavailable =
    state.analysis?.revision !== state.revision || !state.analysis.valid;

  $: if (sourceSearch && state.revision !== observedSearchRevision) {
    observedSearchRevision = state.revision;
    sourceSearch.documentChanged();
    treeSearch.documentChanged();
  }
  $: if (sourceSearch && state.processing !== observedProcessing) {
    observedProcessing = state.processing;
    sourceSearch.sync();
  }
  $: {
    unavailable;
    state.processing;
    treeSearch.sync();
  }

  $: if (codeEditor) codeEditor.select(state.selection.code);
  $: if (treeEditor) treeEditor.select(state.selection.tree);

  function sourceChanged(content: Content) {
    code = content;
    const text = isTextContent(content)
      ? content.text
      : stringify(content.json)!;
    sourceVersion = text;
    if (text !== state.source) {
      cancelTreeOperation();
      onEdit({
        source: text,
        selection: { ...state.selection, tree: undefined },
      });
    } else echoCount++;
    try {
      parse(text);
      tree = { text };
      unavailable = false;
    } catch {
      unavailable = true;
    }
  }

  function treeChanged(
    content: Content,
    _previous: Content,
    status: OnChangeStatus,
  ) {
    if (suppressEditorCallback || !status.patchResult) return;
    const text = applyTreePatch(sourceVersion, status.patchResult.redo);
    if (text !== sourceVersion) cancelTreeOperation();
    tree = content;
    code = { text };
    sourceVersion = text;
    const selection = fallbackSelection(
      state.selection.tree,
      text,
      removedPaths(status.patchResult.redo),
    );
    const nextSelection =
      selection === state.selection.tree
        ? state.selection
        : { ...state.selection, tree: selection };
    if (text !== state.source)
      onEdit({ source: text, selection: nextSelection });
    else echoCount++;
  }

  function selected(
    which: "code" | "tree",
    value: JSONEditorSelection | undefined,
  ) {
    if (suppressEditorCallback) return;
    onSelection({ ...state.selection, [which]: value });
    if (
      which === "tree" &&
      view === "tree" &&
      value &&
      value.type !== "text" &&
      value.type !== "multi"
    ) {
      void treeEditor.scrollTo(value.path);
    }
  }

  function copySelectedPath() {
    const selection = state.selection.tree;
    if (selection && selection.type !== "text" && selection.type !== "multi") {
      const path = stringifyJSONPath(selection.path);
      onCopyPath(stringifyJSONPath(parsePath(path)));
    }
  }

  function copySelectedSubtree() {
    const selection = state.selection.tree;
    if (selection && selection.type !== "text" && selection.type !== "multi")
      onCopySubtree(selection.path);
  }

  export function parsePath(path: string) {
    return parseJSONPath(path);
  }

  function openSearch() {
    treeSearch.open();
  }

  function removedPaths(operations: JSONPatchDocument): string[][] {
    return operations
      .filter((operation) => operation.op === "remove")
      .map((operation) =>
        operation.path
          .slice(1)
          .split("/")
          .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~")),
      );
  }

  function cancelTreeOperation() {
    treeGeneration++;
    if (treeTimer !== undefined) clearTimeout(treeTimer);
    if (treeFrame !== undefined) cancelAnimationFrame(treeFrame);
    treeTimer = undefined;
    treeFrame = undefined;
    treeOperation = undefined;
  }

  let treeOperation: "Expanding" | "Collapsing" | undefined;

  function expandAll() {
    cancelTreeOperation();
    treeOperation = "Expanding";
    const generation = treeGeneration;
    const paths: Array<Array<string | number>> = [[]];
    const pending: Array<{
      value: unknown;
      path: Array<string | number>;
    }> = [{ value: parse(state.source), path: [] }];

    for (let index = 0; index < pending.length; index++) {
      const { value, path } = pending[index];
      const children = Array.isArray(value)
        ? value.map((child, childIndex) => [childIndex, child] as const)
        : value !== null && typeof value === "object"
          ? Object.entries(value)
          : [];
      for (const [key, child] of children) {
        const childPath = [...path, key];
        const expandable = child !== null && typeof child === "object";
        if (Array.isArray(value) || expandable) paths.push(childPath);
        if (expandable) pending.push({ value: child, path: childPath });
      }
    }

    let index = 0;
    const expandBatch = () => {
      if (generation !== treeGeneration) return;
      const deadline = performance.now() + 8;
      do {
        treeEditor.expand(
          paths[index] as any,
          (relativePath) => relativePath.length === 0,
        );
        index++;
      } while (index < paths.length && performance.now() < deadline);
      treeTimer =
        index < paths.length
          ? window.setTimeout(expandBatch, 0)
          : window.setTimeout(() => {
              if (generation === treeGeneration) treeOperation = undefined;
              treeTimer = undefined;
            }, 150);
    };
    treeTimer = window.setTimeout(expandBatch, 0);
  }

  function collapseAll() {
    cancelTreeOperation();
    treeOperation = "Collapsing";
    const generation = treeGeneration;
    treeFrame = requestAnimationFrame(() => {
      if (generation !== treeGeneration) return;
      treeEditor.collapse([], true);
      treeFrame = undefined;
      treeTimer = window.setTimeout(() => {
        if (generation === treeGeneration) treeOperation = undefined;
        treeTimer = undefined;
      }, 150);
    });
  }

  function resizeDivider(event: PointerEvent) {
    if (event.buttons !== 1) return;
    const bounds =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget.parentElement!.getBoundingClientRect()
        : null;
    if (bounds)
      split = Math.max(
        25,
        Math.min(75, ((event.clientX - bounds.left) / bounds.width) * 100),
      );
  }

  function dividerKey(event: KeyboardEvent) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      split = Math.max(
        25,
        Math.min(75, split + (event.key === "ArrowRight" ? 5 : -5)),
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      split = 25;
    } else if (event.key === "End") {
      event.preventDefault();
      split = 75;
    }
  }

  function contextMenu(items: any[]) {
    const safeItems = items.filter(
      (item) =>
        !/repair|transform|query|schema/i.test(item.text ?? item.title ?? ""),
    );
    return [
      ...safeItems.map((item) =>
        item.type === "button" && item.text?.toLowerCase() === "undo"
          ? { ...item, onClick: () => onHistory("undo") }
          : item.type === "button" && item.text?.toLowerCase() === "redo"
            ? { ...item, onClick: () => onHistory("redo") }
            : item,
      ),
      { type: "separator" },
      { type: "button", text: "Undo", onClick: () => onHistory("undo") },
      { type: "button", text: "Redo", onClick: () => onHistory("redo") },
    ];
  }
</script>

<div
  class="panes"
  data-view={view}
  data-theme={theme}
  data-editor-font={font}
  data-animated-indent-guides={animatedIndentGuides}
  style={`--split: ${split}%`}
>
  {#if view === "split"}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
    <div
      class="divider"
      role="separator"
      aria-label="Resize panes"
      aria-orientation="vertical"
      aria-valuenow={Math.round(split)}
      aria-valuemin="25"
      aria-valuemax="75"
      tabindex="0"
      ondblclick={() => (split = 50)}
      onkeydown={dividerKey}
      onpointerdown={(event) =>
        event.currentTarget.setPointerCapture(event.pointerId)}
      onpointermove={resizeDivider}
    ></div>
  {/if}
  <section
    bind:this={sourcePane}
    aria-label="Source pane"
    aria-busy={processingOperation === "format" ||
      processingOperation === "minify"}
    hidden={view === "tree"}
  >
    <div class="pane-header">
      <h2>Code</h2>
      <div class="pane-actions" data-processing={state.processing}>
        <Tooltip label="Undo document change (Ctrl/⌘+Z)" align="end"
          ><button
            class="icon-button"
            aria-label="Undo document change"
            disabled={!state.past.length}
            onclick={() => onHistory("undo")}
            ><svg viewBox="0 -960 960 960" aria-hidden="true"
              ><path
                d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z"
              /></svg
            ></button
          ></Tooltip
        >
        <Tooltip label="Redo document change (Ctrl/⌘+Shift+Z)" align="end"
          ><button
            class="icon-button"
            aria-label="Redo document change"
            disabled={!state.future.length}
            onclick={() => onHistory("redo")}
            ><svg viewBox="0 -960 960 960" aria-hidden="true"
              ><path
                d="M396-200q-97 0-166.5-63T160-420q0-94 69.5-157T396-640h252L544-744l56-56 200 200-200 200-56-56 104-104H396q-63 0-109.5 40T240-420q0 60 46.5 100T396-280h284v80H396Z"
              /></svg
            ></button
          ></Tooltip
        >
        {#if hasContent}<button
            class="format-action"
            disabled={state.processing}
            onclick={onFormat}>Format</button
          ><button
            class="minify-action"
            disabled={!state.analysis?.valid || state.processing}
            onclick={onMinify}>Minify</button
          >{/if}
      </div>
    </div>
    <JSONEditor
      bind:this={codeEditor}
      content={code}
      selection={state.selection.code}
      mode={Mode.text}
      {parser}
      mainMenuBar={false}
      askToFormat={false}
      onChange={sourceChanged}
      onSelect={(value) => selected("code", value)}
      onRenderContextMenu={contextMenu}
    />
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <section
    aria-label="Tree pane"
    bind:this={treePane}
    aria-busy={processingOperation === "format" ||
      processingOperation === "minify" ||
      treeOperation !== undefined}
    tabindex="0"
    hidden={view === "code"}
  >
    <div class="pane-header">
      <h2>Tree</h2>
      <div class="pane-actions">
        {#if hasContent && !unavailable}
          <Tooltip label="Expand all" align="end"
            ><button
              class="icon-button"
              aria-label="Expand all"
              disabled={processingOperation !== undefined}
              onclick={expandAll}
              ><svg viewBox="0 -960 960 960" aria-hidden="true"
                ><path
                  d="M480-80 240-320l57-57 183 183 183-183 57 57L480-80ZM298-584l-58-56 240-240 240 240-58 56-182-182-182 182Z"
                /></svg
              ></button
            ></Tooltip
          ><Tooltip label="Collapse all" align="end"
            ><button
              class="icon-button"
              aria-label="Collapse all"
              disabled={processingOperation !== undefined}
              onclick={collapseAll}
              ><svg viewBox="0 -960 960 960" aria-hidden="true"
                ><path
                  d="m296-80-56-56 240-240 240 240-56 56-184-184L296-80Zm184-504L240-824l56-56 184 184 184-184 56 56-240 240Z"
                /></svg
              ></button
            ></Tooltip
          >
        {/if}
        {#if hasContent && !unavailable}<Tooltip
            label="Search fields"
            align="end"
            ><button
              class="icon-button"
              aria-label="Search fields"
              onclick={openSearch}
              ><svg viewBox="0 0 24 24" aria-hidden="true"
                ><path
                  d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                /></svg
              ></button
            ></Tooltip
          >{/if}
      </div>
    </div>
    {#if unavailable}<p role="status">
        Tree unavailable: invalid or duplicate-key source
      </p>{/if}
    <div class="selection-actions">
      <span
        >{state.selection.tree &&
        state.selection.tree.type !== "text" &&
        state.selection.tree.type !== "multi"
          ? stringifyJSONPath(state.selection.tree.path)
          : "Select a field to copy its path"}</span
      >{#if hasContent && !unavailable && state.selection.tree && state.selection.tree.type !== "text" && state.selection.tree.type !== "multi"}<Tooltip
          label="Copy path"
          align="end"
          ><button
            class="icon-button"
            aria-label="Copy path"
            onclick={copySelectedPath}
            ><svg viewBox="0 0 24 24" aria-hidden="true"
              ><path
                d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
              /></svg
            ></button
          ></Tooltip
        >
        <Tooltip label="Copy subtree" align="end"
          ><button
            class="icon-button"
            aria-label="Copy subtree"
            onclick={copySelectedSubtree}
            ><svg viewBox="0 0 24 24" aria-hidden="true"
              ><path
                d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm-1 4 6 6v10c0 1.1-.9 2-2 2H7.99C6.89 23 6 22.1 6 21l.01-14c0-1.1.89-2 1.99-2h7zm-1 7h5.5L14 6.5V12z"
              /></svg
            ></button
          ></Tooltip
        >{/if}
    </div>
    <div class="tree-editor" hidden={unavailable} style="position: relative">
      {#if treeSearchOpen}<SearchPanel
          controller={treeSearch}
          scope="tree"
        />{/if}
      <JSONEditor
        bind:this={treeEditor}
        content={tree}
        selection={state.selection.tree}
        mode={Mode.tree}
        {parser}
        mainMenuBar={false}
        readOnly={unavailable}
        onRenderContextMenu={contextMenu}
        onChange={treeChanged}
        onSelect={(value) => selected("tree", value)}
      />
    </div>
  </section>
  {#if processingOperation === "format" || processingOperation === "minify" || treeOperation !== undefined}
    <div class="processing-overlay" data-testid="processing-overlay">
      <div
        class="processing-card"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span class="processing-spinner" aria-hidden="true"></span>
        <span
          >{processingOperation === "format"
            ? "Formatting"
            : processingOperation === "minify"
              ? "Minifying"
              : treeOperation}</span
        >
        <button
          class="processing-cancel"
          onclick={() =>
            treeOperation !== undefined ? cancelTreeOperation() : onCancel()}
          >Cancel</button
        >
      </div>
    </div>
  {/if}
</div>
<output data-testid="echo-count" hidden>{echoCount}</output>
<output data-testid="tree-selection" hidden
  >{JSON.stringify(state.selection.tree ?? null)}</output
>
