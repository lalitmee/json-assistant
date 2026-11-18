import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("opens a broad JSON file and finds a value outside the loaded tree page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const source = `[${"0,".repeat(524_287)}{"deep":{"value":"last entry"}}]`;
  await page.locator('input[type="file"]').setInputFiles({
    name: "broad.json",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });

  const tree = page.getByRole("region", { name: "Tree pane" });
  await expect(page.getByRole("region", { name: "Source pane" })).toBeVisible();
  await expect(page.getByText(/^Valid JSON · \d+ bytes$/)).toBeVisible();
  await expect(tree.getByText("1–200 of 524288")).toBeVisible();
  await tree.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tree.getByText("201–400 of 524288")).toBeVisible();

  await tree
    .getByRole("searchbox", { name: "Find in tree" })
    .fill("last entry");
  await tree.getByRole("button", { name: "Find next" }).click();
  await expect(
    tree.getByRole("button", { name: 'value "last entry"' }),
  ).toHaveAttribute("aria-pressed", "true");
  await tree.getByRole("button", { name: "Collapse deep" }).click();
  await expect(
    tree.getByRole("button", { name: 'value "last entry"' }),
  ).toHaveCount(0);
  await tree.getByRole("button", { name: "Expand deep" }).click();
  await expect(
    tree.getByRole("button", { name: 'value "last entry"' }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("broad.json");
  expect(await readFile(await download.path(), "utf8")).toBe(source);
  expect(errors).toEqual([]);
});
