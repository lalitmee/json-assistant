<script lang="ts">
  import { onMount } from 'svelte'
  import EditorPanes from './lib/EditorPanes.svelte'
  import type { JSONPatchDocument } from 'immutable-json-patch'
  import { acceptAnalysis, acceptCompletion, commit, createDocument, isDirty, redo, undo, type Selection, type View } from './lib/document'
  import { createProcessor } from './lib/processing'
  import type { ProcessRequest, ProcessResult } from './lib/process'

  let document = createDocument()
  let view: View = 'split'
  let panes: InstanceType<typeof EditorPanes>
  let processor: ReturnType<typeof createProcessor>
  let busy = false
  let processId = 0
  let cancelledRevision = -1
  let copied = ''
  function edit(snapshot: { source: string; selection: Selection }) { document = commit(document, snapshot) }
  function select(selection: Selection) { document = { ...document, selection } }
  function history(direction: 'undo' | 'redo') { document = direction === 'undo' ? undo(document) : redo(document) }
  function applyResult(revision: number, result: ProcessResult) {
    document = acceptAnalysis(document, result.analysis)
    if (result.analysis.valid && result.source !== undefined) document = acceptCompletion(document, { revision, source: result.source })
  }
  async function runOperation(operation: ProcessRequest['operation']): Promise<ProcessResult> {
    const id = ++processId
    const request = { revision: document.revision, source: document.source, operation }
    busy = true
    document = { ...document, processing: true }
    try {
      const result = await processor.run(request)
      if (id === processId) applyResult(request.revision, result)
      return result
    } finally {
      if (id === processId) {
        busy = false
        document = { ...document, processing: false }
      }
    }
  }
  async function copyJson() { await navigator.clipboard.writeText(document.source) }
  async function copyPath(path: string) { await navigator.clipboard.writeText(path); copied = path }
  $: if (processor && !document.analysis && !document.processing && cancelledRevision !== document.revision) void runOperation('analyze')
  function shortcut(event: KeyboardEvent) {
    if (event.isComposing) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      history(event.shiftKey ? 'redo' : 'undo')
    }
  }
  onMount(() => {
    processor = createProcessor()
    window.addEventListener('keydown', shortcut, true)
    if (import.meta.env.DEV) {
      ;(window as any).__editorGatePatch = (operations: JSONPatchDocument) => panes.applyPatch(operations);
      (window as any).__editorGateProcess = runOperation
      ;(window as any).__editorGateApplyResult = (result: ProcessResult) => applyResult(result.analysis.revision, result)
      ;(window as any).__editorGateParsePath = (path: string) => panes.parsePath(path)
    }
    return () => { processor.dispose(); window.removeEventListener('keydown', shortcut, true) }
  })
</script>

<h1>JSON workspace</h1>
<button disabled>Open file</button>
<button disabled={!document.analysis?.valid || busy} onclick={() => runOperation('format')}>Format</button>
<button disabled={!document.analysis?.valid || busy} onclick={() => runOperation('minify')}>Minify</button>
<button disabled={!document.past.length} onclick={() => history('undo')}>Undo</button>
<button disabled={!document.future.length} onclick={() => history('redo')}>Redo</button>
<button onclick={copyJson}>Copy JSON</button>
<button disabled>Download</button>
<button disabled={!busy} onclick={() => { processId++; cancelledRevision = document.revision; processor.cancel(); busy = false; document = { ...document, processing: false } }}>Cancel</button>
<button onclick={() => view = 'split'}>Split</button>
<button onclick={() => view = 'code'}>Code</button>
<button onclick={() => view = 'tree'}>Tree</button>
<EditorPanes bind:this={panes} state={document} {view} onEdit={edit} onSelection={select} onHistory={history} onCopyPath={copyPath} />
<section aria-label="Document status">
  <p>{document.processing ? 'Processing' : cancelledRevision === document.revision && !document.analysis ? 'Processing cancelled' : document.analysis ? document.analysis.valid ? 'Valid JSON' : 'Invalid JSON' : 'Processing'} · {document.analysis?.bytes ?? new TextEncoder().encode(document.source).length} UTF-8 bytes · {isDirty(document) ? 'Unsaved changes' : 'Unchanged'}</p>
  {#if document.analysis?.diagnostics[0]}<p data-testid="diagnostic">{document.analysis.diagnostics[0].kind === 'duplicate' ? 'Duplicate key' : 'Invalid JSON'} at {document.analysis.diagnostics[0].line}:{document.analysis.diagnostics[0].column}: {document.analysis.diagnostics[0].message}</p>{/if}
  <p>Local processing only · no recovery · {document.analysis?.valid ? 'edit and inspect' : 'edit only; inspection unavailable'}</p>
  {#if copied}<output>Copied path: {copied}</output>{/if}
</section>
<pre data-testid="source">{document.source}</pre>
<output data-testid="revision" hidden>{document.revision}</output>
