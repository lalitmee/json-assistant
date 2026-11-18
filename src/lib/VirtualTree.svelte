<script lang="ts">
  import { onMount, tick } from "svelte";
  import { copyText } from "./io";
  import {
    treePageSize,
    type TreePage,
    type TreeRequest,
    type TreeResponse,
    type TreeRow,
  } from "./virtualTree";

  export let source: string;

  const rowHeight = 32;
  const overscan = 6;
  let worker: Worker | undefined;
  let root: TreeRow | undefined;
  let pages = new Map<number, TreePage>();
  let requested = new Map<number, number>();
  let viewport: HTMLDivElement;
  let searchInput: HTMLInputElement;
  let scrollTop = 0;
  let height = 0;
  let query = "";
  let searching = false;
  let selected: TreeRow | undefined;
  let status = "Preparing tree…";

  type VisibleRow = { row: TreeRow; depth: number; controls?: TreePage };

  function flatten(root: TreeRow | undefined, pages: Map<number, TreePage>) {
    const rows: VisibleRow[] = [];
    if (!root) return rows;
    function append(row: TreeRow, depth: number) {
      rows.push({ row, depth });
      const page = pages.get(row.offset);
      if (!page) return;
      if (row.count > treePageSize)
        rows.push({ row, depth: depth + 1, controls: page });
      for (const child of page.rows) append(child, depth + 1);
    }
    append(root, 0);
    return rows;
  }

  $: rows = flatten(root, pages);
  $: start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  $: end = Math.ceil((scrollTop + height) / rowHeight) + overscan;

  function send(request: TreeRequest) {
    worker?.postMessage(request);
  }

  function loadPage(parent: number, start: number) {
    requested.set(parent, start);
    send({ kind: "page", parent, start });
  }

  function discardBranch(parent: number) {
    requested.delete(parent);
    const page = pages.get(parent);
    pages.delete(parent);
    for (const child of page?.rows ?? []) discardBranch(child.offset);
  }

  function toggle(row: TreeRow) {
    if (pages.has(row.offset)) {
      discardBranch(row.offset);
      pages = new Map(pages);
    } else loadPage(row.offset, 0);
  }

  export function focusSearch() {
    searchInput?.focus();
  }

  async function receive(result: TreeResponse) {
    if (result.kind === "root") {
      root = result.root;
      status = "";
      if (root.count) loadPage(root.offset, 0);
    } else if (result.kind === "page") {
      if (requested.get(result.page.parent) !== result.page.start) return;
      discardBranch(result.page.parent);
      pages = new Map(pages).set(result.page.parent, result.page);
    } else if (result.kind === "match") {
      searching = false;
      requested.clear();
      pages = new Map(result.pages.map((page) => [page.parent, page]));
      const revealed = flatten(root, pages);
      const match = revealed.findIndex(
        ({ row, controls }) => !controls && row.offset === result.offset,
      );
      selected = revealed[match]?.row;
      status = "Match selected";
      await tick();
      if (viewport && match >= 0)
        viewport.scrollTop = Math.max(0, match * rowHeight - height / 2);
    } else if (result.kind === "end") {
      searching = false;
      status = "No further matches";
    } else {
      searching = false;
      status = "Unable to prepare the tree";
    }
  }

  onMount(() => {
    try {
      worker = new Worker(new URL("./virtualTree.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = ({ data }: MessageEvent<TreeResponse>) =>
        void receive(data);
      worker.onerror = () => void receive({ kind: "error" });
      send({ kind: "load", source });
    } catch {
      void receive({ kind: "error" });
    }
    return () => {
      worker?.terminate();
      worker = undefined;
    };
  });

  async function copySelection() {
    if (!selected) return;
    try {
      await copyText(
        source.slice(selected.offset, selected.offset + selected.length),
      );
      status = "Copied subtree";
    } catch (error) {
      status = (error as Error).message;
    }
  }
</script>

<div class="virtual-tree">
  <form
    role="search"
    aria-label="Search large tree"
    onsubmit={(event) => {
      event.preventDefault();
      if (!root || !query || searching) return;
      searching = true;
      status = "Searching…";
      send({ kind: "find", query });
    }}
  >
    <input
      type="search"
      aria-label="Find in tree"
      placeholder="Find in tree"
      bind:this={searchInput}
      bind:value={query}
      readonly={searching}
    />
    <button disabled={!root || !query || searching}>Find next</button>
    <button type="button" disabled={!selected} onclick={copySelection}
      >Copy subtree</button
    >
  </form>
  <span role="status">{status}</span>
  <div
    class="viewport"
    aria-label="JSON tree rows"
    bind:this={viewport}
    bind:clientHeight={height}
    onscroll={() => (scrollTop = viewport.scrollTop)}
  >
    <div style:height={`${rows.length * rowHeight}px`}>
      <div style:transform={`translateY(${start * rowHeight}px)`}>
        {#each rows.slice(start, end) as { row, depth, controls } (`${row.offset}:${!!controls}`)}
          <div
            class="row"
            class:matched={!controls && selected?.offset === row.offset}
            style:height={`${rowHeight}px`}
            style:padding-inline-start={`${depth * 16}px`}
          >
            {#if controls}
              <button
                disabled={controls.start === 0}
                onclick={() =>
                  loadPage(row.offset, controls.start - treePageSize)}
                >Previous</button
              >
              <span
                >{controls.start + 1}–{controls.start + controls.rows.length} of {row.count}</span
              >
              <button
                disabled={controls.start + controls.rows.length >= row.count}
                onclick={() =>
                  loadPage(row.offset, controls.start + treePageSize)}
                >Next</button
              >
            {:else}
              {#if row.count}
                <button
                  class="disclosure"
                  aria-label={`${pages.has(row.offset) ? "Collapse" : "Expand"} ${row.label}`}
                  aria-expanded={pages.has(row.offset)}
                  onclick={() => toggle(row)}
                  >{pages.has(row.offset) ? "▾" : "▸"}</button
                >
              {:else}
                <span class="disclosure"></span>
              {/if}
              <button
                class="value"
                aria-pressed={selected?.offset === row.offset}
                onclick={() => (selected = row)}
                >{row.label} <span>{row.preview}</span></button
              >
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .virtual-tree {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  }
  form,
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  form {
    flex-wrap: wrap;
    padding: 6px;
  }
  input {
    min-width: 8rem;
    flex: 1;
  }
  [role="status"]:not(:empty) {
    padding: 4px 8px;
  }
  .viewport {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .row {
    white-space: nowrap;
    font-family: monospace;
    box-sizing: border-box;
  }
  .disclosure {
    flex: 0 0 2rem;
    min-width: 2rem;
  }
  .value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: start;
  }
  .value span {
    opacity: 0.8;
  }
  .matched .value {
    outline: 1px solid currentColor;
    outline-offset: -1px;
  }
</style>
