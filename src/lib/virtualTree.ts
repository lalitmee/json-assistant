import { parseTree, type Node } from "jsonc-parser";

export const treePageSize = 200;

export type TreeRow = {
  offset: number;
  length: number;
  label: string;
  preview: string;
  count: number;
};

export type TreePage = { parent: number; start: number; rows: TreeRow[] };
export type TreeRequest =
  | { kind: "load"; source: string }
  | { kind: "page"; parent: number; start: number }
  | { kind: "find"; query: string };
export type TreeResponse =
  | { kind: "root"; root: TreeRow }
  | { kind: "page"; page: TreePage }
  | { kind: "match"; offset: number; pages: TreePage[] }
  | { kind: "end" }
  | { kind: "error" };

function childValue(node: Node): Node {
  return node.type === "property" ? node.children![1] : node;
}

export function createVirtualTree(source: string) {
  const parsed = parseTree(source);
  if (!parsed) throw new Error("Missing JSON root");
  const root: Node = parsed;
  let previousQuery = "";
  let results: Generator<TreeResponse> | undefined;

  function row(node: Node, index: number): TreeRow {
    const value = childValue(node);
    const count = value.children?.length ?? 0;
    return {
      offset: value.offset,
      length: value.length,
      label:
        node.type === "property"
          ? String(node.children![0].value).slice(0, 160)
          : index < 0
            ? "$"
            : String(index),
      preview:
        value.type === "object"
          ? `{${count}}`
          : value.type === "array"
            ? `[${count}]`
            : source.slice(
                value.offset,
                value.offset + Math.min(value.length, 160),
              ) + (value.length > 160 ? "…" : ""),
      count,
    };
  }

  function nodeAtOffset(offset: number): Node | undefined {
    let current = root;
    while (current.offset !== offset) {
      const children = current.children;
      if (!children) return;
      let low = 0;
      let high = children.length;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (childValue(children[mid]).offset <= offset) low = mid + 1;
        else high = mid;
      }
      if (low === 0) return;
      const child = childValue(children[low - 1]);
      if (offset >= child.offset + child.length) return;
      current = child;
    }
    return current;
  }

  function page(parent: number, start: number): TreePage {
    const children = nodeAtOffset(parent)?.children ?? [];
    return {
      parent,
      start,
      rows: children
        .slice(start, start + treePageSize)
        .map((node, index) => row(node, start + index)),
    };
  }

  function* search(query: string): Generator<TreeResponse> {
    const stack = [{ node: root, index: -1 }];
    const needle = query.toLowerCase();
    while (stack.length) {
      const frame = stack.at(-1)!;
      const value = childValue(frame.node);
      if (frame.index === -1) {
        frame.index = 0;
        const key =
          frame.node.type === "property" ? frame.node.children![0].value : "";
        const text =
          value.type === "string"
            ? value.value
            : value.children
              ? ""
              : source.slice(value.offset, value.offset + value.length);
        if (
          key.toLowerCase().includes(needle) ||
          text.toLowerCase().includes(needle)
        ) {
          const pages = [];
          for (const ancestor of stack.slice(0, -1)) {
            const node = childValue(ancestor.node);
            const start =
              Math.floor((ancestor.index - 1) / treePageSize) * treePageSize;
            pages.push(page(node.offset, start));
          }
          yield { kind: "match", offset: value.offset, pages };
        }
      }
      const child = value.children?.[frame.index++];
      if (child) stack.push({ node: child, index: -1 });
      else stack.pop();
    }
  }

  return {
    root: row(root, -1),
    page,
    find(query: string): TreeResponse {
      if (query !== previousQuery || !results) {
        previousQuery = query;
        results = search(query);
      }
      const next = results.next();
      if (!next.done) return next.value;
      results = undefined;
      return { kind: "end" };
    },
  };
}
