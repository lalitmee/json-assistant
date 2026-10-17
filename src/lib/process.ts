import {
  applyEdits,
  createScanner,
  format,
  parse as parseJsonc,
  printParseErrorCode,
} from "jsonc-parser";
import type { ParseErrorCode } from "jsonc-parser";
import type { Analysis, Diagnostic } from "./document";

export type ProcessRequest = {
  revision: number;
  source: string;
  operation: "analyze" | "format" | "minify";
};
export type ProcessResult = { analysis: Analysis; source?: string };
export type ProcessLimits = {
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
};

const MAX_DEPTH = 256;
const MAX_NODES = 100_000;
const K = {
  openBrace: 1,
  closeBrace: 2,
  openBracket: 3,
  closeBracket: 4,
  comma: 5,
  lineComment: 12,
  blockComment: 13,
  lineBreak: 14,
  trivia: 15,
  eof: 17,
};

function position(source: string, offset: number) {
  const lines = source.slice(0, offset).split("\n");
  return { line: lines.length, column: lines.at(-1)!.length + 1 };
}

export function processSource(
  request: ProcessRequest,
  limits: ProcessLimits = {},
): ProcessResult {
  const { source, revision, operation } = request;
  const maxDepthLimit = limits.maxDepth ?? MAX_DEPTH;
  const maxNodesLimit = limits.maxNodes ?? MAX_NODES;
  const maxBytesLimit = limits.maxBytes ?? Infinity;
  const bytes = new TextEncoder().encode(source).length;
  const diagnostics: Diagnostic[] = [];
  let depth = 0,
    maxDepth = 0,
    nodes = 0;
  const scanner = createScanner(source, false);
  if (bytes > maxBytesLimit) {
    const analysis: Analysis = {
      revision,
      bytes,
      valid: false,
      diagnostics: [
        {
          kind: "syntax",
          message:
            "Document exceeds the resource limit; source export remains available",
          offset: 0,
          line: 1,
          column: 1,
        },
      ],
      depth: 0,
      nodes: 0,
      mode: "unavailable",
    };
    return { analysis };
  }
  const tokens: Array<{ offset: number; length: number }> = [];
  let token: number;
  do {
    token = scanner.scan();
    const offset = scanner.getTokenOffset();
    if (scanner.getTokenError() !== 0) {
      const p = position(source, offset);
      diagnostics.push({
        kind: "syntax",
        message: "Invalid JSON token",
        offset,
        ...p,
      });
      break;
    }
    if (token === K.lineComment || token === K.blockComment) {
      const p = position(source, offset);
      diagnostics.push({
        kind: "syntax",
        message: "Comments are not valid JSON",
        offset,
        ...p,
      });
      break;
    }
    if (![K.trivia, K.lineBreak, K.eof].includes(token)) {
      tokens.push({ offset, length: scanner.getTokenLength() });
      nodes++;
      if (token === K.openBrace || token === K.openBracket)
        maxDepth = Math.max(maxDepth, ++depth);
      if (token === K.closeBrace || token === K.closeBracket) depth--;
      if (maxDepth > maxDepthLimit || nodes > maxNodesLimit) {
        const p = position(source, offset);
        diagnostics.push({
          kind: "syntax",
          message: "JSON exceeds safe processing limits",
          offset,
          ...p,
        });
        break;
      }
    }
  } while (token !== K.eof);

  const errors: { error: ParseErrorCode; offset: number; length: number }[] =
    [];
  if (!diagnostics.length)
    parseJsonc(source, errors, {
      disallowComments: true,
      allowTrailingComma: false,
      allowEmptyContent: false,
    });
  if (!diagnostics.length && errors.length) {
    const { error, offset } = errors[0];
    diagnostics.push({
      kind: "syntax",
      message: printParseErrorCode(error),
      offset,
      ...position(source, offset),
    });
  }
  let valid = diagnostics.every((d) => d.kind !== "syntax");
  if (valid) {
    // Use a small structural walk over tokens for decoded keys and object scopes.
    const stacks: Array<{ keys: Set<string>; expectKey: boolean }> = [];
    for (const part of tokens) {
      const kind = source[part.offset];
      if (kind === "{") stacks.push({ keys: new Set(), expectKey: true });
      else if (kind === "}") stacks.pop();
      else if (kind === ",") {
        const frame = stacks.at(-1);
        if (frame && frame.keys) frame.expectKey = true;
      } else if (kind === '"' && stacks.at(-1)?.expectKey) {
        const key = JSON.parse(
          source.slice(part.offset, part.offset + part.length),
        ) as string;
        const frame = stacks.at(-1)!;
        if (frame.keys.has(key))
          diagnostics.push({
            kind: "duplicate",
            message: `Duplicate key ${JSON.stringify(key)}`,
            offset: part.offset,
            ...position(source, part.offset),
          });
        frame.keys.add(key);
        frame.expectKey = false;
      } else if (kind === "[")
        stacks.push({ keys: new Set(), expectKey: false });
      else if (kind === "]") stacks.pop();
      else if (kind === ":") {
        /* next token is the property's value */
      }
    }
  }
  valid = diagnostics.length === 0;
  const unavailable =
    diagnostics[0]?.message.includes("safe processing limits") ?? false;
  const analysis: Analysis = {
    revision,
    bytes,
    valid,
    diagnostics,
    depth: maxDepth,
    nodes,
    mode: unavailable ? "unavailable" : "edit",
  };
  if (operation === "analyze" || !valid) return { analysis };
  if (operation === "format")
    return {
      analysis,
      source: applyEdits(
        source,
        format(source, undefined, {
          insertSpaces: true,
          tabSize: 2,
          eol: "\n",
        }),
      ),
    };
  return {
    analysis,
    source: tokens
      .map((t) => source.slice(t.offset, t.offset + t.length))
      .join(""),
  };
}
