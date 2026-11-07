<script lang="ts">
  import Tooltip from "./lib/Tooltip.svelte";
  import SegmentedControl from "./lib/SegmentedControl.svelte";
  import PreferenceDropdown from "./lib/PreferenceDropdown.svelte";
  import KeyboardShortcuts from "./lib/KeyboardShortcuts.svelte";
  import TabBar from "./lib/TabBar.svelte";
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
  import {
    addTab,
    closeTab,
    createWorkspace,
    getActiveTab,
    isUntouchedDefaultTab,
    isWorkspaceDirty,
    openInWorkspace,
    renameTab,
    selectTab,
    updateTabDocument,
    type TabState,
    type WorkspaceState,
  } from "./lib/tabs";
  import WelcomeHero from "./lib/WelcomeHero.svelte";
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

  let workspace: WorkspaceState = createWorkspace();
  $: activeTab = getActiveTab(workspace);
  $: document = activeTab.document;
  $: hasContent =
    (!isUntouchedDefaultTab(activeTab) || dismissedWelcome) &&
    document.source.trim().length > 0;
  let dismissedWelcome = false;
  $: showWelcome =
    workspace.tabs.length === 1 &&
    isUntouchedDefaultTab(activeTab) &&
    !dismissedWelcome;

  let view: View = "split";
  let viewChosen = false;
  let preferences: Preferences = { ...defaultPreferences };
  let page: "workspace" | "settings" = "workspace";
  let settingsTrigger: HTMLButtonElement;
  let settingsHeading: HTMLHeadingElement;
  let shortcuts: InstanceType<typeof KeyboardShortcuts>;
  let zenMode = false;

  function toggleZen() {
    zenMode = !zenMode;
  }

  function changePreference(next: Partial<Preferences>) {
    preferences = { ...preferences, ...next };
    if (next.view) view = next.view;
    try {
      savePreferences(window.localStorage, preferences);
    } catch {
      /* storage blocked */
    }
  }

  async function navigatePage(next: "workspace" | "settings") {
    if (
      typeof window.document.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      window.document.documentElement.dataset.navigation =
        next === "settings" ? "forward" : "back";
      const transition = window.document.startViewTransition(async () => {
        page = next;
        await tick();
      });
      await transition.updateCallbackDone;
    } else {
      page = next;
      await tick();
    }
  }

  async function showSettings() {
    await navigatePage("settings");
    settingsHeading.focus();
  }

  async function showWorkspace() {
    await navigatePage("workspace");
    settingsTrigger.focus();
  }

  let panes: InstanceType<typeof EditorPanes>;
  let processor: ReturnType<typeof createProcessor>;
  let busy = false;
  let processingOperation: ProcessRequest["operation"] | undefined;
  let processId = 0;
  let copied = "";
  let ioError = "";
  let fileInput: HTMLInputElement;
  let loadId = 0;
  let loadController: AbortController | undefined;
  let beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | undefined;
  let beforeUnloadListening = false;

  function syncBeforeUnload() {
    if (!beforeUnloadHandler) return;
    const dirty = isWorkspaceDirty(workspace);
    if (dirty && !beforeUnloadListening) {
      window.addEventListener("beforeunload", beforeUnloadHandler);
      beforeUnloadListening = true;
    } else if (!dirty && beforeUnloadListening) {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      beforeUnloadListening = false;
    }
  }
  $: if (workspace && beforeUnloadHandler) syncBeforeUnload();

  function edit(snapshot: { source: string; selection: Selection }) {
    workspace = updateTabDocument(workspace, activeTab.id, (doc) =>
      commit(doc, snapshot),
    );
  }

  function select(selection: Selection) {
    workspace = updateTabDocument(workspace, activeTab.id, (doc) => ({
      ...doc,
      selection,
    }));
  }

  function history(direction: "undo" | "redo") {
    workspace = updateTabDocument(workspace, activeTab.id, (doc) =>
      direction === "undo" ? undo(doc) : redo(doc),
    );
  }

  function applyResult(tabId: string, revision: number, result: ProcessResult) {
    workspace = updateTabDocument(workspace, tabId, (doc) => {
      let nextDoc = acceptAnalysis(doc, result.analysis);
      if (result.analysis.valid && result.source !== undefined) {
        nextDoc = acceptCompletion(nextDoc, {
          revision,
          source: result.source,
        });
      }
      return nextDoc;
    });
  }

  async function runOperation(
    operation: ProcessRequest["operation"],
    targetTabId = activeTab.id,
  ): Promise<ProcessResult> {
    const targetTab =
      workspace.tabs.find((t) => t.id === targetTabId) ?? activeTab;
    const id = ++processId;
    const request = {
      revision: targetTab.document.revision,
      source: targetTab.document.source,
      operation,
    };
    busy = true;
    processingOperation = operation;
    workspace = updateTabDocument(workspace, targetTab.id, (doc) => ({
      ...doc,
      processing: true,
    }));

    try {
      const result = await processor.run(request);
      if (id === processId) applyResult(targetTab.id, request.revision, result);
      return result;
    } finally {
      if (id === processId) {
        busy = false;
        processingOperation = undefined;
        workspace = updateTabDocument(workspace, targetTab.id, (doc) => ({
          ...doc,
          processing: false,
        }));
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
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      ioError =
        "Clipboard read failed. Check browser clipboard permissions and try again.";
      return;
    }
    workspace = openInWorkspace(workspace, [{ source: text }]);
    ioError = "";
  }

  function replaceDocument(source: string) {
    loadId++;
    loadController?.abort();
    loadController = undefined;
    processId++;
    processor.cancel();
    busy = false;
    processingOperation = undefined;
    workspace = updateTabDocument(workspace, activeTab.id, (doc) => ({
      ...createDocument(source),
      revision: doc.revision + 1,
    }));
    workspace = {
      ...workspace,
      tabs: workspace.tabs.map((t) =>
        t.id === activeTab.id ? { ...t, cancelledRevision: -1 } : t,
      ),
    };
    ioError = "";
  }

  async function openFiles(files: FileList | File[]) {
    loadController?.abort();
    const controller = new AbortController(),
      id = ++loadId;
    loadController = controller;

    try {
      const items: Array<{ name: string; source: string; isFile: boolean }> =
        [];
      for (const file of Array.from(files)) {
        const source = await readFile(file, controller.signal);
        items.push({ name: file.name, source, isFile: true });
      }
      if (id !== loadId) return;
      workspace = openInWorkspace(workspace, items);
      ioError = "";
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
      downloadText(source, activeTab.name || "document.json");
      workspace = updateTabDocument(workspace, activeTab.id, (doc) => ({
        ...doc,
        exportedSource: source,
      }));
      ioError = "Download initiated.";
    } catch {
      ioError = "Download could not be initiated.";
    }
  }

  $: if (
    processor &&
    !document.analysis &&
    !document.processing &&
    activeTab.cancelledRevision !== document.revision
  )
    void runOperation("analyze", activeTab.id);

  function shortcut(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      ["f", "h"].includes(event.key.toLowerCase()) &&
      event.isTrusted
    ) {
      const target = event.target as HTMLElement;
      const inTree = Boolean(target.closest('[aria-label="Tree pane"]'));
      const replace = event.key.toLowerCase() === "h";
      if (
        replace &&
        !target.closest('[aria-label="Tree pane"], [aria-label="Source pane"]')
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      shortcuts.close();
      page = "workspace";
      if (!inTree && view === "tree") chooseView("code");
      void tick().then(() =>
        inTree
          ? panes?.openTreeSearch(replace)
          : panes?.openSourceSearch(replace),
      );
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      history(event.shiftKey ? "redo" : "undo");
      return;
    }
    if (
      event.key === "F11" ||
      ((event.altKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        !event.ctrlKey)
    ) {
      event.preventDefault();
      toggleZen();
      return;
    }
    if (event.key === "Escape" && zenMode) {
      event.preventDefault();
      zenMode = false;
      return;
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
        applyResult(activeTab.id, result.analysis.revision, result);
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
  data-theme={preferences.theme}
>
  <main class="workspace" data-zen={zenMode} hidden={page === "settings"}>
    <header class="workspace-header" hidden={showWelcome}>
      <div class="identity">
        <img
          class="brand-mark"
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
        />
        <div>
          <h1>JSON Assistant</h1>
          <p>Private developer workspace</p>
        </div>
      </div>
      <div class="document-meta">
        <div class="document-name" title={activeTab.name}>
          {activeTab.name}
          <span>{isDirty(document) ? "● Unsaved" : "· Unchanged"}</span>
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
      </div>
      <div class="header-actions">
        <button class="primary" onclick={() => fileInput.click()}
          >Open JSON</button
        >
        <input
          bind:this={fileInput}
          type="file"
          accept="application/json,.json"
          multiple
          hidden
          onchange={(event) => {
            const files = event.currentTarget.files;
            if (files && files.length > 0) void openFiles(files);
            event.currentTarget.value = "";
          }}
        />
        <button onclick={pasteDocument}>Paste</button>
        {#if hasContent}<Tooltip label="Copy JSON" align="end"
            ><button
              class="icon-button"
              aria-label="Copy JSON"
              onclick={copyJson}
              ><svg viewBox="0 0 24 24" aria-hidden="true"
                ><path
                  d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
                /></svg
              ></button
            ></Tooltip
          >
          <Tooltip label="Download JSON" align="end"
            ><button
              class="icon-button"
              aria-label="Download"
              onclick={download}
              ><svg viewBox="0 0 24 24" aria-hidden="true"
                ><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg
              ></button
            ></Tooltip
          >
          <Tooltip label="Clear document" align="end"
            ><button
              class="icon-button danger-button"
              aria-label="Clear document"
              onclick={() => {
                if (
                  isDirty(document) &&
                  !window.confirm("Clear the unsaved document?")
                )
                  return;
                replaceDocument("");
              }}
              ><svg viewBox="0 0 24 24" aria-hidden="true"
                ><path
                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                /></svg
              ></button
            ></Tooltip
          >{/if}
        <Tooltip
          label={zenMode ? "Exit fullscreen (Esc)" : "Fullscreen mode (F11)"}
          align="end"
        >
          <button
            class="icon-button"
            aria-label={zenMode ? "Exit fullscreen" : "Fullscreen mode"}
            onclick={toggleZen}
            ><svg viewBox="0 0 24 24" aria-hidden="true"
              >{#if zenMode}<path
                  d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
                />{:else}<path
                  d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
                />{/if}</svg
            ></button
          >
        </Tooltip>
        <Tooltip label="Open settings" align="end"
          ><button
            bind:this={settingsTrigger}
            class="icon-button"
            aria-label="Open settings"
            onclick={showSettings}
            ><svg viewBox="0 0 24 24" aria-hidden="true"
              ><path
                d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87c-0.12,0.21-0.08,0.47,0.12,0.61l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
              /></svg
            ></button
          ></Tooltip
        >
        <Tooltip label="Keyboard shortcuts" align="end">
          <button
            class="icon-button"
            aria-label="Keyboard shortcuts"
            onclick={() => shortcuts.open()}
            ><svg viewBox="0 0 24 24" aria-hidden="true"
              ><path
                d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zM5 8h2v2H5V8zm0 3h2v2H5v-2zm11 6H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm-3 3h-2v-2h2v2zm0-3h-2V8h2v2zm6 3h-2v-2h2v2zm0-3h-2V8h2v2z"
              /></svg
            ></button
          >
        </Tooltip>
      </div>
    </header>

    {#if showWelcome}
      <WelcomeHero
        onOpenFile={() => fileInput.click()}
        onPaste={pasteDocument}
        onStartBlank={() => (dismissedWelcome = true)}
        onDropFiles={(files) => void openFiles(files)}
      />
    {/if}

    <div class="workbench-wrapper" hidden={showWelcome}>
      <TabBar
        tabs={workspace.tabs}
        activeTabId={workspace.activeTabId}
        {zenMode}
        onToggleZen={toggleZen}
        onSelectTab={(tabId) => (workspace = selectTab(workspace, tabId))}
        onAddTab={() => {
          dismissedWelcome = true;
          workspace = addTab(workspace);
        }}
        onCloseTab={(tabId) => (workspace = closeTab(workspace, tabId))}
        onRenameTab={(tabId, name) =>
          (workspace = renameTab(workspace, tabId, name))}
      />

      {#if document.analysis?.mode !== "unavailable"}
        <EditorPanes
          bind:this={panes}
          state={document}
          {hasContent}
          {view}
          theme={preferences.theme}
          {processingOperation}
          font={preferences.font}
          animatedIndentGuides={preferences.animatedIndentGuides}
          onEdit={edit}
          onSelection={select}
          onHistory={history}
          onCancel={() => {
            processId++;
            workspace = {
              ...workspace,
              tabs: workspace.tabs.map((t) =>
                t.id === activeTab.id
                  ? { ...t, cancelledRevision: document.revision }
                  : t,
              ),
            };
            processor.cancel();
            busy = false;
            processingOperation = undefined;
            workspace = updateTabDocument(workspace, activeTab.id, (doc) => ({
              ...doc,
              processing: false,
            }));
          }}
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
            ? processingOperation === "format"
              ? "Formatting"
              : processingOperation === "minify"
                ? "Minifying"
                : "Analyzing"
            : activeTab.cancelledRevision === document.revision &&
                !document.analysis
              ? "Processing cancelled"
              : document.analysis
                ? document.analysis.valid
                  ? "Valid JSON"
                  : "Invalid JSON"
                : "Analyzing"} · {document.analysis?.bytes ??
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
              .line}:{document.analysis.diagnostics[0].column}: {document
              .analysis.diagnostics[0].message}
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
    </div>
    <pre data-testid="source">{document.source}</pre>
    <output data-testid="revision" hidden>{document.revision}</output>
  </main>
  <main
    class="settings-page"
    aria-label="Settings"
    hidden={page !== "settings"}
  >
    <header class="settings-header workspace-header">
      <Tooltip label="Back to workspace" align="start"
        ><button
          class="icon-button"
          aria-label="Back to workspace"
          onclick={showWorkspace}
          ><svg viewBox="0 0 24 24" aria-hidden="true"
            ><path
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
            /></svg
          ></button
        ></Tooltip
      >
      <div class="identity">
        <img
          class="brand-mark"
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
        />
        <div>
          <span class="settings-brand-name">JSON Assistant</span>
          <p>Private developer workspace</p>
        </div>
      </div>
    </header>
    <div class="settings-content">
      <h1 bind:this={settingsHeading} tabindex="-1">Settings</h1>
      <p>
        Preferences stay in this browser. Your JSON document is never saved
        automatically.
      </p>
      <section class="settings-card" aria-label="Workspace layout">
        <div class="workspace-view-heading">
          <div class="workspace-view-label">
            <h2>Workspace view</h2>
            <p>Choose how you work with your document.</p>
          </div>
          <SegmentedControl
            label="Workspace view"
            options={[
              { value: "split", label: "Split" },
              { value: "code", label: "Code" },
              { value: "tree", label: "Tree" },
            ]}
            value={view}
            onChange={(value) => chooseView(value as View)}
          />
        </div>
      </section>
      <section class="settings-card" aria-label="Appearance preferences">
        <h2>Appearance</h2>
        <div class="preference-field" role="presentation">
          <span class="preference-label">Mode</span>
          <SegmentedControl
            label="Mode"
            options={[
              { value: "system", label: "System", icon: "computer" },
              { value: "dark", label: "Dark", icon: "dark_mode" },
              { value: "light", label: "Light", icon: "light_mode" },
            ]}
            value={preferences.appearance}
            className="mode-control"
            onChange={(appearance) =>
              changePreference({
                appearance: appearance as Preferences["appearance"],
              })}
          />
        </div>
        <PreferenceDropdown
          label="Color theme"
          options={[
            { value: "cobalt2", label: "Cobalt2" },
            { value: "tokyo-night", label: "Tokyo Night" },
            { value: "catppuccin", label: "Catppuccin" },
            { value: "rose-pine", label: "Rosé Pine" },
            { value: "solarized", label: "Solarized" },
            { value: "vscode-dark-plus", label: "VS Code Dark+" },
            { value: "github", label: "GitHub" },
          ]}
          value={preferences.theme}
          onChange={(theme) =>
            changePreference({ theme: theme as Preferences["theme"] })}
        />
        <PreferenceDropdown
          label="Editor font"
          options={[
            { value: "system", label: "System default" },
            { value: "jetbrains", label: "JetBrains Mono" },
            { value: "iosevka", label: "Iosevka Mono" },
            { value: "cascadia", label: "Cascadia Code" },
            { value: "fira", label: "Fira Code" },
          ]}
          value={preferences.font}
          onChange={(font) =>
            changePreference({ font: font as Preferences["font"] })}
        />
        <p class="editor-preview-label">Preview · selected font and theme</p>
        <pre
          class="editor-font-preview"
          data-testid="editor-font-preview"
          data-editor-font={preferences.font}
          aria-label="Editor font preview"><code
            >{"{"}{"\n  "}<span class="preview-key">"name"</span>: <span
              class="preview-value preview-string">"JSON Assistant"</span
            >,{"\n  "}<span class="preview-key">"symbols"</span>: <span
              class="preview-value preview-string">"=> !== ->"</span
            >,{"\n  "}<span class="preview-key">"count"</span>: <span
              class="preview-value preview-number">123</span
            >,{"\n  "}<span class="preview-key">"enabled"</span>: <span
              class="preview-value preview-boolean">true</span
            >,{"\n  "}<span class="preview-key">"optional"</span>: <span
              class="preview-value preview-null">null</span
            >{"\n}"}</code
          ></pre>
        <button
          type="button"
          class="preference-toggle"
          role="switch"
          aria-label="Animated indentation guides"
          aria-checked={preferences.animatedIndentGuides}
          onclick={() =>
            changePreference({
              animatedIndentGuides: !preferences.animatedIndentGuides,
            })}
        >
          <span>Animated indentation guides</span>
          <span class="toggle-track" aria-hidden="true"
            ><span class="toggle-thumb"></span></span
          >
        </button>
      </section>
    </div>
  </main>
  <KeyboardShortcuts bind:this={shortcuts} />
</div>
