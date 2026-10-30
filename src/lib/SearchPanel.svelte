<script lang="ts">
  import { onMount } from "svelte";
  import type { SearchController, SearchSnapshot } from "./sourceSearch";

  let {
    controller,
    scope = "source",
  }: { controller: SearchController; scope?: "source" | "tree" } = $props();
  let history: string[] = [];
  let historyIndex = -1;
  let historyDraft = "";
  let state: SearchSnapshot = $state({
    options: {
      search: "",
      replace: "",
      caseSensitive: false,
      wholeWord: false,
      regexp: false,
      preserveCase: false,
    },
    expanded: false,
    counting: false,
    current: 0,
    total: 0,
    error: undefined,
    feedback: "",
    canUndoReplacement: false,
    processing: false,
  });

  onMount(() => controller.subscribe((next) => (state = next)));

  function configure(event: Event, key: "search" | "replace") {
    const target = event.currentTarget as HTMLInputElement;
    controller.configure({ ...state.options, [key]: target.value });
  }

  function toggle(
    key: "caseSensitive" | "wholeWord" | "regexp" | "preserveCase",
  ) {
    controller.configure({ ...state.options, [key]: !state.options[key] });
  }

  function markMainField(node: HTMLInputElement) {
    node.setAttribute("main-field", "true");
    if (scope === "tree") queueMicrotask(() => node.focus());
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      controller.close();
    }
  }

  function navigateHistory(event: KeyboardEvent) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (!history.length) return;
    event.preventDefault();

    if (historyIndex === -1) {
      if (event.key === "ArrowDown") return;
      historyDraft = state.options.search;
      historyIndex = history.length;
    }

    const nextIndex = historyIndex + (event.key === "ArrowUp" ? -1 : 1);
    if (nextIndex < 0 || nextIndex > history.length) return;
    historyIndex = nextIndex;
    controller.configure({
      ...state.options,
      search:
        historyIndex === history.length ? historyDraft : history[historyIndex],
    });
  }

  function submitSearch() {
    const search = state.options.search;
    if (search)
      history = [...history.filter((query) => query !== search), search];
    historyIndex = -1;
  }
</script>

<div class="search-panel" role="search" aria-label={`Search in ${scope}`}>
  <div class="search-row">
    <button
      class="search-toggle"
      type="button"
      aria-label="Toggle replacement"
      aria-expanded={state.expanded}
      title="Toggle replacement"
      onclick={() => controller.expand(!state.expanded)}
      ><svg viewBox="0 0 16 16" aria-hidden="true"
        ><path
          d={state.expanded
            ? "m3.15 5.65.7-.7L8 9.1l4.15-4.15.7.7-4.5 4.5h-.7z"
            : "m5.65 3.15-.7.7L9.1 8l-4.15 4.15.7.7 4.5-4.5v-.7z"}
        /></svg
      ></button
    >
    <div class="input-field find-field">
      <input
        class="search-input"
        type="search"
        aria-label={`Find in ${scope}`}
        placeholder="Find"
        use:markMainField
        value={state.options.search}
        oninput={(event) => configure(event, "search")}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitSearch();
            controller.next(event.shiftKey);
          }
          navigateHistory(event);
          closeOnEscape(event);
        }}
      />
      <button
        class="search-option"
        type="button"
        title="Match case"
        aria-label="Case sensitive"
        aria-pressed={state.options.caseSensitive}
        onclick={() => toggle("caseSensitive")}
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path
            d="M4 3h1l3 10H7l-.9-3H2.9L2 13H1L4 3zm-.8 6h2.6L4.5 4.7 3.2 9zm8.3-3c1.7 0 2.5.9 2.5 2.5V13h-1v-.6c-.5.4-1.2.6-2 .6-1.3 0-2-.8-2-2s.9-2 2.5-2H13v-.5c0-1-.5-1.5-1.5-1.5-.6 0-1.2.2-1.7.5l-.5-.8c.7-.5 1.4-.7 2.2-.7zM13 10h-1.5c-1 0-1.5.3-1.5 1s.4 1 1 1c.8 0 1.5-.3 2-.8V10z"
          /></svg
        ></button
      >
      <button
        class="search-option"
        type="button"
        title="Match whole word"
        aria-label="Whole word"
        aria-pressed={state.options.wholeWord}
        onclick={() => toggle("wholeWord")}
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path
            d="M0 12h1v2h14v-2h1v3H0v-3zm4.5-7C6.2 5 7 5.9 7 7.5V12H6v-.6c-.5.4-1.2.6-2 .6-1.3 0-2-.8-2-2s.9-2 2.5-2H6v-.5C6 6.5 5.5 6 4.5 6c-.6 0-1.2.2-1.7.5l-.5-.8c.7-.5 1.4-.7 2.2-.7zM6 9H4.5c-1 0-1.5.3-1.5 1s.4 1 1 1c.8 0 1.5-.3 2-.8V9zm3-7h1v4c.4-.6 1-.9 1.7-.9 1.5 0 2.3 1.4 2.3 3.4S13.2 12 11.7 12c-.7 0-1.3-.3-1.7-.9v.9H9V2zm2.5 4C10.5 6 10 7 10 8.5s.5 2.5 1.5 2.5S13 10 13 8.5 12.5 6 11.5 6z"
          /></svg
        ></button
      >
      <button
        class="search-option"
        type="button"
        title="Use regular expression"
        aria-label="Regular expression"
        aria-pressed={state.options.regexp}
        onclick={() => toggle("regexp")}
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path
            d="M8 2h1v2.3l1.6-1.6.7.7L9.7 5H12v1H9.7l1.6 1.6-.7.7L9 6.7V9H8V6.7L6.4 8.3l-.7-.7L7.3 6H5V5h2.3L5.7 3.4l.7-.7L8 4.3V2zM5 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"
          /></svg
        ></button
      >
    </div>
    {#if state.options.search}
      <span class="match-count" aria-live="polite" aria-atomic="true">
        {state.counting
          ? "Searching…"
          : state.total
            ? `${state.current || 1} of ${state.total}`
            : "0 matches"}
      </span>
    {/if}
    <button
      type="button"
      aria-label="Previous match"
      title="Previous match (Shift+Enter)"
      disabled={state.counting || !state.total || !!state.error}
      onclick={() => controller.next(true)}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="m7 14 5-5 5 5-1.4 1.4L12 11.8l-3.6 3.6z" /></svg
      ></button
    >
    <button
      type="button"
      aria-label="Next match"
      title="Next match (Enter)"
      disabled={state.counting || !state.total || !!state.error}
      onclick={() => controller.next()}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="m7 10 5 5 5-5-1.4-1.4L12 12.2l-3.6-3.6z" /></svg
      ></button
    >
    <button
      type="button"
      aria-label="Close search"
      title="Close search"
      onclick={() => controller.close()}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><path
          d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        /></svg
      ></button
    >
  </div>
  {#if state.expanded}
    <div class="replace-row">
      <div class="input-field replace-field">
        <input
          class="search-input"
          aria-label="Replace with"
          placeholder="Replace"
          value={state.options.replace}
          oninput={(event) => configure(event, "replace")}
          onkeydown={closeOnEscape}
        />
        <button
          class="preserve-case"
          type="button"
          aria-label="Preserve case"
          title="Preserve case"
          aria-pressed={state.options.preserveCase}
          onclick={() => toggle("preserveCase")}>AB</button
        >
      </div>
      <button
        type="button"
        aria-label="Replace"
        title="Replace"
        disabled={state.processing ||
          state.counting ||
          !state.total ||
          !!state.error}
        onclick={() => controller.replace()}
        ><svg viewBox="0 0 24 24" aria-hidden="true"
          ><path
            d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM8 9h3v1H8z"
          /></svg
        ></button
      >
      <button
        type="button"
        aria-label={`Replace all (${state.total})`}
        title="Replace all"
        disabled={state.processing ||
          state.counting ||
          !state.total ||
          !!state.error}
        onclick={() => controller.replace(true)}
        ><svg viewBox="0 0 24 24" aria-hidden="true"
          ><path
            d="M17 3a2 2 0 0 1 2 2v2h-2V5H5v14h12v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4.3 5.3 1.4 1.4-7.8 7.8-4.3-4.3 1.4-1.4 2.9 2.9z"
          /></svg
        ></button
      >
    </div>
  {/if}
  {#if state.options.search && state.error}
    <div class="search-status">
      <span role="status">{state.error}</span>
    </div>
  {/if}
  {#if state.feedback}
    <div class="search-feedback" role="status">
      {state.feedback}
      {#if state.canUndoReplacement}<button
          type="button"
          aria-label="Undo replacement"
          title="Undo replacement"
          onclick={() => controller.undoReplacement()}
          ><svg viewBox="0 0 24 24" aria-hidden="true"
            ><path
              d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.6-3.6c1.4-1.2 3.2-1.9 5.1-1.9 3.2 0 5.9 2.1 6.8 5l2.1-.7C20.2 10.8 16.7 8 12.5 8z"
            /></svg
          ></button
        >{/if}
    </div>
  {/if}
</div>

<style>
  .search-panel {
    position: absolute;
    z-index: 5;
    inset: 8px 12px auto auto;
    max-width: calc(100% - 24px);
    width: 520px;
    box-sizing: border-box;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--editor-foreground);
    box-shadow: 0 12px 32px #0004;
    backdrop-filter: blur(12px);
  }
  .search-row,
  .replace-row,
  .search-status,
  .search-feedback {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: nowrap;
  }
  .replace-row,
  .search-status,
  .search-feedback {
    margin-top: 8px;
  }
  .search-status {
    box-sizing: border-box;
    min-height: 24px;
    flex-wrap: nowrap;
  }
  .search-status [role="status"] {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .search-input {
    box-sizing: border-box;
    width: 100%;
    height: 28px;
    min-width: 0;
    flex: 1;
    padding: 3px 6px;
    border: 0;
    border-radius: 0;
    color: var(--editor-foreground);
    background: transparent;
  }
  .input-field {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    padding-right: 2px;
    border: 1px solid var(--border);
    background: var(--editor-background);
  }
  .input-field:focus-within {
    border-color: var(--accent);
  }
  .search-input::-webkit-search-cancel-button {
    appearance: none;
  }
  .replace-row {
    padding-left: 28px;
    padding-right: 28px;
  }
  .search-input::placeholder {
    color: var(--muted);
  }
  .search-input:focus-visible {
    outline: none;
  }
  .match-count {
    flex: 0 0 auto;
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .search-panel button {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    min-height: 24px;
    padding: 3px;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--editor-foreground);
    background: transparent;
    font: inherit;
    cursor: pointer;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
  }
  .search-panel button:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--hover);
  }
  .search-panel button:disabled {
    color: var(--muted);
    opacity: 0.55;
    cursor: default;
  }
  .search-panel button svg {
    display: block;
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  .search-row > button {
    min-width: 24px;
    padding-inline: 3px;
  }
  .search-row > button[aria-label="Close search"] {
    color: var(--muted);
  }
  .search-option {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 24px;
    color: var(--muted);
    font-size: 12px;
  }
  .preserve-case {
    min-width: 24px;
    padding-inline: 2px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
  }
  .search-row {
    flex-wrap: nowrap;
    gap: 4px;
  }
  .search-row .search-option {
    min-width: 0;
    padding-inline: 3px;
    white-space: nowrap;
  }
  .search-panel button[aria-pressed="true"] {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  }
  .search-panel button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .search-feedback {
    color: var(--muted);
    font-size: 12px;
  }
  .search-feedback button {
    min-height: 28px;
    padding-block: 2px;
    color: var(--accent);
  }
</style>
