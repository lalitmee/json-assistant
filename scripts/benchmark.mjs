import { chromium, firefox } from "@playwright/test";
import { cpus, platform, release, totalmem } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";

const sizes = [100 * 1024, 1024 * 1024, 10 * 1024 * 1024, 100 * 1024 * 1024];
const shapes = ["broad", "deep", "string"];
const output = [];
const server = spawn(
  "yarn",
  ["dev", "--port", "5173", "--strictPort"],
  { stdio: "ignore" },
);
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    if ((await fetch("http://127.0.0.1:5173/")).ok) break;
  } catch {}
  if (server.exitCode !== null)
    throw new Error(`Vite server exited with ${server.exitCode}`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (attempt === 99) throw new Error("Vite server did not start");
}
function fixture(shape, target) {
  if (shape === "string")
    return JSON.stringify("x".repeat(Math.max(0, target - 2)));
  if (shape === "deep") {
    const depth = 300;
    return `${'{"x":'.repeat(depth)}${JSON.stringify("x".repeat(Math.max(0, target - depth * 6 - 2)))}${"}".repeat(depth)}`;
  }
  const count = Math.floor((target - 2) / 2);
  return `[${Array(count).fill("0").join(",")}]`;
}
function timeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`case timed out after ${ms} milliseconds`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
try {
  for (const [name, browserType] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ]) {
    const browser = await browserType.launch({ headless: true });
    try {
      const version = browser.version();
      for (const size of sizes)
        for (const shape of shapes) {
          const source = fixture(shape, size);
          const row = {
            browser: name,
            version,
            os: `${platform()} ${release()}`,
            cpu: cpus()[0]?.model,
            totalMemoryBytes: totalmem(),
            targetBytes: size,
            shape,
            bytes: Buffer.byteLength(source),
            depth:
              shape === "deep"
                ? Math.min(300, Math.max(1, Math.floor(size / 6)))
                : shape === "string" || shape === "broad"
                  ? 0
                  : null,
            outcome: "failed",
          };
          let context;
          try {
            if (!browser.isConnected())
              throw new Error("browser process exited during an earlier case");
            context = await browser.newContext();
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            const loadStart = performance.now();
            await page.goto("http://127.0.0.1:5173/", { timeout: 60_000 });
            row.loadMs = Math.round(performance.now() - loadStart);
            const started = performance.now();
            await timeout(
              page.evaluate(
                async (source) => window.__benchmarkLoad(source),
                source,
              ),
              60_000,
            );
            await page.waitForFunction(
              () =>
                document
                  .querySelector('[aria-label="Document status"]')
                  ?.textContent?.includes("UTF-8 bytes"),
              null,
              { timeout: 60_000 },
            );
            row.analyzeMs = Math.round(performance.now() - started);
            row.mode = await page
              .locator('[aria-label="Document status"]')
              .innerText();
            row.editorMounted =
              (await page.locator('[aria-label="Source pane"]').count()) > 0;
            row.errors = errors;
            row.outcome = errors.length ? "failed: page error" : "measured";
          } catch (error) {
            row.error = String(error);
            row.outcome = "failed";
          } finally {
            try {
              await context?.close();
            } catch (error) {
              row.closeError = String(error);
              row.outcome = "failed";
            }
          }
          output.push(row);
          console.log(JSON.stringify(row));
        }
    } finally {
      await browser.close();
    }
  }
} finally {
  await mkdir("benchmarks/generated", { recursive: true });
  await writeFile(
    "benchmarks/generated/results.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), output }, null, 2),
  );
  server.kill("SIGTERM");
}
