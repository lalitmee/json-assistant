<script lang="ts">
  import EditorPanes from './lib/EditorPanes.svelte'

  let source = '{}'
</script>

<h1>Editor compatibility gate — UNREADY</h1>
<p>Diagnostic harness only. Not a usable JSON workspace.</p>
<button>Undo</button>
<button>Redo</button>
<EditorPanes onSource={(text) => source = text} />
<pre data-testid="source">{source}</pre>
