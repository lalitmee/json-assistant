import { findNodeAtLocation, parseTree, type ParseError } from "jsonc-parser";
import { processSource } from "./process";
import type { Path } from "./document";

export function readFile(file: File, signal: AbortSignal): Promise<string> {
  if (signal.aborted)
    return Promise.reject(
      new DOMException("The operation was aborted", "AbortError"),
    );
  if (!Number.isSafeInteger(file.size))
    return Promise.reject(new Error("File size cannot be safely read"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    signal.addEventListener("abort", abort, { once: true });
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read file"));
    reader.onabort = () =>
      reject(new DOMException("The operation was aborted", "AbortError"));
    reader.onloadend = () => signal.removeEventListener("abort", abort);
    reader.readAsText(file);
  });
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new Error(
      "Clipboard access failed. Check browser clipboard permissions and try again.",
    );
  }
}

export function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json;charset=utf-8" }),
  );
  let clicked = false;
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    clicked = true;
  } finally {
    if (clicked) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    else URL.revokeObjectURL(url);
  }
}

export function subtreeSource(source: string, path: Path): string {
  if (
    !processSource({ source, revision: 0, operation: "analyze" }).analysis.valid
  )
    return "";
  const errors: ParseError[] = [];
  const root = parseTree(source, errors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false,
  });
  const node = root && findNodeAtLocation(root, path);
  return node ? source.slice(node.offset, node.offset + node.length) : "";
}
