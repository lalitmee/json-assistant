import {
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  StateEffect,
} from "@codemirror/state";
import { EditorView, type Panel } from "@codemirror/view";
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  RegExpCursor,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  searchPanelOpen,
  setSearchQuery,
} from "@codemirror/search";
import { mount, unmount } from "svelte";
import SearchPanel from "./SearchPanel.svelte";

export type SearchOptions = {
  search: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
  preserveCase: boolean;
};

export type SearchSnapshot = {
  options: SearchOptions;
  expanded: boolean;
  counting: boolean;
  current: number;
  total: number;
  error: string | undefined;
  feedback: string;
  canUndoReplacement: boolean;
  processing: boolean;
};

export type SearchController = {
  snapshot(): SearchSnapshot;
  subscribe(listener: (snapshot: SearchSnapshot) => void): () => void;
  open(replace?: boolean): void;
  close(): void;
  configure(options: SearchOptions): void;
  expand(expanded: boolean): void;
  next(backward?: boolean): void;
  replace(all?: boolean): void;
  undoReplacement(): void;
  documentChanged(): void;
  sync(): void;
  destroy(): void;
};

export type SearchHost = {
  isProcessing(): boolean;
  revision(): number;
  undo(): void;
};

const emptyOptions: SearchOptions = {
  search: "",
  replace: "",
  caseSensitive: false,
  wholeWord: false,
  regexp: false,
  preserveCase: false,
};

export function preserveCaseReplacement(match: string, replacement: string) {
  const letters = [...match].filter((character) => /\p{L}/u.test(character));
  if (!letters.length) return replacement;
  if (letters.every((character) => character === character.toUpperCase()))
    return replacement.toUpperCase();
  if (letters.every((character) => character === character.toLowerCase()))
    return replacement.toLowerCase();
  if (
    letters[0] === letters[0].toUpperCase() &&
    letters.slice(1).every((character) => character === character.toLowerCase())
  )
    return replacement
      .toLowerCase()
      .replace(/\p{L}/u, (character) => character.toUpperCase());
  return replacement;
}

export function createSearchQuery(options: SearchOptions): SearchQuery {
  return new SearchQuery({
    ...options,
    literal: !options.regexp,
  });
}

export type FieldMatch = {
  from: number;
  to: number;
  captures?: RegExpExecArray;
};

export function findFieldMatches(
  text: string,
  options: SearchOptions,
): FieldMatch[] {
  return [...iterateFieldMatches(text, options)];
}

export function* iterateFieldMatches(
  text: string,
  options: SearchOptions,
): Generator<FieldMatch> {
  if (!options.search) return;
  const state = EditorState.create({ doc: text });
  const query = createSearchQuery(options);
  if (!query.valid) throw new Error("Invalid regular expression");
  const captures = options.regexp
    ? new RegExpCursor(state.doc, options.search, {
        ignoreCase: !options.caseSensitive,
      })
    : undefined;
  const cursor = query.getCursor(state);
  for (let result = cursor.next(); !result.done; result = cursor.next()) {
    let capture: RegExpExecArray | undefined;
    if (captures) {
      while (!captures.next().done) {
        if (captures.value.from === result.value.from) {
          capture = captures.value.match;
          break;
        }
        if (captures.value.from > result.value.from) break;
      }
    }
    yield {
      ...result.value,
      captures: capture,
    };
  }
}

export function replaceFieldMatch(
  text: string,
  match: FieldMatch,
  options: SearchOptions,
) {
  return replacementForMatch(options, match, EditorState.create({ doc: text }));
}

function replacementForMatch(
  options: SearchOptions,
  match: { from: number; to: number; captures?: RegExpExecArray },
  state: EditorState,
) {
  let replacement = options.replace;
  if (options.regexp) {
    replacement = replacement.replace(/\\([nrt\\])/g, (_, character: string) =>
      character === "n"
        ? "\n"
        : character === "r"
          ? "\r"
          : character === "t"
            ? "\t"
            : "\\",
    );
    replacement = replacement.replace(
      /\$([$&]|\d+)/g,
      (token, group: string) => {
        if (group === "$") return "$";
        if (group === "&") return match.captures?.[0] ?? token;
        for (let length = group.length; length > 0; length--) {
          const index = Number(group.slice(0, length));
          if (index > 0 && index < (match.captures?.length ?? 0))
            return `${match.captures![index]}${group.slice(length)}`;
        }
        return token;
      },
    );
  }
  return options.preserveCase
    ? preserveCaseReplacement(state.sliceDoc(match.from, match.to), replacement)
    : replacement;
}

function replacementChanges(state: EditorState, options: SearchOptions) {
  const query = createSearchQuery(options);
  const matches: Array<{ from: number; to: number }> = [];
  const matchCursor = query.getCursor(state);
  for (let match = matchCursor.next(); !match.done; match = matchCursor.next())
    matches.push(match.value);
  const captures = new Map<number, RegExpExecArray>();
  if (options.regexp) {
    const cursor = new RegExpCursor(state.doc, options.search, {
      ignoreCase: !options.caseSensitive,
    });
    while (!cursor.next().done)
      captures.set(cursor.value.from, cursor.value.match);
  }
  return matches.map((match) => ({
    ...match,
    insert: replacementForMatch(
      options,
      { ...match, captures: captures.get(match.from) },
      state,
    ),
  }));
}

export function countSearchMatches(
  state: EditorState,
  query: SearchQuery,
): number {
  if (!query.valid) return 0;
  let count = 0;
  const cursor = query.getCursor(state);
  while (true) {
    const match = cursor.next();
    if (match.done) return count;
    count++;
  }
}

export function attachSourceSearch(
  root: HTMLElement,
  host: SearchHost,
): SearchController | null {
  const editor = root.querySelector<HTMLElement>(".cm-editor");
  const foundView = editor && EditorView.findFromDOM(editor);
  if (!foundView) return null;
  const view = foundView;

  let options = { ...emptyOptions };
  let expanded = false;
  let total = 0;
  let current = 0;
  let error: string | undefined;
  let feedback = "";
  let replacementRevision: number | undefined;
  let pendingReplacement:
    { revision: number; all: boolean; count: number } | undefined;
  let lastQuery: SearchQuery | undefined;
  let lastDoc: EditorState["doc"] | undefined;
  let countTimer: ReturnType<typeof setTimeout> | undefined;
  let listeners = new Set<(snapshot: SearchSnapshot) => void>();
  let panelComponent: ReturnType<typeof mount> | undefined;
  let panel: HTMLElement | undefined;
  let destroyed = false;
  const searchConfig = new Compartment();

  function snapshot(): SearchSnapshot {
    return {
      options: { ...options },
      expanded,
      counting: countTimer !== undefined,
      current,
      total,
      error,
      feedback,
      canUndoReplacement:
        replacementRevision !== undefined &&
        replacementRevision === host.revision(),
      processing: host.isProcessing(),
    };
  }

  function notify() {
    const next = snapshot();
    for (const listener of listeners) listener(next);
  }

  function query() {
    return getSearchQuery(view.state);
  }

  function recount() {
    if (countTimer !== undefined) clearTimeout(countTimer);
    countTimer = undefined;
    const generation = Symbol();
    activeCount = generation;
    const currentQuery = query();
    lastQuery = currentQuery;
    lastDoc = view.state.doc;
    total = 0;
    current = 0;
    error =
      !options.search || currentQuery.valid
        ? undefined
        : "Invalid regular expression";
    feedback = "";
    if (!currentQuery.valid) {
      notify();
      return;
    }
    const cursor = currentQuery.getCursor(view.state);
    let batch = 0;
    const count = () => {
      if (destroyed || activeCount !== generation) return;
      while (batch < 500) {
        const result = cursor.next();
        if (result.done) {
          countTimer = undefined;
          updateCurrent();
          notify();
          return;
        }
        total++;
        batch++;
      }
      batch = 0;
      countTimer = setTimeout(count, 0);
    };
    countTimer = setTimeout(count, 0);
    notify();
  }

  let activeCount: symbol | undefined;

  function updateCurrent() {
    const selection = view.state.selection.main;
    const cursor = query().getCursor(view.state);
    let index = 0;
    let found = 0;
    while (true) {
      const result = cursor.next();
      if (result.done) break;
      index++;
      if (
        result.value.from <= selection.from &&
        result.value.to >= selection.to
      ) {
        found = index;
        break;
      }
      if (result.value.from >= selection.from) {
        found = index;
        break;
      }
    }
    current = found;
  }

  function updateOptions(next: SearchOptions) {
    options = { ...next };
    view.dispatch({ effects: setSearchQuery.of(createSearchQuery(options)) });
    recount();
  }

  const controller: SearchController = {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    open(replace = false) {
      expanded ||= replace;
      view.dispatch({ effects: setSearchQuery.of(createSearchQuery(options)) });
      openSearchPanel(view);
      requestAnimationFrame(() =>
        panel?.querySelector<HTMLElement>("[main-field]")?.focus(),
      );
      notify();
    },
    close() {
      closeSearchPanel(view);
      view.focus();
      expanded = false;
      if (countTimer !== undefined) clearTimeout(countTimer);
      countTimer = undefined;
      activeCount = undefined;
      notify();
    },
    configure: updateOptions,
    expand(value) {
      expanded = value;
      notify();
    },
    next(backward = false) {
      (backward ? findPrevious : findNext)(view);
      updateCurrent();
      notify();
    },
    replace(all = false) {
      if (host.isProcessing() || !query().valid || total === 0) return;
      pendingReplacement = {
        revision: host.revision(),
        all,
        count: all ? total : 1,
      };
      if (options.preserveCase) {
        const matches = replacementChanges(view.state, options);
        if (all) {
          view.dispatch({
            changes: matches,
            userEvent: "input.replace",
          });
        } else {
          const { from, to } = view.state.selection.main;
          const match =
            matches.find((item) => item.from === from && item.to === to) ??
            matches.find((item) => item.from >= from) ??
            matches[0];
          if (match) {
            view.dispatch({
              changes: { from: match.from, to: match.to, insert: match.insert },
              selection: EditorSelection.cursor(
                match.from + match.insert.length,
              ),
              userEvent: "input.replace",
            });
          }
        }
      } else if (all) replaceAll(view);
      else {
        const original = view.state.doc;
        replaceNext(view);
        if (view.state.doc === original) replaceNext(view);
      }
      setTimeout(() => {
        if (pendingReplacement) controller.documentChanged();
      }, 0);
      notify();
    },
    undoReplacement() {
      if (
        replacementRevision !== undefined &&
        replacementRevision === host.revision()
      ) {
        host.undo();
        replacementRevision = undefined;
        feedback = "";
      }
      notify();
    },
    documentChanged() {
      if (
        pendingReplacement &&
        host.revision() !== pendingReplacement.revision
      ) {
        const { all, count } = pendingReplacement;
        replacementRevision = host.revision();
        feedback = all ? `Replaced ${count} matches` : "Replaced 1 match";
        pendingReplacement = undefined;
      } else if (
        replacementRevision !== undefined &&
        replacementRevision !== host.revision()
      ) {
        replacementRevision = undefined;
        feedback = "";
      }
      notify();
    },
    sync() {
      notify();
    },
    destroy() {
      destroyed = true;
      if (countTimer !== undefined) clearTimeout(countTimer);
      countTimer = undefined;
      listeners.clear();
      view.dispatch({ effects: searchConfig.reconfigure([]) });
      if (panelComponent) void unmount(panelComponent);
      panelComponent = undefined;
    },
  };

  function createPanel(currentView: EditorView): Panel {
    panel = document.createElement("div");
    panel.className = "source-search-panel";
    panelComponent = mount(SearchPanel, {
      target: panel,
      props: { controller },
    });
    return {
      dom: panel,
      top: true,
      update() {
        const nextQuery = getSearchQuery(currentView.state);
        if (
          searchPanelOpen(currentView.state) &&
          (nextQuery.search !== lastQuery?.search ||
            nextQuery.replace !== lastQuery?.replace ||
            nextQuery.caseSensitive !== lastQuery?.caseSensitive ||
            nextQuery.wholeWord !== lastQuery?.wholeWord ||
            nextQuery.regexp !== lastQuery?.regexp ||
            currentView.state.doc !== lastDoc)
        )
          recount();
      },
      destroy() {
        if (countTimer !== undefined) clearTimeout(countTimer);
        countTimer = undefined;
        if (panelComponent) void unmount(panelComponent);
        panelComponent = undefined;
        panel = undefined;
      },
    };
  }

  view.dispatch({
    effects: StateEffect.appendConfig.of(
      searchConfig.of(Prec.highest(search({ top: true, createPanel }))),
    ),
  });
  view.dispatch({ effects: setSearchQuery.of(createSearchQuery(options)) });

  return controller;
}
