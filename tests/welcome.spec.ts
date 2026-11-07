import { expect, test } from "@playwright/test";

test.describe("Welcome Hero landing state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders centered welcome hero on clean initial launch", async ({
    page,
  }) => {
    const hero = page.getByRole("region", {
      name: "Welcome to JSON Assistant",
    });
    await expect(hero).toBeVisible();

    // Verify brand header
    await expect(
      hero.getByRole("heading", { name: "JSON Assistant" }),
    ).toBeVisible();
    await expect(
      hero.getByText("100% in-browser processing, no server uploads"),
    ).toBeVisible();

    // Verify action tiles
    await expect(
      hero.getByRole("button", { name: "Browse File", exact: true }),
    ).toBeVisible();
    await expect(hero.getByText(/Browse your device or drop/)).toBeVisible();
    await expect(
      hero.getByRole("button", { name: "Paste from Clipboard", exact: true }),
    ).toBeVisible();
    await expect(hero.getByText(/Paste from clipboard or use/)).toBeVisible();

    // Verify secondary blank link
    await expect(
      hero.getByRole("button", { name: /start with a blank document/i }),
    ).toBeVisible();

    // Workbench and workspace header should be hidden
    await expect(page.locator(".workspace > .workspace-header")).toBeHidden();
    await expect(page.locator(".workbench-wrapper")).toBeHidden();
  });

  test("start with a blank document transitions to the full workbench", async ({
    page,
  }) => {
    const hero = page.getByRole("region", {
      name: "Welcome to JSON Assistant",
    });
    await expect(hero).toBeVisible();

    await hero
      .getByRole("button", { name: /start with a blank document/i })
      .click();

    // Hero should be gone, workbench and header visible
    await expect(hero).toHaveCount(0);
    await expect(page.locator(".workspace > .workspace-header")).toBeVisible();
    await expect(page.locator(".workbench-wrapper")).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /document\.json/ }),
    ).toBeVisible();
    await expect(page.getByTestId("source")).toHaveText("{}");
  });

  test("opening a JSON file from the welcome hero loads content and enters workbench", async ({
    page,
  }) => {
    const fileContent = JSON.stringify({
      project: "json-assistant",
      welcome: true,
    });
    await page.locator("input[type=file]").setInputFiles({
      name: "welcome-test.json",
      mimeType: "application/json",
      buffer: Buffer.from(fileContent),
    });

    // Welcome hero should dismiss automatically when file is loaded
    await expect(
      page.getByRole("region", { name: "Welcome to JSON Assistant" }),
    ).toHaveCount(0);
    await expect(page.locator(".workspace > .workspace-header")).toBeVisible();
    await expect(page.locator(".workbench-wrapper")).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /welcome-test\.json/ }),
    ).toBeVisible();
    await expect(page.getByTestId("source")).toHaveText(fileContent);
  });

  test("pasting JSON from clipboard dismisses welcome hero and enters workbench", async ({
    page,
  }) => {
    const pastedJson = JSON.stringify({ action: "paste", success: true });
    await page.evaluate((text) => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          readText: async () => text,
          writeText: async () => undefined,
        },
        configurable: true,
      });
    }, pastedJson);

    const hero = page.getByRole("region", {
      name: "Welcome to JSON Assistant",
    });
    await hero.getByRole("button", { name: "Paste from Clipboard" }).click();

    await expect(hero).toHaveCount(0);
    await expect(page.locator(".workspace > .workspace-header")).toBeVisible();
    await expect(page.locator(".workbench-wrapper")).toBeVisible();
    await expect(page.getByTestId("source")).toHaveText(pastedJson);
  });

  test("drag-and-drop file onto welcome hero opens document", async ({
    page,
  }) => {
    const hero = page.getByRole("region", {
      name: "Welcome to JSON Assistant",
    });
    await expect(hero).toBeVisible();

    const container = page.locator(".welcome-container");

    // Verify dragover state styling via data-dragging
    await page.evaluate(() => {
      const heroEl = document.querySelector(".welcome-hero");
      heroEl?.dispatchEvent(
        new DragEvent("dragover", {
          dataTransfer: new DataTransfer(),
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(container).toHaveAttribute("data-dragging", "true");

    await page.evaluate(() => {
      const heroEl = document.querySelector(".welcome-hero");
      heroEl?.dispatchEvent(
        new DragEvent("dragleave", { bubbles: true, cancelable: true }),
      );
    });
    await expect(container).toHaveAttribute("data-dragging", "false");

    // Drop file
    const droppedContent = JSON.stringify({ dropped: true, count: 42 });
    const buffer = Buffer.from(droppedContent).toString("base64");
    await page.evaluate(
      ({ b64, name }) => {
        const byteCharacters = atob(b64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const file = new File([byteArray], name, { type: "application/json" });
        const dt = new DataTransfer();
        dt.items.add(file);

        const heroEl = document.querySelector(".welcome-hero");
        heroEl?.dispatchEvent(
          new DragEvent("drop", {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      { b64: buffer, name: "dropped.json" },
    );

    await expect(hero).toHaveCount(0);
    await expect(page.locator(".workspace > .workspace-header")).toBeVisible();
    await expect(page.locator(".workbench-wrapper")).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /dropped\.json/ }),
    ).toBeVisible();
    await expect(page.getByTestId("source")).toHaveText(droppedContent);
  });
});
