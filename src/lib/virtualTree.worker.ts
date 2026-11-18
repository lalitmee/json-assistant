import {
  createVirtualTree,
  type TreeRequest,
  type TreeResponse,
} from "./virtualTree";

let tree: ReturnType<typeof createVirtualTree> | undefined;

self.onmessage = ({ data }: MessageEvent<TreeRequest>) => {
  try {
    let result: TreeResponse;
    if (data.kind === "load") {
      tree = createVirtualTree(data.source);
      result = { kind: "root", root: tree.root };
    } else if (!tree) return;
    else if (data.kind === "page")
      result = { kind: "page", page: tree.page(data.parent, data.start) };
    else result = tree.find(data.query);
    self.postMessage(result);
  } catch {
    self.postMessage({ kind: "error" } satisfies TreeResponse);
  }
};
