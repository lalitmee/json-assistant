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
  let split = 50
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
      onCopyPath(stringifyJSONPath(parsePath(path)))
    }
  }

  export function parsePath(path: string) { return parseJSONPath(path) }

  function openSearch() {
    treeEditor.focus()
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
  }

  function removedPaths(operations: JSONPatchDocument): string[][] {
    return operations.filter(operation => operation.op === 'remove').map(operation =>
      operation.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~')))
  }

  function resizeDivider(event: PointerEvent) {
    if (event.buttons !== 1) return
    const bounds = event.currentTarget instanceof HTMLElement ? event.currentTarget.parentElement!.getBoundingClientRect() : null
    if (bounds) split = Math.max(25, Math.min(75, ((event.clientX - bounds.left) / bounds.width) * 100))
  }

  function dividerKey(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      split = Math.max(25, Math.min(75, split + (event.key === 'ArrowRight' ? 5 : -5)))
    } else if (event.key === 'Home') { event.preventDefault(); split = 25 }
    else if (event.key === 'End') { event.preventDefault(); split = 75 }
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

<div class="panes" data-view={view} style={`--split: ${split}%`}>
  {#if view === 'split'}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
    <div class="divider" role="separator" aria-label="Resize panes" aria-orientation="vertical"
      aria-valuenow={Math.round(split)} aria-valuemin="25" aria-valuemax="75" tabindex="0"
      onkeydown={dividerKey} onpointerdown={event => event.currentTarget.setPointerCapture(event.pointerId)}
      onpointermove={resizeDivider}></div>
  {/if}
  <section aria-label="Source pane" hidden={view === 'tree'}>
    <h2>Source</h2>
    <JSONEditor bind:this={codeEditor} content={code} selection={state.selection.code} mode={Mode.text} {parser}
      mainMenuBar={false} askToFormat={false} onChange={sourceChanged} onSelect={value => selected('code', value)}
      onRenderContextMenu={contextMenu} />
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <section aria-label="Tree pane" tabindex="0" hidden={view === 'code'}>
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
