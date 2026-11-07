import { describe, expect, it } from "vitest";
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
} from "./tabs";
import { commit } from "./document";

describe("tabs state manager", () => {
  it("initializes with a single default tab", () => {
    const ws = createWorkspace();
    expect(ws.tabs).toHaveLength(1);
    expect(ws.activeTabId).toBe("tab-1");
    expect(ws.tabs[0].name).toBe("document.json");
    expect(ws.tabs[0].document.source).toBe("{}");
    expect(isUntouchedDefaultTab(ws.tabs[0])).toBe(true);
    expect(isWorkspaceDirty(ws)).toBe(false);
  });

  it("adds sequential tabs with default names", () => {
    let ws = createWorkspace();
    ws = addTab(ws);
    expect(ws.tabs).toHaveLength(2);
    expect(ws.tabs[1].name).toBe("document-2.json");
    expect(ws.activeTabId).toBe("tab-2");

    ws = addTab(ws);
    expect(ws.tabs).toHaveLength(3);
    expect(ws.tabs[2].name).toBe("document-3.json");
    expect(ws.activeTabId).toBe("tab-3");
  });

  it("selects tabs by id", () => {
    let ws = createWorkspace();
    ws = addTab(ws);
    expect(ws.activeTabId).toBe("tab-2");
    ws = selectTab(ws, "tab-1");
    expect(ws.activeTabId).toBe("tab-1");
    // Ignores non-existent id
    ws = selectTab(ws, "non-existent");
    expect(ws.activeTabId).toBe("tab-1");
  });

  it("renames tabs with trimmed strings and ignores empty inputs", () => {
    let ws = createWorkspace();
    ws = renameTab(ws, "tab-1", "  payload.json  ");
    expect(ws.tabs[0].name).toBe("payload.json");

    // Empty or whitespace only is ignored
    ws = renameTab(ws, "tab-1", "   ");
    expect(ws.tabs[0].name).toBe("payload.json");
  });

  it("replaces untouched default tab when opening an item", () => {
    let ws = createWorkspace();
    expect(isUntouchedDefaultTab(getActiveTab(ws))).toBe(true);

    ws = openInWorkspace(ws, [
      { name: "users.json", source: '{"users":[]}', isFile: true },
    ]);
    expect(ws.tabs).toHaveLength(1);
    expect(ws.tabs[0].name).toBe("users.json");
    expect(ws.tabs[0].document.source).toBe('{"users":[]}');
    // Since isFile is true, exportedSource matches source so it's clean
    expect(isWorkspaceDirty(ws)).toBe(false);
  });

  it("appends new tabs when opening if active tab has edits or content", () => {
    let ws = createWorkspace();
    ws = updateTabDocument(ws, "tab-1", (doc) =>
      commit(doc, { source: '{"modified":true}', selection: {} }),
    );

    ws = openInWorkspace(ws, [
      { name: "items.json", source: '{"items":[]}', isFile: true },
    ]);
    expect(ws.tabs).toHaveLength(2);
    expect(ws.tabs[0].name).toBe("document.json");
    expect(ws.tabs[1].name).toBe("items.json");
    expect(ws.activeTabId).toBe("tab-2");
  });

  it("handles multi-file batch opening", () => {
    let ws = createWorkspace();
    ws = openInWorkspace(ws, [
      { name: "file1.json", source: '{"id":1}', isFile: true },
      { name: "file2.json", source: '{"id":2}', isFile: true },
      { name: "file3.json", source: '{"id":3}', isFile: true },
    ]);

    expect(ws.tabs).toHaveLength(3);
    expect(ws.tabs.map((t) => t.name)).toEqual([
      "file1.json",
      "file2.json",
      "file3.json",
    ]);
    expect(ws.activeTabId).toBe("tab-3");
  });

  it("closes middle tab and shifts active focus to right neighbor", () => {
    let ws = createWorkspace();
    ws = addTab(ws, { name: "doc-2.json" });
    ws = addTab(ws, { name: "doc-3.json" });

    // Tabs: tab-1, tab-2, tab-3. Active: tab-3.
    ws = selectTab(ws, "tab-2");
    ws = closeTab(ws, "tab-2");
    expect(ws.tabs.map((t) => t.id)).toEqual(["tab-1", "tab-3"]);
    expect(ws.activeTabId).toBe("tab-3");
  });

  it("closes last tab in list and shifts active focus to previous tab", () => {
    let ws = createWorkspace();
    ws = addTab(ws, { name: "doc-2.json" });
    // Active is tab-2 (last tab)
    ws = closeTab(ws, "tab-2");
    expect(ws.tabs.map((t) => t.id)).toEqual(["tab-1"]);
    expect(ws.activeTabId).toBe("tab-1");
  });

  it("resets to a fresh blank tab when the only remaining tab is closed", () => {
    let ws = createWorkspace();
    ws = renameTab(ws, "tab-1", "my-data.json");
    ws = updateTabDocument(ws, "tab-1", (doc) =>
      commit(doc, { source: '{"custom":1}', selection: {} }),
    );

    ws = closeTab(ws, "tab-1");
    expect(ws.tabs).toHaveLength(1);
    expect(ws.tabs[0].name).toBe("document.json");
    expect(ws.tabs[0].document.source).toBe("{}");
    expect(isWorkspaceDirty(ws)).toBe(false);
  });

  it("tracks workspace dirty state across any tab having unsaved changes", () => {
    let ws = createWorkspace();
    expect(isWorkspaceDirty(ws)).toBe(false);

    ws = addTab(ws);
    expect(isWorkspaceDirty(ws)).toBe(false);

    ws = updateTabDocument(ws, "tab-1", (doc) =>
      commit(doc, { source: '{"dirty":true}', selection: {} }),
    );
    expect(isWorkspaceDirty(ws)).toBe(true);

    // Exporting or syncing exportedSource resets dirty
    ws = updateTabDocument(ws, "tab-1", (doc) => ({
      ...doc,
      exportedSource: doc.source,
    }));
    expect(isWorkspaceDirty(ws)).toBe(false);
  });

  it("reuses closed default indices so tab numbers stay contiguous", () => {
    let ws = createWorkspace(); // document.json (index 1)
    ws = addTab(ws); // document-2.json
    ws = addTab(ws); // document-3.json
    expect(ws.tabs.map((t) => t.name)).toEqual([
      "document.json",
      "document-2.json",
      "document-3.json",
    ]);

    // Close document-2.json without edits
    ws = closeTab(ws, "tab-2");
    expect(ws.tabs.map((t) => t.name)).toEqual([
      "document.json",
      "document-3.json",
    ]);

    // Add a new tab: should fill index 2 rather than jumping to 4
    ws = addTab(ws);
    expect(ws.tabs.map((t) => t.name)).toEqual([
      "document.json",
      "document-3.json",
      "document-2.json",
    ]);

    // Close document.json (1)
    ws = closeTab(ws, "tab-1");
    // Add a new tab: should fill index 1 ("document.json")
    ws = addTab(ws);
    expect(ws.tabs.some((t) => t.name === "document.json")).toBe(true);
  });
});
