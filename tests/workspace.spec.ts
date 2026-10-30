import { expect, test, type Page } from "@playwright/test";

async function source(page: Page, text: string) {
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
  await expect(page.getByTestId("source")).toHaveText(text);
}

async function chooseView(page: Page, view: "Code" | "Tree" | "Split") {
  await page.getByRole("button", { name: "Open settings" }).click();
  await page
    .getByRole("group", { name: "Workspace view" })
    .getByRole("button", { name: view, exact: true })
    .click();
  await page.getByRole("button", { name: "Back to workspace" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("copy preserves exact dirty source when clipboard rejects", async ({
  page,
}) => {
  const draft = String.raw`{"n":9007199254740993,"s":"\u0061"}`;
  await source(page, draft);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy JSON", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText(draft);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(/clipboard/i);
});

test("beforeunload warning tracks the dirty baseline", async ({ page }) => {
  const wasPrevented = () =>
    page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(await wasPrevented()).toBe(false);
  await source(page, '{"dirty":true}');
  expect(await wasPrevented()).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await wasPrevented()).toBe(false);
});

test("dirty file replacement asks for confirmation and cancellation retains source", async ({
  page,
}) => {
  const draft = '{"draft":';
  await source(page, draft);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "replacement.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"replacement":true}'),
  });
  await expect(page.getByTestId("source")).toHaveText(draft);
});

test("download initiates the exact invalid draft and reports initiation, not disk completion", async ({
  page,
}) => {
  const draft = String.raw`{"n":9007199254740993,"s":"\u0061",`;
  await source(page, draft);
  await expect(page.getByText(/Warning: invalid JSON draft/)).toContainText(
    /exact raw source/i,
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.evaluate(() => {
    const original = URL.revokeObjectURL.bind(URL);
    (window as any).__revokedUrls = [];
    URL.revokeObjectURL = (url: string) => {
      (window as any).__revokedUrls.push(url);
      original(url);
    };
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const file = await download;
  expect(await page.evaluate(() => (window as any).__revokedUrls.length)).toBe(
    0,
  );
  await page.waitForFunction(() => (window as any).__revokedUrls.length === 1);
  expect(file.suggestedFilename()).toBe("document.json");
  const path = await file.path();
  expect(await (await import("node:fs/promises")).readFile(path!, "utf8")).toBe(
    draft,
  );
  await expect(page.getByRole("alert")).toHaveText("Download initiated.");
  await expect(page.getByText("Unchanged")).toBeVisible();
});

test("clearing dirty source requires confirmation and rejection preserves undo history", async ({
  page,
}) => {
  const draft = '{"before":true}';
  await source(page, draft);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText(draft);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText("{}");
});

test("pasting as a document requires confirmation and rejection preserves the draft", async ({
  page,
}) => {
  const draft = '{"draft":1}';
  await source(page, draft);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: { readText: async () => '{"pasted":true}' },
    }),
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Paste as document", exact: true })
    .click();
  await expect(page.getByTestId("source")).toHaveText(draft);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
});

test("opening a confirmed file replaces the source and establishes it as the clean baseline", async ({
  page,
}) => {
  await source(page, '{"draft":1}');
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "replacement.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"replacement":true}'),
  });
  await expect(page.getByTestId("source")).toHaveText('{"replacement":true}');
  await expect(page.getByText("Unchanged")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
});

test("cancelling a pending file read leaves the committed source untouched", async ({
  page,
}) => {
  await source(page, '{"draft":1}');
  await page.evaluate(() => {
    const readers: any[] = [];
    (window as any).__readers = readers;
    class SlowReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      onloadend: (() => void) | null = null;
      error = null;
      readAsText() {
        readers.push(this);
      }
      abort() {
        this.onabort?.();
        this.onloadend?.();
      }
    }
    Object.defineProperty(window, "FileReader", { value: SlowReader });
  });
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "pending.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"new":true}'),
  });
  const cancel = page.getByRole("button", {
    name: "Cancel file load",
    exact: true,
  });
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(page.getByTestId("source")).toHaveText('{"draft":1}');
});

test("a later clear invalidates an earlier pending file open", async ({
  page,
}) => {
  await page.evaluate(() => {
    const readers: any[] = [];
    (window as any).__readers = readers;
    class SlowReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      onloadend: (() => void) | null = null;
      error = null;
      readAsText() {
        readers.push(this);
      }
      abort() {
        this.onabort?.();
        this.onloadend?.();
      }
    }
    Object.defineProperty(window, "FileReader", { value: SlowReader });
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "pending.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"late":true}'),
  });
  await expect(
    page.getByRole("button", { name: "Cancel file load", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.evaluate(() => {
    const reader = (window as any).__readers[0];
    reader.result = '{"late":true}';
    reader.onload?.();
    reader.onloadend?.();
  });
  await expect(page.getByTestId("source")).toHaveText("");
});

test("a file read error leaves source/history intact and reports the failure", async ({
  page,
}) => {
  await source(page, '{"draft":1}');
  await page.evaluate(() => {
    class FailedReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      onloadend: (() => void) | null = null;
      error = new Error("read failed");
      readAsText() {
        this.onerror?.();
        this.onloadend?.();
      }
      abort() {
        this.onabort?.();
        this.onloadend?.();
      }
    }
    Object.defineProperty(window, "FileReader", { value: FailedReader });
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "failed.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"new":true}'),
  });
  await expect(page.getByRole("alert")).toHaveText("read failed");
  await expect(page.getByTestId("source")).toHaveText('{"draft":1}');
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText("{}");
});

test("a late earlier file read cannot replace a later selected file", async ({
  page,
}) => {
  await page.evaluate(() => {
    const readers: any[] = [];
    (window as any).__readers = readers;
    class SlowReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      onloadend: (() => void) | null = null;
      error = null;
      readAsText() {
        readers.push(this);
      }
      abort() {
        this.onabort?.();
        this.onloadend?.();
      }
    }
    Object.defineProperty(window, "FileReader", { value: SlowReader });
  });
  const input = page.locator("input[type=file]");
  await input.setInputFiles({
    name: "a.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"a":1}'),
  });
  await expect(
    page.getByRole("button", { name: "Cancel file load", exact: true }),
  ).toBeEnabled();
  await input.setInputFiles({
    name: "b.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"b":2}'),
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__readers.length))
    .toBe(2);
  await page.evaluate(() => {
    const readers = (window as any).__readers;
    readers[1].result = '{"b":2}';
    readers[1].onload?.();
    readers[1].onloadend?.();
    readers[0].result = '{"a":1}';
    readers[0].onload?.();
    readers[0].onloadend?.();
  });
  await expect(page.getByTestId("source")).toHaveText('{"b":2}');
});

test("an edit during file loading requires fresh replacement confirmation", async ({
  page,
}) => {
  await source(page, '{"draft":1}');
  await page.evaluate(() => {
    const readers: any[] = [];
    (window as any).__readers = readers;
    class SlowReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      onloadend: (() => void) | null = null;
      error = null;
      readAsText() {
        readers.push(this);
      }
      abort() {
        this.onabort?.();
        this.onloadend?.();
      }
    }
    Object.defineProperty(window, "FileReader", { value: SlowReader });
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "pending.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"new":true}'),
  });
  await source(page, '{"newer draft":2}');
  const prompt = page.waitForEvent("dialog");
  await page.evaluate(() =>
    setTimeout(() => {
      const reader = (window as any).__readers[0];
      reader.result = '{"new":true}';
      reader.onload?.();
      reader.onloadend?.();
    }, 0),
  );
  const dialog = await prompt;
  expect(dialog.message()).toContain("document changed");
  await dialog.accept();
  await expect(page.getByTestId("source")).toHaveText('{"new":true}');
});

test("format and minify are undoable, redoable, and superseded by a new edit", async ({
  page,
}) => {
  const compact = '{"a":1}';
  await source(page, compact);
  await page.getByRole("button", { name: "Format", exact: true }).click();
  const formatted = '{\n  "a": 1\n}';
  await expect(page.getByTestId("source")).toHaveText(formatted);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText(compact);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText(formatted);
  await expect(
    page.getByRole("button", { name: "Minify", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Minify", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText(compact);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText(formatted);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText(compact);
  await source(page, '{"b":2}');
  await expect(
    page.getByRole("button", { name: "Redo", exact: true }),
  ).toBeDisabled();
});

test("formatting and minifying show a non-blocking editor overlay", async ({
  page,
}) => {
  const largeSource = JSON.stringify({
    items: Array.from({ length: 200 }, (_, id) => ({
      id,
      label: `item-${id}`,
    })),
  });
  await page.evaluate(
    (text) => (window as any).__benchmarkLoad(text),
    largeSource,
  );
  const overlay = page.getByTestId("processing-overlay");
  await page.evaluate(() => {
    const postMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message) {
      if (message.operation !== "analyze")
        setTimeout(
          () => postMessage.call(this, message),
          message.operation === "minify" ? 5000 : 1000,
        );
      else postMessage.call(this, message);
    };
  });

  await chooseView(page, "Split");
  await page.getByRole("button", { name: "Format", exact: true }).click();
  await expect(overlay).toBeVisible();
  const treePane = page.getByRole("region", { name: "Tree pane" });
  await expect(
    treePane.getByRole("button", { name: "Expand all" }),
  ).toBeDisabled();
  await expect(
    treePane.getByRole("button", { name: "Collapse all" }),
  ).toBeDisabled();
  const status = overlay.getByRole("status");
  await expect(status).toContainText("Formatting");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(
    page.getByRole("region", { name: "Source pane" }),
  ).toHaveAttribute("aria-busy", "true");
  await expect(overlay).toBeHidden();

  await chooseView(page, "Code");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".panes")).toHaveAttribute("data-view", "code");
  await page.getByRole("button", { name: "Minify", exact: true }).click();
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("status")).toContainText("Minifying");
  await source(page, '{"edited":true}');
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "Cancel" }).click();
  await expect(overlay).toBeHidden();
  await expect(page.getByTestId("source")).toHaveText('{"edited":true}');
});

test("invalid source remains exact and disables tree edits while diagnostics stay visible", async ({
  page,
}) => {
  for (const invalid of ['{"a":', String.raw`{"a":1,"\u0061":2}`]) {
    await source(page, invalid);
    await expect(page.getByTestId("source")).toHaveText(invalid);
    await expect(page.getByTestId("diagnostic")).toContainText(
      /Invalid JSON at|Duplicate key at/,
    );
    await expect(
      page.getByRole("button", { name: "Format", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Minify", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("region", { name: "Tree pane" }).getByRole("tree"),
    ).toBeHidden();
  }
  await expect(page.getByText(/UTF-8/)).toBeVisible();
  await source(page, '{"a":1}');
  await expect(
    page.getByRole("region", { name: "Tree pane" }).getByRole("tree"),
  ).toBeVisible();
});

test("out-of-order analysis and completion cannot replace the latest source or tree revision", async ({
  page,
}) => {
  await source(page, '{"first":1}');
  const oldRevision = Number(await page.getByTestId("revision").textContent());
  await source(page, '{"latest":2}');
  await expect(
    page.getByRole("treeitem", { name: "latest : 2", exact: true }),
  ).toBeVisible();

  await page.evaluate(
    (revision) =>
      (window as any).__editorGateApplyResult({
        analysis: {
          revision,
          bytes: 12,
          valid: false,
          diagnostics: [
            { kind: "syntax", message: "stale", offset: 0, line: 1, column: 1 },
          ],
          depth: 0,
          nodes: 1,
        },
      }),
    oldRevision,
  );
  await expect(page.getByText(/Valid JSON ·/)).toBeVisible();
  await page.evaluate(
    (revision) =>
      (window as any).__editorGateApplyResult({
        analysis: {
          revision,
          bytes: 10,
          valid: true,
          diagnostics: [],
          depth: 0,
          nodes: 1,
        },
        source: '{"stale":0}',
      }),
    oldRevision,
  );

  await expect(page.getByTestId("source")).toHaveText('{"latest":2}');
  await expect(
    page.getByRole("treeitem", { name: "latest : 2", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("diagnostic")).toHaveCount(0);
});

test("search finds text and value in collapsed tree branches and reveals the match", async ({
  page,
}) => {
  await source(page, '{"outer":{"needle":"value"}}');
  const tree = page.getByRole("region", { name: "Tree pane" });
  const outer = tree.getByRole("treeitem", { name: /outer/ }).last();
  const collapseOuter = outer.getByRole("button", {
    name: /Expand or collapse/,
  });
  await collapseOuter.click();
  await expect(
    tree.getByRole("treeitem", { name: "needle : value", exact: true }),
  ).toBeVisible();
  await collapseOuter.click();
  await expect(
    tree.getByRole("treeitem", { name: "needle : value", exact: true }),
  ).toHaveCount(0);
  await expect(
    tree.getByRole("button", { name: /Transform|Sort|Schema|Query|Repair/i }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Search/ }).click();
  const search = page.getByPlaceholder("Find");
  await search.fill("needle");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("treeitem", { name: "needle : value", exact: true }),
  ).toBeVisible();
  await search.fill("value");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("treeitem", { name: "needle : value", exact: true }),
  ).toBeVisible();
});

test("expand all and collapse all affect every nested tree branch", async ({
  page,
}) => {
  await source(page, '{"outer":{"middle":{"inner":1}}}');
  await chooseView(page, "Tree");
  const tree = page.getByRole("region", { name: "Tree pane" });
  const inner = tree.getByRole("treeitem", { name: "inner : 1", exact: true });

  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(inner).toHaveCount(0);
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(inner).toBeVisible();
});

test("expand all fully expands large documents", async ({ page }) => {
  const largeSource = JSON.stringify({
    padding: "x".repeat(100_001),
    outer: { middle: { inner: 1 } },
  });
  expect(largeSource.length).toBeGreaterThan(100_000);
  await page.evaluate(
    (text) => (window as any).__benchmarkLoad(text),
    largeSource,
  );
  await chooseView(page, "Tree");

  const overlay = page.getByTestId("processing-overlay");
  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("status")).toContainText("Collapsing");
  await expect(overlay).toBeHidden();
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("status")).toContainText("Expanding");
  await expect(
    page.getByRole("treeitem", { name: "inner : 1", exact: true }),
  ).toBeVisible();
  await expect(overlay).toBeHidden();
});

test("cancel in the tree overlay stops pending expansion", async ({ page }) => {
  const largeSource = JSON.stringify({
    items: Array.from({ length: 1000 }, (_, id) => ({
      id,
      nested: { value: id },
    })),
  });
  await page.evaluate(
    (text) => (window as any).__benchmarkLoad(text),
    largeSource,
  );
  await chooseView(page, "Tree");

  const tree = page.getByRole("region", { name: "Tree pane" });
  const overlay = page.getByTestId("processing-overlay");
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "Cancel" }).click();
  await expect(overlay).toBeHidden();
  await expect(
    tree.getByRole("treeitem", { name: "value : 999", exact: true }),
  ).toHaveCount(0);
});

test("path action copies an escaped JSONPath for selected keys", async ({
  page,
}) => {
  await page.evaluate(() => {
    (window as any).__clipboardText = "";
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as any).__clipboardText = text;
        },
      },
    });
  });
  await source(page, String.raw`{"a.\"b\\c":1}`);
  await chooseView(page, "Tree");
  const tree = page.getByRole("region", { name: "Tree pane" });
  await tree
    .getByRole("treeitem", { name: 'a.\"b\\c : 1', exact: true })
    .click();
  const copyPath = page.getByRole("button", { name: "Copy path", exact: true });
  await copyPath.hover();
  await expect(page.getByRole("tooltip", { name: "Copy path" })).toBeVisible();
  await copyPath.click();
  const copiedPath = await page.evaluate(() => (window as any).__clipboardText);
  expect(copiedPath).toBe(String.raw`["a.\"b\c"]`);
  await expect
    .poll(() =>
      page.evaluate(
        (path) => (window as any).__editorGateParsePath(path),
        copiedPath,
      ),
    )
    .toEqual(['a."b\\c']);
});

test("copy subtree preserves selected source tokens exactly", async ({
  page,
}) => {
  const json = String.raw`{"obj":{"n":9007199254740993,"s":"\u0061","decimal":1.2300}}`;
  await page.evaluate(() => {
    (window as any).__clipboardText = "";
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as any).__clipboardText = text;
        },
      },
    });
  });
  await source(page, json);
  await chooseView(page, "Tree");
  await page.getByRole("treeitem", { name: /obj/ }).last().click();
  const copySubtree = page.getByRole("button", {
    name: "Copy subtree",
    exact: true,
  });
  await copySubtree.hover();
  const subtreeTooltip = page.getByRole("tooltip", { name: "Copy subtree" });
  await expect(subtreeTooltip).toBeVisible();
  await copySubtree.click();
  expect(await page.evaluate(() => (window as any).__clipboardText)).toBe(
    String.raw`{"n":9007199254740993,"s":"\u0061","decimal":1.2300}`,
  );
});

test("source edits invalidate a prior tree selection for subtree copy", async ({
  page,
}) => {
  await source(page, '{"obj":{"old":1}}');
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.getByRole("treeitem", { name: /obj/ }).last().click();
  await expect(
    page.getByRole("button", { name: "Copy subtree", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await source(page, '{"obj":{"new":2}}');
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copy subtree", exact: true }),
  ).toBeDisabled();
});

test("chooses a responsive default without overriding an explicit view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Split", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 899, height: 800 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Code", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(
    page.getByRole("button", { name: "Tree", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("stacks narrow split and preserves source/history across view changes", async ({
  page,
}) => {
  await source(page, '{"a":1}');
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.getByRole("treeitem", { name: "a : 1", exact: true }).click();
  const selection = await page.getByTestId("tree-selection").textContent();
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText('{"a":1}');
  await expect(page.getByTestId("tree-selection")).toHaveText(selection!);
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(page.getByTestId("tree-selection")).toHaveText(selection!);
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.setViewportSize({ width: 500, height: 800 });
  const panes = page.locator(".panes");
  const geometry = await panes.evaluate((element) => {
    const sourcePane = element
      .querySelector('[aria-label="Source pane"]')!
      .getBoundingClientRect();
    const treePane = element
      .querySelector('[aria-label="Tree pane"]')!
      .getBoundingClientRect();
    return {
      stacked: treePane.top >= sourcePane.bottom,
      overflow: element.scrollWidth > element.clientWidth,
    };
  });
  expect(geometry).toEqual({ stacked: true, overflow: false });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText("{}");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText('{"a":1}');
});

test("exposes keyboard-operable divider and named, reachable layout controls", async ({
  page,
}) => {
  const split = page.getByRole("button", { name: "Split", exact: true });
  const code = page.getByRole("button", { name: "Code", exact: true });
  const tree = page.getByRole("button", { name: "Tree", exact: true });
  await expect(split).toHaveAttribute("aria-pressed", "true");
  await expect(code).toHaveAccessibleName("Code");
  const divider = page.getByRole("separator", { name: /Resize panes/ });
  await divider.focus();
  await expect(divider).toBeFocused();
  const initial = Number(await divider.getAttribute("aria-valuenow"));
  await page.keyboard.press("ArrowRight");
  expect(Number(await divider.getAttribute("aria-valuenow"))).toBeGreaterThan(
    initial,
  );
  await page.keyboard.press("Home");
  const minimum = await divider.getAttribute("aria-valuemin");
  expect(await divider.getAttribute("aria-valuenow")).toBe(minimum);
  await page.keyboard.press("End");
  const maximum = await divider.getAttribute("aria-valuemax");
  expect(await divider.getAttribute("aria-valuenow")).toBe(maximum);
  await tree.focus();
  await page.keyboard.press("Tab");
  await expect(divider).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".cm-content:visible").first()).toBeFocused();
});

test("honors system color preference and refreshes a hidden source editor", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect(page.locator("html")).toHaveCSS(
    "--editor-background",
    "#1e1e1e",
  );
  await source(page, '{"hidden":1}');
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.evaluate(() =>
    (window as any).__editorGatePatch([
      { op: "replace", path: "/hidden", value: 2 },
    ]),
  );
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(
    page.locator('[aria-label="Source pane"] .cm-content'),
  ).toContainText('"hidden": 2');
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveCSS("--editor-background", "#fff");
});

test("undo shortcut remains available after focusing source and tree controls", async ({
  page,
}) => {
  await source(page, '{"value":1}');
  await source(page, '{"value":2}');
  await page.keyboard.press("Control+z");
  await expect
    .poll(() =>
      page
        .getByTestId("source")
        .textContent()
        .then((text) => JSON.parse(text!).value),
    )
    .toBe(1);
  await page.keyboard.press("Control+Shift+z");
  await expect
    .poll(() =>
      page
        .getByTestId("source")
        .textContent()
        .then((text) => JSON.parse(text!).value),
    )
    .toBe(2);
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.getByRole("treeitem", { name: "value : 2", exact: true }).click();
  await page.keyboard.press("Control+z");
  await expect
    .poll(() =>
      page
        .getByTestId("source")
        .textContent()
        .then((text) => JSON.parse(text!).value),
    )
    .toBe(1);
});

test("keyboard navigation reaches and operates the divider and source editor", async ({
  page,
}) => {
  const split = page.getByRole("button", { name: "Split", exact: true });
  let splitFocused = false;
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    if (await split.evaluate((element) => element === document.activeElement)) {
      splitFocused = true;
      break;
    }
  }
  expect(splitFocused).toBe(true);
  await page.keyboard.press("Enter");
  await expect(split).toHaveAttribute("aria-pressed", "true");
  const divider = page.getByRole("separator", { name: "Resize panes" });
  let dividerFocused = false;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    if (
      await divider.evaluate((element) => element === document.activeElement)
    ) {
      dividerFocused = true;
      break;
    }
  }
  expect(dividerFocused).toBe(true);
  await page.keyboard.press("ArrowRight");
  const increased = Number(await divider.getAttribute("aria-valuenow"));
  expect(increased).toBeGreaterThan(50);
  await page.keyboard.press("Home");
  expect(await divider.getAttribute("aria-valuenow")).toBe("25");
  await page.keyboard.press("Tab");
  await expect(
    page.locator('[aria-label="Source pane"] .cm-content'),
  ).toBeFocused();
});
