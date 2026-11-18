import type { Page } from "@playwright/test";

export async function enableTreeEditing(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "json-workspace.preferences.v2",
      JSON.stringify({ version: 2, treeEditing: true }),
    );
  });
}
