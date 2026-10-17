<script lang="ts">
  import { JSONEditor, Mode, isTextContent } from 'svelte-jsoneditor'
  import { parse, stringify } from 'lossless-json'
  import type { Content, OnChangeStatus } from 'svelte-jsoneditor'

  export let onSource: (text: string) => void
  const parser = { parse, stringify }
  let code: Content = { text: '{}' }
  let tree: Content = { text: '{}' }
  let unavailable = false
  let lastPatch = ''

  function sourceChanged(content: Content) {
    code = content
    const text = isTextContent(content) ? content.text : stringify(content.json)!
    onSource(text)
    try {
      // lossless-json rejects syntax errors and decoded-equivalent duplicate keys.
      // Do not send either kind of draft to the auto-repairing tree.
      parse(text)
      tree = { text }
      unavailable = false
    } catch {
      unavailable = true
    }
  }

  function treeChanged(content: Content, _previous: Content, status: OnChangeStatus) {
    // Diagnostic attempt: the documented parser/content integration, not a fidelity claim.
    const text = isTextContent(content) ? content.text : stringify(content.json, null, 2)!
    tree = content
    code = { text }
    onSource(text)
    lastPatch = JSON.stringify(status.patchResult?.redo ?? null)
  }
</script>

<div class="panes">
  <section aria-label="Source pane">
    <h2>Source</h2>
    <JSONEditor content={code} mode={Mode.text} {parser} mainMenuBar={false} askToFormat={false}
      onChange={sourceChanged} />
  </section>
  <section aria-label="Tree pane">
    <h2>Tree</h2>
    {#if unavailable}<p role="status">Tree unavailable: invalid or duplicate-key source</p>{/if}
    <div hidden={unavailable}>
      <JSONEditor content={tree} mode={Mode.tree} {parser} mainMenuBar={false}
        readOnly={unavailable} onRenderContextMenu={() => false} onChange={treeChanged} />
    </div>
  </section>
</div>
<pre data-testid="patch">{lastPatch}</pre>

<style>
  .panes { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  section { min-width: 0; height: 65vh; display: flex; flex-direction: column; }
</style>
