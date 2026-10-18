<script lang="ts">
  import Tooltip from "./Tooltip.svelte";
  import {
    JSONEditor,
    Mode,
    isTextContent,
    stringifyJSONPath,
    parseJSONPath,
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

  export function applyPatch(operations: JSONPatchDocument): string {
    const baseSource = sourceVersion;
    suppressEditorCallback = true;
    try {
      treeEditor.patch(operations);
    } finally {
      suppressEditorCallback = false;
    }
    const next = applyTreePatch(baseSource, operations);
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

  $: if (codeEditor) codeEditor.select(state.selection.code);
  $: if (treeEditor) treeEditor.select(state.selection.tree);

  function sourceChanged(content: Content) {
    code = content;
    const text = isTextContent(content)
      ? content.text
      : stringify(content.json)!;
    sourceVersion = text;
    if (text !== state.source)
      onEdit({
        source: text,
        selection: { ...state.selection, tree: undefined },
      });
    else echoCount++;
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
    treeEditor.focus();
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true }),
    );
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
    aria-label="Source pane"
    aria-busy={processingOperation === "format" ||
      processingOperation === "minify"}
    hidden={view === "tree"}
  >
    <div class="pane-header">
      <h2>Code</h2>
      <div class="pane-actions" data-processing={state.processing}>
        <span class="cancel-slot">
          {#if state.processing}<button
              aria-label="Cancel processing"
              onclick={onCancel}>Cancel</button
            >{:else}<span aria-hidden="true"></span>{/if}
        </span>
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
    aria-busy={processingOperation === "format" ||
      processingOperation === "minify"}
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
              onclick={() => treeEditor.expand([], () => true)}
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
              onclick={() => treeEditor.collapse([], true)}
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
    <div class="tree-editor" hidden={unavailable}>
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
  {#if processingOperation === "format" || processingOperation === "minify"}
    <div
      class="processing-overlay"
      data-testid="processing-overlay"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span class="processing-status">
        <span class="processing-spinner" aria-hidden="true"></span>
        {processingOperation === "format" ? "Formatting" : "Minifying"}
      </span>
    </div>
  {/if}
</div>
<output data-testid="echo-count" hidden>{echoCount}</output>
<output data-testid="tree-selection" hidden
  >{JSON.stringify(state.selection.tree ?? null)}</output
>
