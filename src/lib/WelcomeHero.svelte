<script lang="ts">
  let isDraggingOver = $state(false);

  interface Props {
    onOpenFile: () => void;
    onPaste: () => void;
    onStartBlank: () => void;
    onDropFiles: (files: FileList) => void;
  }

  let { onOpenFile, onPaste, onStartBlank, onDropFiles }: Props = $props();

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDraggingOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDraggingOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDraggingOver = false;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
  class="welcome-hero"
  aria-label="Welcome to JSON Assistant"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <div class="welcome-container" data-dragging={isDraggingOver}>
    <div class="welcome-header">
      <img
        class="welcome-logo"
        src={`${import.meta.env.BASE_URL}logo.svg`}
        alt=""
      />
      <h1>JSON Assistant</h1>
      <p class="welcome-tagline">
        Private developer workspace · 100% in-browser processing, no server
        uploads
      </p>
    </div>

    <div class="welcome-tiles">
      <div
        class="welcome-tile"
        role="button"
        tabindex="0"
        aria-label="Open JSON file"
        onclick={onOpenFile}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenFile();
          }
        }}
      >
        <div class="welcome-tile-icon" aria-hidden="true">
          <svg viewBox="0 -960 960 960">
            <path
              d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H457l-80-80H160v480Zm0 0v-480 480Z"
            />
          </svg>
        </div>
        <h2>Open JSON</h2>
        <p>Browse your device or drop <code>.json</code> files here</p>
        <button
          type="button"
          class="primary welcome-action-btn"
          onclick={(e) => {
            e.stopPropagation();
            onOpenFile();
          }}
        >
          Browse File
        </button>
      </div>

      <div
        class="welcome-tile"
        role="button"
        tabindex="0"
        aria-label="Paste JSON"
        onclick={onPaste}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPaste();
          }
        }}
      >
        <div class="welcome-tile-icon" aria-hidden="true">
          <svg viewBox="0 -960 960 960">
            <path
              d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h168q13-36 43.5-58t68.5-22q38 0 68.5 22t43.5 58h168q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm280-590q13 0 21.5-8.5T510-820q0-13-8.5-21.5T480-850q-13 0-21.5 8.5T450-820q0 13 8.5 21.5T480-790Z"
            />
          </svg>
        </div>
        <h2>Paste JSON</h2>
        <p>
          Paste from clipboard or use <kbd>Ctrl+V</kbd> / <kbd>⌘V</kbd>
        </p>
        <button
          type="button"
          class="welcome-action-btn"
          onclick={(e) => {
            e.stopPropagation();
            onPaste();
          }}
        >
          Paste from Clipboard
        </button>
      </div>
    </div>

    <div class="welcome-footer">
      <button
        type="button"
        class="welcome-blank-link"
        aria-label="or start with a blank document →"
        onclick={onStartBlank}
      >
        <span>or start with a blank document</span>
        <svg class="welcome-arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
        </svg>
      </button>
    </div>
  </div>
</section>
