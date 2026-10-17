<script lang="ts">
  import { onMount } from 'svelte'
  import EditorPanes from './lib/EditorPanes.svelte'
  import type { JSONPatchDocument } from 'immutable-json-patch'
import { acceptAnalysis, acceptCompletion, commit, createDocument, redo, undo, type Selection, type View } from './lib/document'
import { createProcessor } from './lib/processing'
import type { ProcessRequest } from './lib/process'

  let document = createDocument()
  let view: View = 'split'
  let panes: InstanceType<typeof EditorPanes>
  let processor: ReturnType<typeof createProcessor>
  function edit(snapshot: { source: string; selection: Selection }) { document = commit(document, snapshot) }
  function select(selection: Selection) { document = { ...document, selection } }
  function history(direction: 'undo' | 'redo') { document = direction === 'undo' ? undo(document) : redo(document) }
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
      (window as any).__editorGatePatch = (operations: JSONPatchDocument) => panes.applyPatch(operations)
      ;(window as any).__editorGateProcess = async (operation: ProcessRequest['operation']) => {
        const request = { revision: document.revision, source: document.source, operation }
        const result = await processor.run(request)
        document = acceptAnalysis(document, result.analysis)
        if (result.source !== undefined) document = acceptCompletion(document, { revision: request.revision, source: result.source })
        return result
      }
    }
    return () => { processor.dispose(); window.removeEventListener('keydown', shortcut, true) }
  })
</script>

<h1>Editor compatibility gate</h1>
<button onclick={() => history('undo')}>Undo</button>
<button onclick={() => history('redo')}>Redo</button>
<button onclick={() => view = 'split'}>Split</button>
<button onclick={() => view = 'code'}>Code</button>
<button onclick={() => view = 'tree'}>Tree</button>
<EditorPanes bind:this={panes} state={document} {view} onEdit={edit} onSelection={select} onHistory={history} />
<pre data-testid="source">{document.source}</pre>
<output data-testid="revision" hidden>{document.revision}</output>
