<script lang="ts">
  import { JSONEditor, Mode, isTextContent } from 'svelte-jsoneditor'
  import type { Content, JSONEditorSelection, OnChangeStatus } from 'svelte-jsoneditor'
  import type { JSONPatchDocument } from 'immutable-json-patch'
  import { parse, stringify } from 'lossless-json'
  import { applyTreePatch, deletedSelection, type DocumentState, type Selection, type Snapshot, type View } from './document'

  export let state: DocumentState
  export let view: View
  export let onEdit: (snapshot: Snapshot) => void
  export let onSelection: (selection: Selection) => void
  export let onHistory: (direction: 'undo' | 'redo') => void

  const parser = { parse, stringify }
  let code: Content = { text: state.source }
  let tree: Content = { text: state.source }
  let sourceVersion = state.source
  let unavailable = false
  let echoCount = 0
  let suppressEditorCallback = false
  let codeEditor: InstanceType<typeof JSONEditor>
  let treeEditor: InstanceType<typeof JSONEditor>

  export function applyPatch(operations: JSONPatchDocument): string {
    const baseSource = sourceVersion
    suppressEditorCallback = true
    try { treeEditor.patch(operations) } finally { suppressEditorCallback = false }
    const next = applyTreePatch(baseSource, operations)
    onEdit({ source: next, selection: state.selection })
    return next
  }

  $: if (state.source !== sourceVersion) {
    sourceVersion = state.source
    code = { text: state.source }
    tree = { text: state.source }
    try { parse(state.source); unavailable = false } catch { unavailable = true }
    if (codeEditor) codeEditor.update(code)
    if (treeEditor && !unavailable) treeEditor.update(tree)
  }

  $: if (codeEditor) codeEditor.select(state.selection.code)
  $: if (treeEditor) treeEditor.select(state.selection.tree)

  function sourceChanged(content: Content) {
    code = content
    const text = isTextContent(content) ? content.text : stringify(content.json)!
    sourceVersion = text
    if (text !== state.source) onEdit({ source: text, selection: state.selection })
    else echoCount++
    try { parse(text); tree = { text }; unavailable = false } catch { unavailable = true }
  }

  function treeChanged(content: Content, _previous: Content, status: OnChangeStatus) {
    if (suppressEditorCallback || !status.patchResult) return
    const text = applyTreePatch(sourceVersion, status.patchResult.redo)
    tree = content
    code = { text }
    sourceVersion = text
    const selection = state.selection.tree
    if (selection && selection.type !== 'text' && selection.type !== 'multi') {
      try {
        let value: any = parse(text)
        for (const key of selection.path) value = value?.[key]
        const selectedPath = JSON.stringify(selection.path)
        const removed = status.patchResult.redo.some(operation => operation.op === 'remove' &&
          JSON.stringify(operation.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))) === selectedPath)
        if (removed || value === undefined) {
          const fallback = deletedSelection(selection)
          if (fallback) onSelection({ ...state.selection, tree: fallback })
        }
      } catch { /* invalid tree edits are rejected by the editor */ }
    }
    if (text !== state.source) onEdit({ source: text, selection: state.selection })
    else echoCount++
  }

  function selected(which: 'code' | 'tree', value: JSONEditorSelection | undefined) {
    onSelection({ ...state.selection, [which]: value })
    if (which === 'tree' && view === 'tree' && value && value.type !== 'text' && value.type !== 'multi') {
      void treeEditor.scrollTo(value.path)
    }
  }

  function contextMenu(items: any[]) {
    return [...items.map(item => item.type === 'button' && item.text?.toLowerCase() === 'undo'
      ? { ...item, onClick: () => onHistory('undo') }
      : item.type === 'button' && item.text?.toLowerCase() === 'redo'
        ? { ...item, onClick: () => onHistory('redo') }
        : item),
    { type: 'separator' },
    { type: 'button', text: 'Undo', onClick: () => onHistory('undo') },
    { type: 'button', text: 'Redo', onClick: () => onHistory('redo') }]
  }
</script>

<div class="panes" data-view={view}>
  <section aria-label="Source pane" hidden={view === 'tree'}>
    <h2>Source</h2>
    <JSONEditor bind:this={codeEditor} content={code} selection={state.selection.code} mode={Mode.text} {parser}
      mainMenuBar={false} askToFormat={false} onChange={sourceChanged} onSelect={value => selected('code', value)}
      onRenderContextMenu={contextMenu} />
  </section>
  <section aria-label="Tree pane" hidden={view === 'code'}>
    <h2>Tree</h2>
    {#if unavailable}<p role="status">Tree unavailable: invalid or duplicate-key source</p>{/if}
    <div hidden={unavailable}>
      <JSONEditor bind:this={treeEditor} content={tree} selection={state.selection.tree} mode={Mode.tree} {parser}
        mainMenuBar={false} readOnly={unavailable} onRenderContextMenu={contextMenu} onChange={treeChanged}
        onSelect={value => selected('tree', value)} />
    </div>
  </section>
</div>
<output data-testid="echo-count" hidden>{echoCount}</output>
<output data-testid="tree-selection" hidden>{JSON.stringify(state.selection.tree ?? null)}</output>

<style>
  .panes { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  section { min-width: 0; height: 65vh; display: flex; flex-direction: column; }
</style>
