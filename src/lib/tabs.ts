import { createDocument, isDirty, type DocumentState } from "./document";
import type { ProcessRequest } from "./process";

export type TabState = {
  id: string;
  name: string;
  document: DocumentState;
  processingOperation?: ProcessRequest["operation"];
  cancelledRevision: number;
};

export type WorkspaceState = {
  tabs: TabState[];
  activeTabId: string;
  nextTabNumber: number;
  nextId: number;
};

export function createWorkspace(initialSource = "{}"): WorkspaceState {
  const initialDoc = createDocument(initialSource);
  const initialTab: TabState = {
    id: "tab-1",
    name: "document.json",
    document: initialDoc,
    cancelledRevision: -1,
  };
  return {
    tabs: [initialTab],
    activeTabId: initialTab.id,
    nextTabNumber: 2,
    nextId: 2,
  };
}

export function getActiveTab(workspace: WorkspaceState): TabState {
  return (
    workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ??
    workspace.tabs[0]
  );
}

export function isUntouchedDefaultTab(tab: TabState): boolean {
  return (
    tab.document.revision === 0 &&
    tab.document.source === "{}" &&
    !isDirty(tab.document)
  );
}

export function getNextDefaultTabName(tabs: TabState[]): string {
  const existingNumbers = new Set<number>();
  for (const tab of tabs) {
    if (tab.name === "document.json") {
      existingNumbers.add(1);
    } else {
      const match = /^document-(\d+)\.json$/.exec(tab.name);
      if (match) {
        existingNumbers.add(Number(match[1]));
      }
    }
  }

  let candidate = 1;
  while (existingNumbers.has(candidate)) {
    candidate++;
  }

  return candidate === 1 ? "document.json" : `document-${candidate}.json`;
}

export function addTab(
  workspace: WorkspaceState,
  options?: { name?: string; source?: string; isFile?: boolean },
): WorkspaceState {
  const id = `tab-${workspace.nextId}`;
  const name = options?.name || getNextDefaultTabName(workspace.tabs);
  const source = options?.source ?? "{}";
  const doc = createDocument(source);

  // If opened as an existing file, exportedSource equals source so it is marked unchanged/clean initially.
  // If created as a blank tab or pasted, standard default applies.
  if (options?.isFile) {
    doc.exportedSource = source;
  }

  const newTab: TabState = {
    id,
    name,
    document: doc,
    cancelledRevision: -1,
  };

  return {
    ...workspace,
    tabs: [...workspace.tabs, newTab],
    activeTabId: id,
    nextTabNumber: workspace.nextTabNumber + (options?.name ? 0 : 1),
    nextId: workspace.nextId + 1,
  };
}

export function openInWorkspace(
  workspace: WorkspaceState,
  items: Array<{ name?: string; source: string; isFile?: boolean }>,
): WorkspaceState {
  if (items.length === 0) return workspace;

  let current = workspace;
  const active = getActiveTab(current);
  let startIndex = 0;

  if (isUntouchedDefaultTab(active)) {
    const first = items[0];
    const doc = createDocument(first.source);
    if (first.isFile) {
      doc.exportedSource = first.source;
    }
    const updatedTab: TabState = {
      ...active,
      name: first.name || active.name,
      document: doc,
      processingOperation: undefined,
      cancelledRevision: -1,
    };
    current = {
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.id === active.id ? updatedTab : tab,
      ),
    };
    startIndex = 1;
  }

  for (let i = startIndex; i < items.length; i++) {
    current = addTab(current, items[i]);
  }

  return current;
}

export function selectTab(
  workspace: WorkspaceState,
  tabId: string,
): WorkspaceState {
  if (workspace.activeTabId === tabId) return workspace;
  if (!workspace.tabs.some((tab) => tab.id === tabId)) return workspace;
  return { ...workspace, activeTabId: tabId };
}

export function renameTab(
  workspace: WorkspaceState,
  tabId: string,
  rawName: string,
): WorkspaceState {
  const trimmed = rawName.trim();
  if (!trimmed) return workspace;
  return {
    ...workspace,
    tabs: workspace.tabs.map((tab) =>
      tab.id === tabId ? { ...tab, name: trimmed } : tab,
    ),
  };
}

export function closeTab(
  workspace: WorkspaceState,
  tabId: string,
): WorkspaceState {
  const index = workspace.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return workspace;

  if (workspace.tabs.length === 1) {
    const freshTab: TabState = {
      id: `tab-${workspace.nextId}`,
      name: "document.json",
      document: createDocument("{}"),
      cancelledRevision: -1,
    };
    return {
      ...workspace,
      tabs: [freshTab],
      activeTabId: freshTab.id,
      nextTabNumber: 2,
      nextId: workspace.nextId + 1,
    };
  }

  const nextTabs = workspace.tabs.filter((tab) => tab.id !== tabId);
  let nextActiveId = workspace.activeTabId;

  if (workspace.activeTabId === tabId) {
    // Prefer right neighbor; if closed tab was last, use the new last tab
    const nextIndex = Math.min(index, nextTabs.length - 1);
    nextActiveId = nextTabs[nextIndex].id;
  }

  return {
    ...workspace,
    tabs: nextTabs,
    activeTabId: nextActiveId,
  };
}

export function updateTabDocument(
  workspace: WorkspaceState,
  tabId: string,
  updater: (doc: DocumentState) => DocumentState,
): WorkspaceState {
  return {
    ...workspace,
    tabs: workspace.tabs.map((tab) =>
      tab.id === tabId ? { ...tab, document: updater(tab.document) } : tab,
    ),
  };
}

export function isWorkspaceDirty(workspace: WorkspaceState): boolean {
  return workspace.tabs.some((tab) => isDirty(tab.document));
}
