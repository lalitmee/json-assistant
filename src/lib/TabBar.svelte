<script lang="ts">
  import { isDirty } from "./document";
  import type { TabState } from "./tabs";
  import Tooltip from "./Tooltip.svelte";

  export let tabs: TabState[];
  export let activeTabId: string;
  export let onSelectTab: (tabId: string) => void;
  export let onAddTab: () => void;
  export let onCloseTab: (tabId: string) => void;
  export let onRenameTab: (tabId: string, name: string) => void;
  export let zenMode = false;
  export let onToggleZen: (() => void) | undefined = undefined;

  let editingTabId: string | null = null;
  let editingName = "";
  let renameInput: HTMLInputElement | null = null;
  let tablistElement: HTMLDivElement;

  function startRename(tab: TabState) {
    editingTabId = tab.id;
    editingName = tab.name;
    setTimeout(() => renameInput?.select(), 0);
  }

  function commitRename() {
    if (editingTabId) {
      onRenameTab(editingTabId, editingName);
      editingTabId = null;
    }
  }

  function cancelRename() {
    editingTabId = null;
  }

  function handleKeyDown(event: KeyboardEvent, tabIndex: number) {
    if (editingTabId) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = (tabIndex + 1) % tabs.length;
      onSelectTab(tabs[nextIndex].id);
      focusTab(tabs[nextIndex].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prevIndex = (tabIndex - 1 + tabs.length) % tabs.length;
      onSelectTab(tabs[prevIndex].id);
      focusTab(tabs[prevIndex].id);
    } else if (event.key === "Home") {
      event.preventDefault();
      onSelectTab(tabs[0].id);
      focusTab(tabs[0].id);
    } else if (event.key === "End") {
      event.preventDefault();
      const lastIndex = tabs.length - 1;
      onSelectTab(tabs[lastIndex].id);
      focusTab(tabs[lastIndex].id);
    } else if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault();
      startRename(tabs[tabIndex]);
    }
  }

  function focusTab(tabId: string) {
    setTimeout(() => {
      const el = tablistElement?.querySelector<HTMLElement>(
        `[data-tab-id="${tabId}"]`,
      );
      el?.focus();
    }, 0);
  }

  function handleClose(event: MouseEvent, tab: TabState) {
    event.stopPropagation();
    if (
      isDirty(tab.document) &&
      !window.confirm(
        `Document "${tab.name}" has unsaved changes. Close anyway?`,
      )
    ) {
      return;
    }
    onCloseTab(tab.id);
  }
</script>

<div
  bind:this={tablistElement}
  class="tab-bar"
  role="tablist"
  aria-label="JSON Documents"
>
  <div class="tabs-scroll">
    {#each tabs as tab, index (tab.id)}
      {@const isActive = tab.id === activeTabId}
      {@const dirty = isDirty(tab.document)}
      {@const invalid = tab.document.analysis && !tab.document.analysis.valid}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="tab-item"
        data-tab-id={tab.id}
        data-active={isActive}
        role="tab"
        id={`tab-${tab.id}`}
        aria-selected={isActive}
        aria-controls="workspace-editor-panes"
        tabindex={isActive ? 0 : -1}
        onclick={() => {
          if (editingTabId !== tab.id) {
            onSelectTab(tab.id);
          }
        }}
        ondblclick={() => startRename(tab)}
        onkeydown={(event) => handleKeyDown(event, index)}
      >
        {#if editingTabId === tab.id}
          <input
            bind:this={renameInput}
            class="tab-rename-input"
            type="text"
            bind:value={editingName}
            onblur={commitRename}
            onkeydown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              else if (e.key === "Escape") cancelRename();
            }}
          />
        {:else}
          <span
            class="tab-name"
            title={`${tab.name} (Double-click or press Enter/F2 to rename)`}
            >{tab.name}</span
          >
          <button
            type="button"
            class="tab-rename-btn"
            aria-label={`Rename ${tab.name}`}
            tabindex={isActive ? 0 : -1}
            onclick={(e) => {
              e.stopPropagation();
              startRename(tab);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
              />
            </svg>
          </button>
        {/if}

        {#if dirty}
          <span
            class="tab-indicator dirty-dot"
            title="Unsaved changes"
            aria-label="Unsaved changes">●</span
          >
        {/if}

        {#if invalid}
          <span
            class="tab-indicator invalid-icon"
            title="Invalid JSON"
            aria-label="Invalid JSON">▲</span
          >
        {/if}

        <button
          type="button"
          class="tab-close"
          aria-label={`Close ${tab.name}`}
          tabindex={isActive ? 0 : -1}
          onclick={(e) => handleClose(e, tab)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>
    {/each}

    <Tooltip label="New document" align="center" placement="top">
      <button
        type="button"
        class="tab-add"
        aria-label="New document"
        onclick={onAddTab}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </button>
    </Tooltip>
  </div>

  {#if zenMode && onToggleZen}
    <div class="tab-bar-actions">
      <Tooltip label="Exit fullscreen (Esc)" align="end" placement="top">
        <button
          type="button"
          class="tab-action-btn"
          aria-label="Exit fullscreen"
          onclick={onToggleZen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
            />
          </svg>
        </button>
      </Tooltip>
    </div>
  {/if}
</div>
