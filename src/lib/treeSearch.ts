import type { JSONPatchDocument } from "immutable-json-patch";
import { parse, stringify, isLosslessNumber } from "lossless-json";
import type { SearchController, SearchSnapshot } from "./sourceSearch";
import {
  findFieldMatches,
  createSearchQuery,
  iterateFieldMatches,
  replaceFieldMatch,
  type FieldMatch,
  type SearchOptions,
} from "./sourceSearch";

export type TreeMatch = FieldMatch & {
  path: string[];
  field: "key" | "value";
  text: string;
};

// Yield even unmatched nodes so a controller can bound each traversal slice.
export function* iterateTreeMatches(
  json: unknown,
  options: SearchOptions,
): Generator<TreeMatch | undefined> {
  type Node = { path: string[]; value: unknown; key?: string };
  function* children(value: object, path: string[]): Generator<Node> {
    for (const key in value)
      if (Object.hasOwn(value, key))
        yield {
          path: [...path, key],
          value: (value as Record<string, unknown>)[key],
          key: Array.isArray(value) ? undefined : key,
        };
  }
  const pending: Iterator<Node>[] = [
    [{ path: [], value: json }][Symbol.iterator](),
  ];
  while (pending.length) {
    const next = pending[pending.length - 1].next();
    if (next.done) {
      pending.pop();
      continue;
    }
    const { path, value, key } = next.value;
    yield undefined;
    if (key !== undefined)
      for (const match of iterateFieldMatches(key, options))
        yield { ...match, path, field: "key", text: key };
    if (
      value !== null &&
      typeof value === "object" &&
      !isLosslessNumber(value)
    ) {
      pending.push(children(value, path));
    } else {
      const text = typeof value === "string" ? value : stringify(value);
      if (text !== undefined)
        for (const match of iterateFieldMatches(text, options))
          yield { ...match, path, field: "value", text };
    }
  }
}

export function collectTreeMatches(
  json: unknown,
  options: SearchOptions,
): TreeMatch[] {
  return [...iterateTreeMatches(json, options)].filter(
    (match): match is TreeMatch => match !== undefined,
  );
}

function pointer(path: string[]) {
  return path.length
    ? "/" +
        path
          .map((key) => key.replace(/~/g, "~0").replace(/\//g, "~1"))
          .join("/")
    : "";
}
function at(json: unknown, path: string[]): unknown {
  let value = json;
  for (const key of path) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key))
      throw new Error("Search results are stale");
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

export function planTreeReplacement(
  json: unknown,
  matches: TreeMatch[],
  options: SearchOptions,
): JSONPatchDocument {
  const groups = new Map<string, TreeMatch[]>();
  for (const match of matches) {
    const id = JSON.stringify([match.path, match.field]);
    const group = groups.get(id) ?? [];
    group.push(match);
    groups.set(id, group);
  }
  const edits = [...groups.values()]
    .map((group) => {
      const first = group[0];
      const original =
        first.field === "key" ? first.path.at(-1) : at(json, first.path);
      const text =
        typeof original === "string" ? original : stringify(original);
      if (text !== first.text) throw new Error("Search results are stale");
      let next = first.text;
      for (const match of group.sort((a, b) => b.from - a.from))
        next =
          next.slice(0, match.from) +
          replaceFieldMatch(first.text, match, options) +
          next.slice(match.to);
      let value: unknown = next;
      if (first.field === "value" && typeof original !== "string") {
        try {
          value = isLosslessNumber(original) ? parse(next) : JSON.parse(next);
        } catch {
          throw new Error(
            "Replacement is not a valid value of the original type",
          );
        }
        if (
          (isLosslessNumber(original)
            ? !isLosslessNumber(value)
            : typeof value !== typeof original) ||
          (original === null ? value !== null : value === null) ||
          (typeof value === "number" && !Number.isFinite(value))
        )
          throw new Error("Replacement must retain the original value type");
      }
      return { ...first, value, next };
    })
    .filter((edit) => edit.next !== edit.text);

  for (const edit of edits.filter((edit) => edit.field === "key")) {
    const parentPath = edit.path.slice(0, -1);
    const parent = at(json, parentPath) as object;
    const renames = new Map(
      edits
        .filter(
          (other) =>
            other.field === "key" &&
            pointer(other.path.slice(0, -1)) === pointer(parentPath),
        )
        .map((other) => [other.path.at(-1)!, other.next]),
    );
    const names = Object.keys(parent).map((key) => renames.get(key) ?? key);
    if (new Set(names).size !== names.length)
      throw new Error("Replacement would create a duplicate key");
    if (Object.hasOwn(parent, edit.next) && edit.next !== edit.path.at(-1))
      throw new Error("Rename into an existing key is not supported");
  }
  const operations: JSONPatchDocument = [];
  // Values at a renamed path must be updated before that path moves.
  edits.sort(
    (a, b) => b.path.length - a.path.length || (a.field === "value" ? -1 : 1),
  );
  if (
    edits.some(
      (edit) =>
        edit.path.some((key) =>
          ["__proto__", "constructor", "prototype"].includes(key),
        ) ||
        (edit.field === "key" &&
          ["__proto__", "constructor", "prototype"].includes(edit.next)),
    )
  ) {
    let result = parse(stringify(json)!);
    for (const edit of edits) {
      if (!edit.path.length) {
        result = edit.value;
        continue;
      }
      const parent = at(result, edit.path.slice(0, -1)) as Record<
        string,
        unknown
      >;
      const key = edit.path.at(-1)!;
      if (edit.field === "key") {
        Object.defineProperty(parent, edit.next, {
          value: parent[key],
          enumerable: true,
          writable: true,
          configurable: true,
        });
        delete parent[key];
      } else
        Object.defineProperty(parent, key, {
          value: edit.value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
    }
    return [{ op: "replace", path: "", value: result }];
  }
  for (const edit of edits) {
    const path = pointer(edit.path);
    if (edit.field === "key")
      operations.push({
        op: "move",
        from: path,
        path: pointer([...edit.path.slice(0, -1), edit.next]),
      });
    else operations.push({ op: "replace", path, value: edit.value });
  }
  return operations;
}

export type TreeSearchHost = {
  source(): string;
  revision(): number;
  isProcessing(): boolean;
  available(): boolean;
  apply(operations: JSONPatchDocument): void;
  reveal(match: TreeMatch): void;
  focus(): void;
  undo(): void;
  visibility(open: boolean): void;
};

export function createTreeSearch(host: TreeSearchHost): SearchController {
  let options: SearchOptions = {
    search: "",
    replace: "",
    regexp: false,
    caseSensitive: false,
    wholeWord: false,
    preserveCase: false,
  };
  let expanded = false,
    opened = false,
    destroyed = false,
    current = 0;
  let matches: TreeMatch[] = [],
    error: string | undefined,
    feedback = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0,
    scannedRevision = -1,
    scannedSource = "";
  let replacementRevision: number | undefined;
  const listeners = new Set<(snapshot: SearchSnapshot) => void>();
  const snapshot = (): SearchSnapshot => ({
    options: { ...options },
    expanded,
    counting: timer !== undefined,
    current,
    total: matches.length,
    error,
    feedback,
    processing: host.isProcessing() || !host.available(),
    canUndoReplacement:
      replacementRevision !== undefined &&
      replacementRevision === host.revision(),
  });
  function notify() {
    for (const listener of listeners) listener(snapshot());
  }
  function cancel() {
    generation++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function recount() {
    cancel();
    matches = [];
    current = 0;
    error = undefined;
    if (!opened || destroyed || !host.available() || !options.search) {
      notify();
      return;
    }
    const token = generation,
      revision = host.revision(),
      source = host.source();
    let iterator: ReturnType<typeof iterateTreeMatches> | undefined;
    const found: TreeMatch[] = [];
    function count() {
      if (destroyed || token !== generation) return;
      if (
        revision !== host.revision() ||
        source !== host.source() ||
        !host.available()
      ) {
        recount();
        return;
      }
      try {
        // ponytail: parsing and one native regex advance remain synchronous; move to a worker if large-field latency matters.
        if (!iterator) findFieldMatches("", options);
        iterator ??= iterateTreeMatches(parse(source), options);
        for (let i = 0; i < 500; i++) {
          const next = iterator.next();
          if (next.done) {
            timer = undefined;
            matches = found;
            scannedRevision = revision;
            scannedSource = source;
            current = matches.length ? 1 : 0;
            if (matches.length) host.reveal(matches[0]);
            notify();
            return;
          }
          if (next.value) found.push(next.value);
        }
        timer = setTimeout(count, 0);
      } catch (cause) {
        timer = undefined;
        error = cause instanceof Error ? cause.message : String(cause);
        notify();
      }
    }
    timer = setTimeout(count, 0);
    notify();
  }
  const controller: SearchController = {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    open(replace = false) {
      if (destroyed || !host.available()) return;
      opened = true;
      expanded ||= replace;
      host.visibility(true);
      recount();
    },
    close() {
      opened = false;
      cancel();
      expanded = false;
      host.visibility(false);
      host.focus();
      notify();
    },
    configure(next) {
      const changed =
        next.search !== options.search ||
        next.regexp !== options.regexp ||
        next.caseSensitive !== options.caseSensitive ||
        next.wholeWord !== options.wholeWord;
      options = { ...next };
      feedback = "";
      if (changed) recount();
      else {
        error = createSearchQuery(options).valid
          ? undefined
          : "Invalid regular expression";
        notify();
      }
    },
    expand(value) {
      expanded = value;
      notify();
    },
    next(backward = false) {
      if (timer !== undefined || !matches.length || !host.available()) return;
      if (
        scannedRevision !== host.revision() ||
        scannedSource !== host.source()
      ) {
        recount();
        return;
      }
      current =
        ((current - 1 + (backward ? -1 : 1) + matches.length) %
          matches.length) +
        1;
      host.reveal(matches[current - 1]);
      notify();
    },
    replace(all = false) {
      if (
        destroyed ||
        !opened ||
        timer !== undefined ||
        host.isProcessing() ||
        !host.available() ||
        !matches.length ||
        error
      )
        return;
      if (
        scannedRevision !== host.revision() ||
        scannedSource !== host.source()
      ) {
        recount();
        return;
      }
      try {
        const selected = all ? matches : [matches[current - 1] ?? matches[0]];
        const operations = planTreeReplacement(
          parse(scannedSource),
          selected,
          options,
        );
        if (!operations.length) return;
        if (
          scannedRevision !== host.revision() ||
          !host.available() ||
          host.isProcessing()
        ) {
          recount();
          return;
        }
        host.apply(operations);
        replacementRevision = host.revision();
        feedback = `Replaced ${selected.length} ${selected.length === 1 ? "match" : "matches"}`;
        recount();
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
        notify();
      }
    },
    undoReplacement() {
      if (replacementRevision === host.revision()) {
        replacementRevision = undefined;
        feedback = "";
        host.undo();
      }
      notify();
    },
    documentChanged() {
      if (replacementRevision !== host.revision()) {
        replacementRevision = undefined;
        feedback = "";
      }
      recount();
    },
    sync() {
      if (!host.available()) {
        cancel();
        matches = [];
        current = 0;
        notify();
      } else if (opened && scannedRevision !== host.revision()) recount();
      else notify();
    },
    destroy() {
      destroyed = true;
      cancel();
      listeners.clear();
    },
  };
  return controller;
}
