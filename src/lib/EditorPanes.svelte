<script lang="ts">
  import { JSONEditor, Mode, isTextContent, stringifyJSONPath, parseJSONPath } from 'svelte-jsoneditor'
  import type { Content, JSONEditorSelection, OnChangeStatus } from 'svelte-jsoneditor'
  import type { JSONPatchDocument } from 'immutable-json-patch'
  import { parse, stringify } from 'lossless-json'
  import { applyTreePatch, fallbackSelection, type DocumentState, type Selection, type Snapshot, type View } from './document'

  export let state: DocumentState
  export let view: View
  export let onEdit: (snapshot: Snapshot) => void
  export let onSelection: (selection: Selection) => void
  export let onHistory: (direction: 'undo' | 'redo') => void
  export let onCopyPath: (path: string) => void

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
    const selection = fallbackSelection(state.selection.tree, next, removedPaths(operations))
    onEdit({ source: next, selection: { ...state.selection, tree: selection } })
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
  $: unavailable = state.analysis?.revision !== state.revision || !state.analysis.valid

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
    const selection = fallbackSelection(state.selection.tree, text, removedPaths(status.patchResult.redo))
    const nextSelection = selection === state.selection.tree ? state.selection : { ...state.selection, tree: selection }
    if (text !== state.source) onEdit({ source: text, selection: nextSelection })
    else echoCount++
  }

  function selected(which: 'code' | 'tree', value: JSONEditorSelection | undefined) {
    if (suppressEditorCallback) return
    onSelection({ ...state.selection, [which]: value })
    if (which === 'tree' && view === 'tree' && value && value.type !== 'text' && value.type !== 'multi') {
      void treeEditor.scrollTo(value.path)
    }
  }

  function copySelectedPath() {
    const selection = state.selection.tree
    if (selection && selection.type !== 'text' && selection.type !== 'multi') {
      const path = stringifyJSONPath(selection.path)
      onCopyPath(stringifyJSONPath(parseJSONPath(path)))
    }
  }

  function openSearch() {
    treeEditor.focus()
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
  }

  function removedPaths(operations: JSONPatchDocument): string[][] {
    return operations.filter(operation => operation.op === 'remove').map(operation =>
      operation.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~')))
  }

  function contextMenu(items: any[]) {
    const safeItems = items.filter(item => !/repair|transform|query|schema/i.test(item.text ?? item.title ?? ''))
    return [...safeItems.map(item => item.type === 'button' && item.text?.toLowerCase() === 'undo'
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
    {#if !unavailable}<button onclick={openSearch}>Search</button>{/if}
    <button disabled={!state.selection.tree || unavailable} onclick={copySelectedPath}>Copy path</button>
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
