import { describe, expect, it, vi } from "vitest";
import { createProcessor } from "./processing";

function fakeWorker() {
  const worker = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  };
  return worker;
}

describe("createProcessor", () => {
  it("ignores late stale replies after a replacement revision", async () => {
    const worker = fakeWorker();
    const processor = createProcessor(() => worker as unknown as Worker);
    const first = processor.run({
      revision: 7,
      source: "{}",
      operation: "analyze",
    });
    const second = processor.run({
      revision: 8,
      source: "[]",
      operation: "analyze",
    });
    worker.onmessage!({ data: { analysis: { revision: 8 } } } as MessageEvent);
    worker.onmessage!({ data: { analysis: { revision: 7 } } } as MessageEvent);
    await expect(first).resolves.toMatchObject({ analysis: { revision: 7 } });
    await expect(second).resolves.toMatchObject({ analysis: { revision: 8 } });
  });
  it("cancels pending work by terminating, ignores late results, and replaces worker", async () => {
    const workers = [fakeWorker(), fakeWorker()];
    const firstWorker = workers[0];
    const nextWorker = workers[1];
    const processor = createProcessor(
      () => workers.shift() as unknown as Worker,
    );
    const pending = processor.run({
      revision: 1,
      source: "{}",
      operation: "analyze",
    });
    const oldMessage = firstWorker.onmessage!;
    processor.cancel();
    await expect(pending).resolves.toMatchObject({
      analysis: { revision: 1, valid: false },
    });
    expect(firstWorker.terminate).toHaveBeenCalledOnce();
    const next = processor.run({
      revision: 2,
      source: "{}",
      operation: "analyze",
    });
    oldMessage({ data: { analysis: { revision: 2 } } } as MessageEvent);
    nextWorker.onmessage!({
      data: { analysis: { revision: 2 } },
    } as MessageEvent);
    await expect(next).resolves.toMatchObject({ analysis: { revision: 2 } });
  });
  it("returns an actionable error while preserving the submitted source", async () => {
    const worker = fakeWorker();
    const processor = createProcessor(() => worker as unknown as Worker);
    const pending = processor.run({
      revision: 3,
      source: "{",
      operation: "format",
    });
    worker.onerror!({ message: "worker failed" } as ErrorEvent);
    await expect(pending).resolves.toMatchObject({
      analysis: {
        revision: 3,
        valid: false,
        diagnostics: [{ message: expect.stringContaining("worker failed") }],
      },
    });
  });
  it("disposes worker on teardown", () => {
    const worker = fakeWorker();
    const processor = createProcessor(() => worker as unknown as Worker);
    processor.run({ revision: 1, source: "{}", operation: "analyze" });
    processor.dispose();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
