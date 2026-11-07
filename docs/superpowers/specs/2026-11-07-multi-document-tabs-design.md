# Multi-Document Tabs Design Specification

## Overview & Intent
Add multi-document tab support to the JSON Assistant workspace so users can open, inspect, edit, and compare multiple JSON payloads within a single browser session.
The architecture retains strict zero-recovery, in-memory privacy (no payload persistence to localStorage or remote servers), isolated undo/redo history and diagnostic analysis per document, and an accessible, keyboard-navigable tab bar.

## Architecture & Data Flow

### 1. State Model (`src/lib/tabs.ts`)
A dedicated pure state module manages tab collection and workspace transitions:

```ts
export type TabState = {
  id: string;                 // Unique monotonic ID (e.g. "tab-1")
  name: string;               // Display name (e.g. "users.json" or "document-1.json")
  document: DocumentState;    // Holds source, revision, selection, past, future, exportedSource, analysis
  processingOperation?: ProcessRequest["operation"];
  cancelledRevision: number;  // -1 by default
};

export type WorkspaceState = {
  tabs: TabState[];
  activeTabId: string;
  nextTabNumber: number;      // Sequence number for default naming ("document-N.json")
  nextId: number;             // Monotonic counter for unique IDs
};
```

#### Core Transitions
- `createWorkspace(initialSource = "{}")`: Initializes with a single tab (`id: "tab-1"`, `name: "document-1.json"`).
- `getActiveTab(workspace)`: Returns the currently active `TabState`.
- `isUntouchedDefaultTab(tab)`: Checks if `tab.document.revision === 0 && tab.document.source === "{}" && !isDirty(tab.document)`.
- `openInWorkspace(workspace, items: Array<{ name?: string; source: string }>)`:
  - If the active tab is an untouched default tab, the first item replaces it in-place.
  - Remaining items (or all items if the active tab has user edits/content) are appended as new tabs.
  - The last added/replaced tab becomes `activeTabId`.
- `addTab(workspace)`: Creates a new blank tab (`name: "document-${nextTabNumber}.json"`, `source: "{}"`) and activates it.
- `selectTab(workspace, tabId)`: Switches `activeTabId`.
- `renameTab(workspace, tabId, name)`: Trims whitespace and updates the tab's display name.
- `closeTab(workspace, tabId)`:
  - If `tabs.length === 1`, resets the single tab to a fresh default document (`document-${nextTabNumber}.json`).
  - If `tabs.length > 1`, removes `tabId`. If `tabId === activeTabId`, activates the adjacent tab (right neighbor, or the new last tab if closing the rightmost tab).
- `updateTabDocument(workspace, tabId, updater)`: Applies document updates (commits, undo, redo, analysis, formatting) to a specific tab.
- `isWorkspaceDirty(workspace)`: Returns `true` if any tab satisfies `isDirty(tab.document)`.

### 2. UI & Interaction Design (`src/lib/TabBar.svelte` & `src/App.svelte`)

#### Layout & Hierarchy
- The global header (`<header class="workspace-header">`) contains the brand identity, active tab status badge (`Valid JSON · N bytes`), and global actions (**Open JSON**, **Paste**, **Copy**, **Download**, **Clear**, **Settings**).
- A dedicated `<TabBar>` component sits directly underneath `<header class="workspace-header">` and above `<EditorPanes>`.
- `<EditorPanes>` remains a single mounted instance in the DOM, bound to the active tab's `document` and operation state for optimal performance and memory efficiency.

#### Tab Bar Behavior
- **Accessibility:**
  - Container uses `role="tablist"` with `aria-label="JSON Documents"`.
  - Tabs use `role="tab"`, with `aria-selected="true|false"` and `tabindex={isActive ? 0 : -1}`.
  - Keyboard navigation: Left/Right arrows cycle between tabs, Home/End jump to first/last tab.
- **Visual Indicators:**
  - Dirty dot `●` indicates unsaved changes (`isDirty(tab.document)`).
  - Diagnostic warning `▲` indicates invalid JSON or duplicate keys.
  - Active tab is visually highlighted with border/theme accent matching the current color theme.
- **Actions per Tab:**
  - **Inline Rename:** Double-clicking the tab name (or pressing Enter while focused) opens an inline text input. Pressing Enter or blurring commits the rename; Escape cancels.
  - **Close Button (`✕`):** Clicking close prompts for confirmation if the tab has unsaved changes. Closing the last tab resets it to a fresh blank document.
- **Add Tab Button (`+`):** Positioned at the end of the tab list to append a new blank document.

#### Global Actions
- **Open JSON:** File input updated with `multiple` attribute. Allows opening one or multiple `.json` files simultaneously.
- **Paste:** Pastes text into the active tab if untouched default; otherwise creates a new tab with the pasted payload.
- **Copy / Download / Clear:** Operate strictly on the active tab.

### 3. Worker Operations & Safety
- **Operation Routing:** Requests to the worker include `(tabId, revision)`. Results resolve directly into the originating tab regardless of whether the user switched tabs during processing.
- **Unload Guard:** The `beforeunload` event handler listens whenever `isWorkspaceDirty(workspace)` is true.

## Testing Strategy
- **Unit Tests (`src/lib/tabs.test.ts`)**:
  - Pure state lifecycle: creation, tab addition, switching, closing, closing last tab fallback.
  - Smart open/paste replacement vs. append logic.
  - Multi-file batch imports.
  - Workspace dirty checks.
  - Renaming and name trimming.
- **Component Tests (`src/workspace.test.ts`)**:
  - TabBar rendering with ARIA roles and labels.
  - Tab selection, close button click handlers, inline renaming UI.
  - Keyboard navigation (Arrow keys, Home, End).
- **E2E Tests (`tests/workspace.spec.ts`)**:
  - Tab creation via UI `+` button.
  - Switching between tabs and editing independently.
  - Verifying independent undo/redo stacks per tab.
