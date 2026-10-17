<script lang="ts">
  import { onMount, tick } from "svelte";
  import EditorPanes from "./lib/EditorPanes.svelte";
  import type { JSONPatchDocument } from "immutable-json-patch";
  import {
    acceptAnalysis,
    acceptCompletion,
    commit,
    createDocument,
    isDirty,
    redo,
    undo,
    type Selection,
    type View,
  } from "./lib/document";
  import { createProcessor } from "./lib/processing";
  import { copyText, downloadText, readFile, subtreeSource } from "./lib/io";
  import type { ProcessRequest, ProcessResult } from "./lib/process";
  import {
    defaultPreferences,
    loadPreferences,
    resolveView,
    savePreferences,
    type Preferences,
  } from "./lib/preferences";

  let document = createDocument();
  let view: View = "split";
  let viewChosen = false;
  let preferences: Preferences = { ...defaultPreferences };
  let page: "workspace" | "settings" = "workspace";
  let settingsTrigger: HTMLButtonElement;
  let settingsHeading: HTMLHeadingElement;
  function changePreference(next: Partial<Preferences>) {
    preferences = { ...preferences, ...next };
    if (next.view) view = next.view;
    try {
      savePreferences(window.localStorage, preferences);
    } catch {
      /* storage blocked */
    }
  }
  async function showSettings() {
    page = "settings";
    await tick();
    settingsHeading.focus();
  }
  async function showWorkspace() {
    page = "workspace";
    await tick();
    settingsTrigger.focus();
  }
  let panes: InstanceType<typeof EditorPanes>;
  let processor: ReturnType<typeof createProcessor>;
  let busy = false;
  let processId = 0;
  let cancelledRevision = -1;
  let copied = "";
  let ioError = "";
  let fileInput: HTMLInputElement;
  let loadId = 0;
  let loadController: AbortController | undefined;
  let beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | undefined;
  let beforeUnloadListening = false;
  function syncBeforeUnload() {
    if (!beforeUnloadHandler) return;
    if (isDirty(document) && !beforeUnloadListening) {
      window.addEventListener("beforeunload", beforeUnloadHandler);
      beforeUnloadListening = true;
    } else if (!isDirty(document) && beforeUnloadListening) {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      beforeUnloadListening = false;
    }
  }
  $: if (document && beforeUnloadHandler) syncBeforeUnload();
  function edit(snapshot: { source: string; selection: Selection }) {
    document = commit(document, snapshot);
  }
  function select(selection: Selection) {
    document = { ...document, selection };
  }
  function history(direction: "undo" | "redo") {
    document = direction === "undo" ? undo(document) : redo(document);
  }
  function applyResult(revision: number, result: ProcessResult) {
    document = acceptAnalysis(document, result.analysis);
    if (result.analysis.valid && result.source !== undefined)
      document = acceptCompletion(document, {
        revision,
        source: result.source,
      });
  }
  async function runOperation(
    operation: ProcessRequest["operation"],
  ): Promise<ProcessResult> {
    const id = ++processId;
    const request = {
      revision: document.revision,
      source: document.source,
      operation,
    };
    busy = true;
    document = { ...document, processing: true };
    try {
      const result = await processor.run(request);
      if (id === processId) applyResult(request.revision, result);
      return result;
    } finally {
      if (id === processId) {
        busy = false;
        document = { ...document, processing: false };
      }
    }
  }
  async function copyJson() {
    try {
      await copyText(document.source);
      ioError = "";
    } catch (error) {
      ioError = (error as Error).message;
    }
  }
  async function copyPath(path: string) {
    try {
      await copyText(path);
      copied = "path";
      ioError = "";
    } catch (error) {
      ioError = (error as Error).message;
    }
  }
  async function copySubtree(path: Array<string | number>) {
    if (
      document.analysis?.revision !== document.revision ||
      !document.analysis.valid
    )
      return;
    const source = subtreeSource(document.source, path);
    if (!source) return;
    try {
      await copyText(source);
      copied = "subtree";
      ioError = "";
    } catch (error) {
      ioError = (error as Error).message;
    }
  }
  async function pasteDocument() {
    const revision = document.revision;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      ioError =
        "Clipboard read failed. Check browser clipboard permissions and try again.";
      return;
    }
    if (
      document.revision !== revision &&
      !window.confirm(
        "The document changed while clipboard access was pending. Replace the current document?",
      )
    )
      return;
    if (
      document.revision === revision &&
      isDirty(document) &&
      !window.confirm("Replace the unsaved document with clipboard contents?")
    )
      return;
    replaceDocument(text);
  }
  function replaceDocument(source: string) {
    loadId++;
    loadController?.abort();
    loadController = undefined;
    processId++;
    processor.cancel();
    busy = false;
    cancelledRevision = -1;
    document = { ...createDocument(source), revision: document.revision + 1 };
    ioError = "";
  }
  async function openFile(file: File) {
    loadController?.abort();
    const controller = new AbortController(),
      id = ++loadId;
    loadController = controller;
    const revision = document.revision;
    try {
      const source = await readFile(file, controller.signal);
      if (id !== loadId) return;
      if (
        document.revision !== revision &&
        !window.confirm(
          "The document changed while the file was opening. Replace the current document?",
        )
      )
        return;
      if (
        document.revision === revision &&
        isDirty(document) &&
        !window.confirm("Replace the unsaved document with this file?")
      )
        return;
      replaceDocument(source);
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        ioError = (error as Error).message;
    } finally {
      if (id === loadId) loadController = undefined;
    }
  }
  function download() {
    const source = document.source;
    if (
      document.analysis &&
      !document.analysis.valid &&
      !window.confirm(
        "Warning: this draft is invalid JSON or contains duplicate keys. Download will preserve its exact raw source. Continue?",
      )
    )
      return;
    try {
      downloadText(source, "document.json");
      document = { ...document, exportedSource: source };
      ioError = "Download initiated.";
    } catch {
      ioError = "Download could not be initiated.";
    }
  }
  $: if (
    processor &&
    !document.analysis &&
    !document.processing &&
    cancelledRevision !== document.revision
  )
    void runOperation("analyze");
  function shortcut(event: KeyboardEvent) {
    if (event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      history(event.shiftKey ? "redo" : "undo");
    }
  }
  function chooseView(next: View) {
    view = next;
    viewChosen = true;
    changePreference({ view: next });
  }
  onMount(() => {
    try {
      preferences = loadPreferences(window.localStorage);
    } catch {
      preferences = { ...defaultPreferences };
    }
    viewChosen = !!preferences.view;
    processor = createProcessor();
    window.addEventListener("keydown", shortcut, true);
    beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    syncBeforeUnload();
    const resize = () => {
      if (!viewChosen) view = resolveView(preferences, window.innerWidth);
    };
    view = resolveView(preferences, window.innerWidth);
    resize();
    window.addEventListener("resize", resize);
    if (import.meta.env.DEV) {
      (window as any).__editorGatePatch = (operations: JSONPatchDocument) =>
        panes.applyPatch(operations);
      (window as any).__editorGateProcess = runOperation;
      (window as any).__editorGateApplyResult = (result: ProcessResult) =>
        applyResult(result.analysis.revision, result);
      (window as any).__editorGateParsePath = (path: string) =>
        panes.parsePath(path);
      (window as any).__benchmarkLoad = (source: string) => {
        replaceDocument(source);
        return runOperation("analyze");
      };
    }
    return () => {
      loadController?.abort();
      processor.dispose();
      window.removeEventListener("keydown", shortcut, true);
      window.removeEventListener("resize", resize);
      if (beforeUnloadHandler)
        window.removeEventListener("beforeunload", beforeUnloadHandler);
    };
  });
</script>

<div
  class="app-shell"
  data-appearance={preferences.appearance}
  data-palette={preferences.palette}
>
  <main class="workspace" hidden={page === "settings"}>
    <header class="workspace-header">
      <div class="identity">
        <span class="brand-mark" aria-hidden="true">{"{ }"}</span>
        <div>
          <h1>JSON workspace</h1>
          <p>Private developer workspace</p>
        </div>
      </div>
      <div class="document-name" title="document.json">
        document.json <span
          >{isDirty(document) ? "● Unsaved" : "· Unchanged"}</span
        >
      </div>
      <span
        class="status-badge"
        data-state={document.analysis?.valid
          ? "valid"
          : document.analysis
            ? "invalid"
            : "pending"}
        >{document.analysis?.valid
          ? "Valid JSON"
          : document.analysis
            ? "Invalid JSON"
            : "Checking"} · {document.analysis?.bytes ??
          new TextEncoder().encode(document.source).length} bytes</span
      >
      <div class="header-actions">
        <button class="primary" onclick={() => fileInput.click()}
          >Open JSON</button
        >
        <input
          bind:this={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onchange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void openFile(file);
            event.currentTarget.value = "";
          }}
        />
        <button onclick={pasteDocument}>Paste</button>
        <button
          class="icon-button"
          aria-label="Copy JSON"
          title="Copy JSON"
          onclick={copyJson}
          ><svg viewBox="0 0 24 24" aria-hidden="true"
            ><rect x="8" y="8" width="11" height="11" rx="2" /><path
              d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
            /></svg
          ></button
        >
        <button
          class="icon-button"
          aria-label="Download"
          title="Download JSON"
          onclick={download}
          ><svg viewBox="0 0 24 24" aria-hidden="true"
            ><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" /></svg
          ></button
        >
        <button
          onclick={() => {
            if (
              isDirty(document) &&
              !window.confirm("Clear the unsaved document?")
            )
              return;
            replaceDocument("");
          }}>Clear</button
        >
        <button
          bind:this={settingsTrigger}
          aria-label="Open settings"
          onclick={showSettings}>Settings</button
        >
      </div>
    </header>
    {#if loadController || busy}<div class="pending-actions">
        {#if loadController}<button
            onclick={() => {
              loadId++;
              loadController?.abort();
              loadController = undefined;
            }}>Cancel file load</button
          >{/if}
        {#if busy}<button
            onclick={() => {
              processId++;
              cancelledRevision = document.revision;
              processor.cancel();
              busy = false;
              document = { ...document, processing: false };
            }}>Cancel</button
          >{/if}
      </div>{/if}
    {#if document.analysis?.mode !== "unavailable"}
      <EditorPanes
        bind:this={panes}
        state={document}
        {view}
        editorTheme={preferences.editorTheme}
        font={preferences.font}
        onEdit={edit}
        onSelection={select}
        onHistory={history}
        onCopyPath={copyPath}
        onCopySubtree={copySubtree}
        onFormat={() => void runOperation("format")}
        onMinify={() => void runOperation("minify")}
      />
    {:else}<p role="status">
        Inspection unavailable: {document.analysis.diagnostics[0]?.message}.
        Source export remains available.
      </p>{/if}
    <section aria-label="Document status">
      <p>
        {document.processing
          ? "Processing"
          : cancelledRevision === document.revision && !document.analysis
            ? "Processing cancelled"
            : document.analysis
              ? document.analysis.valid
                ? "Valid JSON"
                : "Invalid JSON"
              : "Processing"} · {document.analysis?.bytes ??
          new TextEncoder().encode(document.source).length} UTF-8 bytes · {isDirty(
          document,
        )
          ? "Unsaved changes"
          : "Unchanged"}
      </p>
      {#if document.analysis?.diagnostics[0]}<p data-testid="diagnostic">
          {document.analysis.diagnostics[0].kind === "duplicate"
            ? "Duplicate key"
            : "Invalid JSON"} at {document.analysis.diagnostics[0]
            .line}:{document.analysis.diagnostics[0].column}: {document.analysis
            .diagnostics[0].message}
        </p>{/if}
      <p>
        Local processing only · no recovery · {document.analysis?.mode ===
        "unavailable"
          ? "source export only; inspection unavailable"
          : document.analysis?.valid
            ? "edit and inspect"
            : "edit only; inspection unavailable"}
      </p>
      {#if copied}<output>Copied {copied}.</output>{/if}
      {#if ioError}<p role="alert">{ioError}</p>{/if}
      {#if document.analysis?.revision === document.revision && !document.analysis.valid}<p
          role="status"
        >
          Warning: invalid JSON draft; Download exports the exact raw source,
          including invalid content.
        </p>{/if}
    </section>
    <pre data-testid="source">{document.source}</pre>
    <output data-testid="revision" hidden>{document.revision}</output>
  </main>
  <main
    class="settings-page"
    aria-label="Settings"
    hidden={page !== "settings"}
  >
    <header class="settings-header">
      <button
        class="icon-button"
        aria-label="Back to workspace"
        title="Back to workspace"
        onclick={showWorkspace}
        ><svg viewBox="0 0 24 24" aria-hidden="true"
          ><path d="M20 12H4m0 0 7-7m-7 7 7 7" /></svg
        ></button
      >
      <span class="brand-mark" aria-hidden="true">{"{ }"}</span>
    </header>
    <div class="settings-content">
      <h1 bind:this={settingsHeading} tabindex="-1">Settings</h1>
      <p>
        Preferences stay in this browser. Your JSON document is never saved
        automatically.
      </p>
      <section class="settings-card" aria-label="Workspace layout">
        <h2>Workspace view</h2>
        <p>Choose how you work with your document.</p>
        <div class="settings-choices">
          <button
            aria-pressed={view === "split"}
            onclick={() => chooseView("split")}>Split</button
          >
          <button
            aria-pressed={view === "code"}
            onclick={() => chooseView("code")}>Code</button
          >
          <button
            aria-pressed={view === "tree"}
            onclick={() => chooseView("tree")}>Tree</button
          >
        </div>
      </section>
      <section class="settings-card" aria-label="Appearance preferences">
        <h2>Appearance</h2>
        <label
          >Mode <select
            value={preferences.appearance}
            onchange={(e) =>
              changePreference({
                appearance: e.currentTarget.value as Preferences["appearance"],
              })}
          >
            <option value="system">System</option><option value="dark"
              >Dark</option
            ><option value="light">Light</option>
          </select></label
        >
        <label
          >Application palette <select
            value={preferences.palette}
            onchange={(e) =>
              changePreference({
                palette: e.currentTarget.value as Preferences["palette"],
              })}
          >
            <option value="ocean">Ocean</option><option value="graphite"
              >Graphite</option
            ><option value="forest">Forest</option>
          </select></label
        >
        <label
          >Code and Tree theme <select
            value={preferences.editorTheme}
            onchange={(e) =>
              changePreference({
                editorTheme: e.currentTarget
                  .value as Preferences["editorTheme"],
              })}
          >
            <option value="midnight">Midnight</option><option value="orchid"
              >Orchid</option
            ><option value="paper">Paper</option>
          </select></label
        >
        <label
          >Editor font <select
            value={preferences.font}
            onchange={(e) =>
              changePreference({
                font: e.currentTarget.value as Preferences["font"],
              })}
          >
            <option value="system">System monospace</option><option
              value="jetbrains">JetBrains Mono</option
            ><option value="fantasque">Fantasque Sans Mono</option>
          </select></label
        >
      </section>
    </div>
  </main>
</div>
