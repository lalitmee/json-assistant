import {
  applyEdits,
  createScanner,
  format,
  visit,
  printParseErrorCode,
} from "jsonc-parser";
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
const TREE_EDIT_TOKEN_LIMIT = 100_000;
const K = {
  openBrace: 1,
  closeBrace: 2,
  openBracket: 3,
  closeBracket: 4,
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
  const maxNodesLimit = limits.maxNodes ?? TREE_EDIT_TOKEN_LIMIT;
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
      if (operation === "minify" && nodes < maxNodesLimit)
        tokens.push({ offset, length: scanner.getTokenLength() });
      nodes++;
      if (token === K.openBrace || token === K.openBracket)
        maxDepth = Math.max(maxDepth, ++depth);
      if (token === K.closeBrace || token === K.closeBracket) depth--;
      if (maxDepth > maxDepthLimit) {
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

  const keys: Set<string>[] = [];
  let syntaxError: Diagnostic | undefined;
  let duplicate: Diagnostic | undefined;
  if (!diagnostics.length)
    visit(
      source,
      {
        onObjectBegin: () => {
          keys.push(new Set());
        },
        onObjectEnd: () => {
          keys.pop();
        },
        onObjectProperty: (key, offset, _length, line, column) => {
          const scope = keys.at(-1)!;
          if (!duplicate && scope.has(key))
            duplicate = {
              kind: "duplicate",
              message: `Duplicate key ${JSON.stringify(key)}`,
              offset,
              line: line + 1,
              column: column + 1,
            };
          scope.add(key);
        },
        onError: (code, offset, _length, line, column) => {
          syntaxError ??= {
            kind: "syntax",
            message: printParseErrorCode(code),
            offset,
            line: line + 1,
            column: column + 1,
          };
        },
      },
      {
        disallowComments: true,
        allowTrailingComma: false,
        allowEmptyContent: false,
      },
    );
  const error = syntaxError ?? duplicate;
  if (error) diagnostics.push(error);
  const valid = diagnostics.length === 0;
  const unavailable = maxDepth > maxDepthLimit;
  const inspect = nodes > maxNodesLimit;
  const analysis: Analysis = {
    revision,
    bytes,
    valid,
    diagnostics,
    depth: maxDepth,
    nodes,
    mode: unavailable ? "unavailable" : inspect ? "inspect" : "edit",
  };
  if (operation === "analyze" || !valid || inspect) return { analysis };
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
