<script lang="ts">
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
  export let view: View;
  export let onEdit: (snapshot: Snapshot) => void;
  export let onSelection: (selection: Selection) => void;
  export let onHistory: (direction: "undo" | "redo") => void;
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

<div class="panes" data-view={view} style={`--split: ${split}%`}>
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
      onkeydown={dividerKey}
      onpointerdown={(event) =>
        event.currentTarget.setPointerCapture(event.pointerId)}
      onpointermove={resizeDivider}
    ></div>
  {/if}
  <section aria-label="Source pane" hidden={view === "tree"}>
    <div class="pane-header">
      <h2>Code <small>Source</small></h2>
      <div class="pane-actions">
        <button
          disabled={!state.analysis?.valid || state.processing}
          onclick={onFormat}>Format</button
        ><button
          disabled={!state.analysis?.valid || state.processing}
          onclick={onMinify}>Minify</button
        >
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
  <section aria-label="Tree pane" tabindex="0" hidden={view === "code"}>
    <div class="pane-header">
      <h2>Tree <small>Structure</small></h2>
      <div class="pane-actions">
        {#if !unavailable}<button onclick={openSearch}>Search fields</button
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
      ><button
        class="icon-button"
        aria-label="Copy path"
        title="Copy path"
        disabled={!state.selection.tree || unavailable}
        onclick={copySelectedPath}
        ><svg viewBox="0 0 24 24" aria-hidden="true"
          ><rect x="8" y="8" width="11" height="11" rx="2" /><path
            d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
          /></svg
        ></button
      >
      <button
        disabled={!state.selection.tree || unavailable}
        onclick={copySelectedSubtree}>Copy subtree</button
      >
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
</div>
<output data-testid="echo-count" hidden>{echoCount}</output>
<output data-testid="tree-selection" hidden
  >{JSON.stringify(state.selection.tree ?? null)}</output
>
