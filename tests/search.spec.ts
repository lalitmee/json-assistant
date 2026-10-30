import { expect, test } from "@playwright/test";

test("Tree search reveals collapsed fields, keeps focus, and restores Tree on Escape", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    (window as any).__benchmarkLoad('{"outer":{"name":"cat cat"}}'),
  );
  await page.getByRole("button", { name: "Collapse all", exact: true }).click();
  const tree = page.getByRole("region", { name: "Tree pane", exact: true });
  await tree.focus();
  await page.keyboard.press("ControlOrMeta+f");
  const panel = page.getByRole("search", {
    name: "Search in tree",
    exact: true,
  });
  const find = panel.getByRole("searchbox");
  await expect(find).toBeFocused();
  await tree.focus();
  await page.keyboard.press("ControlOrMeta+f");
  await expect(find).toBeFocused();
  await find.fill("cat");
  await expect(panel.getByText("1 of 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("tree-selection")).toContainText('"name"');
  await find.press("Enter");
  await expect(panel.getByText("2 of 2", { exact: true })).toBeVisible();
  await expect(find).toBeFocused();
  await expect(tree.locator(".jse-search-box")).toHaveCount(0);
  await find.press("Escape");
  await expect(panel).toHaveCount(0);
  expect(
    await tree.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
});

test("Tree replace all synchronizes both panes with one shared undo", async ({
  page,
}) => {
  await page.goto("/");
  const original = '{"cat":{"name":"cat cat"}}';
  await page.evaluate(
    (source) => (window as any).__benchmarkLoad(source),
    original,
  );
  await page
    .getByRole("button", { name: "Search fields", exact: true })
    .click();
  const panel = page.getByRole("search", {
    name: "Search in tree",
    exact: true,
  });
  await panel.getByRole("searchbox").fill("cat");
  await panel.getByRole("button", { name: "Toggle replacement" }).click();
  await panel.getByRole("textbox", { name: "Replace with" }).fill("dog");
  await panel.getByRole("button", { name: "Replace all (3)" }).click();
  await expect(page.getByTestId("source")).toHaveText(
    JSON.stringify({ dog: { name: "dog dog" } }, null, 2),
  );
  await expect(
    page.locator('[aria-label="Source pane"] .cm-content'),
  ).toContainText("dog dog");
  await expect(
    panel.getByRole("button", { name: "Undo replacement" }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Undo replacement" }).click();
  await expect(page.getByTestId("source")).toHaveText(original);
});

test("Tree replacement rejects key collisions and type changes without editing", async ({
  page,
}) => {
  await page.goto("/");
  const original = '{"cat":12,"dog":2}';
  await page.evaluate(
    (source) => (window as any).__benchmarkLoad(source),
    original,
  );
  await page
    .getByRole("button", { name: "Search fields", exact: true })
    .click();
  const panel = page.getByRole("search", {
    name: "Search in tree",
    exact: true,
  });
  await panel.getByRole("searchbox").fill("cat");
  await panel.getByRole("button", { name: "Toggle replacement" }).click();
  await panel.getByRole("textbox", { name: "Replace with" }).fill("dog");
  await panel.getByRole("button", { name: "Replace all (1)" }).click();
  await expect(panel.getByRole("status")).toContainText("duplicate");
  await expect(page.getByTestId("source")).toHaveText(original);
  await panel.getByRole("searchbox").fill("12");
  await panel.getByRole("textbox", { name: "Replace with" }).fill("true");
  await panel.getByRole("button", { name: "Replace all (1)" }).click();
  await expect(panel.getByRole("status")).toContainText("type");
  await expect(page.getByTestId("source")).toHaveText(original);
});

test("Tree search history restores drafts and stays separate from Code", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => (window as any).__benchmarkLoad('{"a":"cat dog"}'));
  await page
    .getByRole("button", { name: "Search fields", exact: true })
    .click();
  const treeFind = page
    .getByRole("search", { name: "Search in tree", exact: true })
    .getByRole("searchbox");
  await treeFind.fill("cat");
  await treeFind.press("Enter");
  await treeFind.fill("draft");
  await treeFind.press("ArrowUp");
  await expect(treeFind).toHaveValue("cat");
  await treeFind.press("ArrowDown");
  await expect(treeFind).toHaveValue("draft");
  await treeFind.press("Escape");
  await page
    .getByRole("button", { name: "Keyboard shortcuts", exact: true })
    .focus();
  await page.keyboard.press("ControlOrMeta+f");
  await expect(
    page
      .getByRole("search", { name: "Search in source", exact: true })
      .getByRole("searchbox"),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Search fields", exact: true })
    .click();
  await treeFind.press("ArrowUp");
  await expect(treeFind).toHaveValue("draft");
});

test("global find opens source search from the header and help restores focus", async ({
  page,
}) => {
  await page.goto("/");
  const help = page.getByRole("button", {
    name: "Keyboard shortcuts",
    exact: true,
  });
  await help.focus();
  await page.keyboard.press("ControlOrMeta+f");
  await expect(
    page.getByRole("searchbox", { name: "Find in source" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Search in source" }),
  ).toHaveCount(0);
  await help.click();
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Search" })).toBeVisible();
  await expect(dialog.getByText("Fold code", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(help).toBeFocused();
});

test("query changes never publish a completed zero count while counting", async ({
  page,
}) => {
  await page.goto("/");
  const states = await page.evaluate(async () => {
    // Exercise the real controller without relying on browser paint timing.
    const viewModule = "/node_modules/@codemirror/view/dist/index.js";
    const searchModule = "/src/lib/sourceSearch.ts";
    const { EditorView } = (await import(
      viewModule
    )) as typeof import("@codemirror/view");
    const { attachSourceSearch } = (await import(
      searchModule
    )) as typeof import("../src/lib/sourceSearch");
    const root = document.createElement("div");
    document.body.append(root);
    const view = new EditorView({ doc: "cat cat", parent: root });
    const controller = attachSourceSearch(root, {
      isProcessing: () => false,
      revision: () => 0,
      undo() {},
    })!;
    const emitted: Array<{ counting: boolean; total: number }> = [];
    const unsubscribe = controller.subscribe((state) => {
      if (state.options.search)
        emitted.push({ counting: state.counting, total: state.total });
    });
    controller.configure({ ...controller.snapshot().options, search: "cat" });
    await new Promise((resolve) => setTimeout(resolve, 30));
    controller.configure({ ...controller.snapshot().options, search: "ca" });
    await new Promise((resolve) => setTimeout(resolve, 30));
    unsubscribe();
    controller.destroy();
    view.destroy();
    root.remove();
    return emitted;
  });
  expect(states.length).toBeGreaterThan(0);
  expect(
    states.filter((state) => !state.counting && state.total === 0),
  ).toEqual([]);
  expect(states.at(-1)).toEqual({ counting: false, total: 2 });
});

test("source search can replace one match and undo it as one document edit", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText('{"name":"cat","other":"cat"}');

  await page.keyboard.press("ControlOrMeta+f");
  const find = page.getByRole("searchbox", { name: "Find in source" });
  await find.fill("cat");
  await expect(page.getByText("1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toggle replacement" }).click();
  await page.getByRole("textbox", { name: "Replace with" }).fill("dog");
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await expect(page.getByTestId("source")).toHaveText(
    '{"name":"dog","other":"cat"}',
  );

  await page.getByRole("button", { name: "Undo document change" }).click();
  await expect(page.getByTestId("source")).toHaveText(
    '{"name":"cat","other":"cat"}',
  );
});

test("replace all is one undoable edit and reports its replacement count", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText('{"a":"cat","b":"cat"}');
  await page.keyboard.press("ControlOrMeta+f");
  await page.getByRole("searchbox", { name: "Find in source" }).fill("(cat)");
  await page.getByRole("button", { name: "Regular expression" }).click();
  await expect(page.getByText("1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toggle replacement" }).click();
  await page.getByRole("textbox", { name: "Replace with" }).fill("$1!");
  await page.getByRole("button", { name: "Replace all (2)" }).click();
  await expect(page.getByTestId("source")).toHaveText(
    '{"a":"cat!","b":"cat!"}',
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Replaced 2 matches" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo document change" }).click();
  await expect(page.getByTestId("source")).toHaveText('{"a":"cat","b":"cat"}');
});

test("source shortcuts open search and invalid regex is reported", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+f");
  const find = page.getByRole("searchbox", { name: "Find in source" });
  await expect(find).toBeFocused();
  await find.fill("[");
  await page.getByRole("button", { name: "Regular expression" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Invalid regular expression" }),
  ).toBeVisible();
  await find.press("Escape");
  await expect(find).toHaveCount(0);
});

test("search controls follow the query and Enter keys navigate matches", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText('{"a":"cat","b":"cat"}');
  await page.keyboard.press("ControlOrMeta+f");

  const find = page.getByRole("searchbox", { name: "Find in source" });
  await expect(
    page.getByRole("button", { name: "Toggle replacement" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".find-field")
      .getByRole("button", { name: "Regular expression" }),
  ).toBeVisible();
  await expect(page.getByText("0 matches", { exact: true })).toHaveCount(0);
  await expect(page.locator(".search-status")).toHaveCount(0);
  await expect(page.locator(".search-row .match-count")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Previous match" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next match" })).toBeDisabled();
  await page.getByRole("button", { name: "Toggle replacement" }).click();
  await expect(
    page.getByRole("button", { name: "Replace", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Replace all (0)" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Toggle replacement" }).click();

  await find.fill("cat");
  const searchRow = page.locator(".search-row");
  await expect(
    page.getByRole("button", { name: "Toggle replacement" }),
  ).toBeVisible();
  for (const label of ["Case", "Word", "Regex"]) {
    await expect(searchRow.getByText(label, { exact: true })).toHaveCount(0);
  }
  await expect(
    searchRow.getByRole("button", { name: "Case sensitive" }),
  ).toBeVisible();
  await expect(
    searchRow.getByRole("button", { name: "Whole word" }),
  ).toBeVisible();
  await expect(
    searchRow.getByRole("button", { name: "Regular expression" }),
  ).toBeVisible();
  await expect(
    searchRow.getByRole("button", { name: "Close search" }),
  ).toBeVisible();
  await expect(searchRow.locator(".match-count")).toContainText("of 2");
  await expect(
    page.getByRole("button", { name: "Previous match" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next match" })).toBeVisible();
  await expect(find).toBeFocused();
  await find.press("Enter");
  await find.press("Enter");
  await expect(page.getByText("2 of 2", { exact: true })).toBeVisible();
  await find.press("Shift+Enter");
  await expect(page.getByText("1 of 2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Toggle replacement" }).click();
  await expect(page.locator(".search-row .match-count")).toBeVisible();
  const replaceWith = page.getByRole("textbox", { name: "Replace with" });
  await expect(
    page
      .locator(".replace-field")
      .getByRole("button", { name: "Preserve case" }),
  ).toBeVisible();
  await replaceWith.focus();
  await replaceWith.press("Escape");
  await expect(find).toHaveCount(0);
});

test("Up and Down browse submitted search history and restore the draft", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText('{"a":"cat","b":"dog"}');
  await page.keyboard.press("ControlOrMeta+f");
  const find = page.getByRole("searchbox", { name: "Find in source" });

  await find.fill("cat");
  await find.press("Enter");
  await find.fill("dog");
  await find.press("Enter");
  await find.fill("cat");
  await find.press("Enter");
  await find.fill("draft");

  await find.press("ArrowUp");
  await expect(find).toHaveValue("cat");
  await find.press("ArrowUp");
  await expect(find).toHaveValue("dog");
  await find.press("ArrowDown");
  await expect(find).toHaveValue("cat");
  await find.press("ArrowDown");
  await expect(find).toHaveValue("draft");

  await find.press("Escape");
  await page.keyboard.press("ControlOrMeta+f");
  await expect(find).toHaveValue("draft");
  await find.press("ArrowUp");
  await expect(find).toHaveValue("draft");
});

test("no-op replacement does not leave stale undo feedback", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText('{"name":"cat"}');
  await expect(page.getByTestId("source")).toHaveText('{"name":"cat"}');
  const initialRevision = await page.getByTestId("revision").textContent();

  await page.keyboard.press("ControlOrMeta+f");
  await page.getByRole("searchbox", { name: "Find in source" }).fill("cat");
  await page.getByRole("button", { name: "Toggle replacement" }).click();
  await page.getByRole("textbox", { name: "Replace with" }).fill("cat");
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await expect(page.getByTestId("revision")).toHaveText(initialRevision!);

  await editor.click();
  await editor.press("End");
  await page.keyboard.type(" ");
  await expect(page.getByTestId("source")).toHaveText('{"name":"cat"} ');
  await expect(
    page.getByRole("status").filter({ hasText: "Replaced 1 match" }),
  ).toHaveCount(0);
});

test("preserve case follows lowercase, uppercase, and title-case matches", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText("cat CAT Cat");
  await page.keyboard.press("ControlOrMeta+f");
  await page.getByRole("searchbox", { name: "Find in source" }).fill("cat");
  await page.getByRole("button", { name: "Toggle replacement" }).click();
  await page.getByRole("textbox", { name: "Replace with" }).fill("dog");
  await page.getByRole("button", { name: "Preserve case" }).click();
  await page.getByRole("button", { name: "Replace all (3)" }).click();

  await expect(page.getByTestId("source")).toHaveText("dog DOG Dog");
});

test("preserve case keeps regex capture replacement syntax", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText("cat CAT Cat");
  await page.keyboard.press("ControlOrMeta+f");
  await page.getByRole("searchbox", { name: "Find in source" }).fill("(cat)");
  await page.getByRole("button", { name: "Regular expression" }).click();
  await page.getByRole("button", { name: "Toggle replacement" }).click();
  await page.getByRole("textbox", { name: "Replace with" }).fill("$1 dog");
  await page.getByRole("button", { name: "Preserve case" }).click();
  await page.getByRole("button", { name: "Replace all (3)" }).click();

  await expect(page.getByTestId("source")).toHaveText(
    "cat dog CAT DOG Cat dog",
  );
});
