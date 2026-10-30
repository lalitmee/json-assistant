<script lang="ts">
  let dialog: HTMLDialogElement;
  export function open() {
    dialog.showModal();
  }
  export function close() {
    if (dialog.open) dialog.close();
  }

  const groups = [
    {
      title: "Global",
      scope: "Anywhere in the app. Ctrl means Cmd on macOS unless noted.",
      rows: [
        ["Find in focused pane (Code outside editors)", "Ctrl + F"],
        ["Undo document change", "Ctrl + Z"],
        ["Redo document change", "Ctrl + Shift + Z"],
      ],
    },
    {
      title: "Search",
      scope: "While either search panel is focused.",
      rows: [
        ["Find and replace (in either editor)", "Ctrl + H"],
        ["Next match", "Enter"],
        ["Previous match", "Shift + Enter"],
        ["Previous / next submitted query", "↑ / ↓"],
        ["Close search and focus its editor", "Esc"],
      ],
    },
    {
      title: "Code",
      scope:
        "While the Code editor is focused. Shift extends navigation selections.",
      rows: [
        ["Copy / cut / paste", "Ctrl + C / X / V"],
        ["Select all", "Ctrl + A"],
        ["Indent / unindent", "Tab / Shift + Tab"],
        ["Format / compact JSON", "Ctrl + I"],
        ["Fold code", "Ctrl + Shift + [ · macOS: Cmd + Option + ["],
        ["Unfold code", "Ctrl + Shift + ] · macOS: Cmd + Option + ]"],
        ["Fold / unfold all", "Ctrl + Alt + [ / ]"],
        [
          "Next / previous match",
          "F3 / Shift + F3 · macOS: Cmd + G / Cmd + Shift + G",
        ],
        ["Select next occurrence", "Ctrl + D"],
        ["Select all matching selections", "Ctrl + Shift + L"],
        ["Go to line", "Ctrl + Alt + G"],
        ["Move cursor / extend selection", "Arrow keys / Shift + Arrow keys"],
        ["Move by word", "Ctrl + ← / → · macOS: Option + ← / →"],
        ["Line start / end", "Home / End · macOS: Cmd + ← / →"],
        ["Document start / end", "Ctrl + Home / End · macOS: Cmd + ↑ / ↓"],
        ["Page up / down", "PageUp / PageDown"],
        ["Page up / down on macOS", "Ctrl + ↑ / ↓ (literal Ctrl)"],
        ["Move line up / down", "Alt + ↑ / ↓"],
        ["Copy line up / down", "Alt + Shift + ↑ / ↓"],
        ["Delete line", "Ctrl + Shift + K"],
        ["Insert blank line", "Ctrl + Enter"],
        ["Select line", "Alt + L · macOS: Ctrl + L"],
        ["Move by syntax", "Alt + ← / → · macOS: Ctrl + ← / →"],
        ["Add cursor above / below", "Ctrl + Alt + ↑ / ↓"],
        ["Indent / unindent selection", "Ctrl + ] / ["],
        ["Auto-indent selection", "Ctrl + Alt + \\"],
        ["Jump to matching bracket", "Ctrl + Shift + \\"],
        ["Toggle line comment", "Ctrl + /"],
        ["Toggle block comment", "Alt + Shift + A · macOS: Ctrl + Shift + A"],
        ["Toggle Tab focus mode", "Ctrl + M · macOS: Shift + Option + M"],
        ["Simplify selection", "Esc"],
        ["Delete before / after cursor", "Backspace / Delete"],
        [
          "Delete word before / after cursor",
          "Ctrl + Backspace / Delete · macOS: Option + Backspace / Delete",
        ],
        ["Delete to line start / end on macOS", "Cmd + Backspace / Delete"],
        ["Start completion", "Ctrl + Space (literal Ctrl on macOS)"],
        ["Choose completion", "↑ / ↓ / PageUp / PageDown"],
        ["Accept / close completion", "Enter / Esc"],
        ["Open diagnostics", "Ctrl + Shift + M"],
        ["Next diagnostic", "F8"],
      ],
    },
    {
      title: "macOS Code alternatives",
      scope:
        "Literal Control key, not Cmd. Shift extends supported cursor movements. Global Ctrl+F opens search instead of moving right.",
      rows: [
        ["Move left / up / down", "Ctrl + B / P / N"],
        ["Line start / end", "Ctrl + A / E"],
        ["Delete forward / backward", "Ctrl + D / H"],
        ["Delete to line end", "Ctrl + K"],
        ["Delete previous word", "Ctrl + Option + H"],
        ["Split line", "Ctrl + O"],
        ["Transpose characters", "Ctrl + T"],
        ["Page down", "Ctrl + V"],
      ],
    },
    {
      title: "Tree",
      scope:
        "While a tree field is selected; text-editing fields use standard editing keys.",
      rows: [
        ["Navigate fields", "Arrow keys"],
        ["Extend selection", "Shift + Arrow keys"],
        ["Edit value / expand container", "Enter"],
        ["Replace selection", "Type a character"],
        ["Insert field", "Insert"],
        ["Remove selection", "Delete / Backspace"],
        ["Duplicate selection", "Ctrl + D"],
        ["Select all", "Ctrl + A"],
        ["Copy / cut formatted JSON", "Ctrl + C / X"],
        ["Copy / cut compact JSON", "Ctrl + Shift + C / X"],
        ["Paste JSON", "Ctrl + V"],
        ["Context menu", "Ctrl + Q"],
        ["Find and replace fields", "Ctrl + H"],
        ["Clear selection / cancel edit", "Esc"],
        ["Open selected URL", "Ctrl + Enter"],
      ],
    },
    {
      title: "Workspace controls",
      scope: "Focus the corresponding control first.",
      rows: [
        ["Next / previous control", "Tab / Shift + Tab"],
        ["Activate button", "Enter / Space"],
        ["Resize panes", "← / →"],
        ["Minimum / maximum pane size", "Home / End"],
        ["Change segmented option", "← / → / Home / End"],
        ["Navigate dropdown", "↑ / ↓ / Home / End"],
        ["Choose dropdown option", "Enter / Space"],
        ["Close dropdown or this help", "Esc"],
      ],
    },
  ];
</script>

<dialog bind:this={dialog} aria-labelledby="shortcuts-title">
  <header>
    <h2 id="shortcuts-title">Keyboard shortcuts</h2>
    <button
      class="icon-button"
      aria-label="Close keyboard shortcuts"
      title="Close keyboard shortcuts"
      onclick={close}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><path
          d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        /></svg
      ></button
    >
  </header>
  <div class="shortcuts-body">
    {#each groups as group}
      <section aria-label={group.title}>
        <h3>{group.title}</h3>
        <p>{group.scope}</p>
        <dl>
          {#each group.rows as [action, keys]}
            <div>
              <dt>{action}</dt>
              <dd><kbd>{keys}</kbd></dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
</dialog>

<style>
  dialog {
    width: min(720px, calc(100vw - 32px));
    max-height: 80vh;
    overflow: hidden;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--editor-foreground);
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  .shortcuts-body {
    min-height: 0;
    overflow: auto;
    padding: 0 24px 24px;
    scrollbar-color: var(--editor-selection) var(--editor-panel);
  }
  .shortcuts-body::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }
  .shortcuts-body::-webkit-scrollbar-thumb {
    border: 2px solid var(--editor-panel);
    border-radius: 8px;
    background: var(--editor-selection);
  }
  .shortcuts-body::-webkit-scrollbar-thumb:hover {
    background: var(--editor-key);
  }
  .shortcuts-body::-webkit-scrollbar-track {
    background: var(--editor-panel);
  }
  dialog::backdrop {
    background: #0008;
  }
  header {
    flex-shrink: 0;
    padding: 24px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  h2 {
    margin: 0;
  }
  section {
    margin-top: 24px;
  }
  h3 {
    margin-bottom: 6px;
  }
  p {
    color: var(--muted);
    font-size: 13px;
  }
  dl {
    margin: 0;
  }
  dl > div {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  dd {
    margin: 0;
    text-align: right;
  }
  kbd {
    display: inline-block;
    padding: 3px 7px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    background: var(--surface-raised, var(--surface));
  }
</style>
