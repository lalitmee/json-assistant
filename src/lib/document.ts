import { SelectionType, type JSONEditorSelection } from 'svelte-jsoneditor'
import { immutableJSONPatch, type JSONPatchDocument } from 'immutable-json-patch'
import { parse, stringify } from 'lossless-json'

export type View = 'split' | 'code' | 'tree'
export type Path = Array<string | number>
export type Selection = { code?: JSONEditorSelection; tree?: JSONEditorSelection }
export type Diagnostic = { kind: 'syntax' | 'duplicate'; message: string; offset: number; line: number; column: number }
export type Analysis = { revision: number; bytes: number; valid: boolean; diagnostics: Diagnostic[]; depth: number; nodes: number; mode?: 'edit' | 'inspect' | 'unavailable' }
export type Snapshot = { source: string; selection: Selection }
export type DocumentState = {
  source: string
  revision: number
  selection: Selection
  analysis?: Analysis
  past: Snapshot[]
  future: Snapshot[]
  exportedSource: string
  processing: boolean
  mode: 'edit' | 'inspect' | 'unavailable'
  error?: string
}

export function createDocument(source = '{}'): DocumentState {
  return { source, revision: 0, selection: {}, past: [], future: [], exportedSource: source, processing: false, mode: 'edit' }
}

export function commit(state: DocumentState, next: Snapshot): DocumentState {
  if (state.source === next.source) return { ...state, selection: clampSelection(next.selection, state.source) }
  return { ...state, source: next.source, revision: state.revision + 1, selection: clampSelection(next.selection, next.source),
    analysis: undefined, past: [...state.past, { source: state.source, selection: state.selection }], future: [], error: undefined }
}

export function undo(state: DocumentState): DocumentState {
  const previous = state.past.at(-1)
  if (!previous) return state
  return { ...state, source: previous.source, selection: clampSelection(previous.selection, previous.source), revision: state.revision + 1,
    analysis: undefined, past: state.past.slice(0, -1), future: [{ source: state.source, selection: state.selection }, ...state.future] }
}

export function redo(state: DocumentState): DocumentState {
  const next = state.future[0]
  if (!next) return state
  return { ...state, source: next.source, selection: clampSelection(next.selection, next.source), revision: state.revision + 1,
    analysis: undefined, past: [...state.past, { source: state.source, selection: state.selection }], future: state.future.slice(1) }
}

export function acceptCompletion<T extends { revision: number; source?: string; cancelled?: boolean }>(state: DocumentState, result: T): DocumentState {
  if (result.cancelled || result.revision !== state.revision) return state
  return result.source === undefined ? state : commit(state, { source: result.source, selection: state.selection })
}

export function acceptAnalysis(state: DocumentState, analysis: Analysis): DocumentState {
  return analysis.revision === state.revision ? { ...state, analysis } : state
}

export function isDirty(state: DocumentState): boolean {
  return state.source !== state.exportedSource
}

export function deletedSelection(selection?: JSONEditorSelection): JSONEditorSelection | undefined {
  if (!selection || selection.type === 'text' || selection.type === 'multi' || selection.type === 'inside') return selection
  return { type: SelectionType.inside, path: selection.path.slice(0, -1) }
}

export function fallbackSelection(
  selection: JSONEditorSelection | undefined,
  source: string,
  removedPaths: string[][] = []
): JSONEditorSelection | undefined {
  if (!selection || selection.type === 'text' || selection.type === 'multi') return selection
  const value = parse(source)
  const removed = removedPaths.find(path => path.length <= selection.path.length &&
    path.every((part, index) => part === selection.path[index]))
  let path = removed ? removed.slice(0, -1) : selection.path
  const exists = (candidate: string[]) => {
    let current: any = value
    for (const key of candidate) {
      if (current === null || (typeof current !== 'object') || !Object.hasOwn(current, key)) return false
      current = current[key]
    }
    return true
  }
  while (!exists(path) && path.length) path = path.slice(0, -1)
  return path.length === selection.path.length && !removed
    ? selection
    : { type: SelectionType.inside, path }
}

export function clampSelection(selection: Selection, source: string): Selection {
  const code = selection.code
  if (!code || code.type !== 'text') return selection
  const clamp = (position: number) => Math.max(0, Math.min(source.length, position))
  return { ...selection, code: { ...code, ranges: code.ranges.map(range => ({ anchor: clamp(range.anchor), head: clamp(range.head) })) } }
}

export function applyTreePatch(source: string, operations: JSONPatchDocument): string {
  return stringify(immutableJSONPatch(parse(source), operations), null, 2)!
}
