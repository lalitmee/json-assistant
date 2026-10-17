import { expect, test } from "@playwright/test";

test("synthetic payload stays local and download contains exact source", async ({
  page,
}) => {
  const canary = "synthetic-privacy-canary-7f3c";
  const unexpected: string[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith("http://127.0.0.1:5173/")) unexpected.push(url);
    return route.continue();
  });
  await page.goto("/");
  await page.evaluate(() => {
    const forbidden = ((window as any).__privacy = { storage: 0 });
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const setItem = storage.setItem.bind(storage);
      storage.setItem = (...args) => {
        forbidden.storage++;
        setItem(...args);
      };
    }
    (window as any).WebSocket = class {
      constructor() {
        throw new Error("unexpected websocket");
      }
    };
    (navigator as any).sendBeacon = () => {
      throw new Error("unexpected beacon");
    };
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => undefined },
    });
  });
  const payload = JSON.stringify({ synthetic: canary });
  const editor = page.locator('[aria-label="Source pane"] .cm-content');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText(payload);
  await expect(page.getByTestId("source")).toHaveText(payload);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByPlaceholder("Find").fill(canary);
  await page.getByRole("button", { name: "Format", exact: true }).click();
  await page.evaluate(() => history.replaceState(null, "", location.pathname));
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const file = await download;
  const fs = await import("node:fs/promises");
  expect(await fs.readFile((await file.path())!, "utf8")).toBe(`{
  "synthetic": "synthetic-privacy-canary-7f3c"
}`);
  expect(new URL(page.url()).search + new URL(page.url()).hash).not.toContain(
    canary,
  );
  expect(await page.evaluate(() => (window as any).__privacy.storage)).toBe(0);
  expect(unexpected).toEqual([]);
});
