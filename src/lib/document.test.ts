import { describe, expect, it } from 'vitest'
import { SelectionType, type JSONEditorSelection } from 'svelte-jsoneditor'
import { parse } from 'lossless-json'
import { acceptCompletion, applyTreePatch, clampSelection, commit, createDocument, deletedSelection, fallbackSelection, redo, undo } from './document'

describe('document history', () => {
  it('keeps chronological source and tree changes undoable from one history', () => {
    let state = createDocument('{}')
    state = commit(state, { source: '{"a":1}', selection: {} })
    state = commit(state, { source: '{"a":2}', selection: {} })
    expect(undo(undo(state)).source).toBe('{}')
    expect(redo(redo(undo(undo(state)))).source).toBe('{"a":2}')
  })

  it('ignores cancelled and stale asynchronous completions', () => {
    const state = commit(createDocument('{}'), { source: '{"new":true}', selection: {} })
    expect(acceptCompletion(state, { revision: 0, source: '{"stale":true}' })).toBe(state)
    expect(acceptCompletion(state, { revision: state.revision, source: '{"cancelled":true}', cancelled: true })).toBe(state)
    expect(state.source).toBe('{"new":true}')
  })

  it('moves a deleted tree selection to its surviving parent', () => {
    const selection: JSONEditorSelection = { type: SelectionType.key, path: ['items', '1'] }
    expect(deletedSelection(selection)).toEqual({ type: SelectionType.inside, path: ['items'] })
  })

  it('walks to the nearest surviving ancestor when a selected ancestor is removed', () => {
    const selection: JSONEditorSelection = { type: SelectionType.key, path: ['parent', 'child', 'deep'] }
    expect(fallbackSelection(selection, '{"sibling":1}', [['parent']]))
      .toEqual({ type: SelectionType.inside, path: [] })
  })

  it('clamps a restored source selection to the restored text length', () => {
    expect(clampSelection({ code: { type: SelectionType.text, ranges: [{ anchor: 8, head: 12 }], main: 0 } }, 'short'))
      .toEqual({ code: { type: SelectionType.text, ranges: [{ anchor: 5, head: 5 }], main: 0 } })
  })

  it('does not apply a deferred completion after a newer edit', async () => {
    let resolve!: (value: { revision: number; source: string }) => void
    const pending = new Promise<{ revision: number; source: string }>(r => { resolve = r })
    const initial = createDocument('{}')
    const changed = commit(initial, { source: '{"current":1}', selection: {} })
    resolve({ revision: initial.revision, source: '{"stale":1}' })
    expect(acceptCompletion(changed, await pending).source).toBe('{"current":1}')
  })

  it('does not apply a completion cancelled while pending', async () => {
    let resolve!: (value: { revision: number; source: string; cancelled: boolean }) => void
    const pending = new Promise<{ revision: number; source: string; cancelled: boolean }>(r => { resolve = r })
    const state = createDocument('{"current":1}')
    resolve({ revision: state.revision, source: '{"cancelled":1}', cancelled: true })
    expect(acceptCompletion(state, await pending)).toBe(state)
  })

  it('does not create a transaction for equal-source synchronization', () => {
    const state = createDocument('{}')
    const next = commit(state, { source: '{}', selection: { code: undefined } })
    expect(next.revision).toBe(state.revision)
    expect(next.past).toEqual([])
  })

  it('applies a tree patch to lossless source values without changing siblings', () => {
    const input = String.raw`{"big":9007199254740993,"decimal":1.2300,"exp":1e+09,"negative":-0,"escaped":"\u0061","sibling":"before"}`
    const output = applyTreePatch(input, [{ op: 'replace', path: '/sibling', value: 'after' }])
    expect(output).toContain('9007199254740993')
    expect(output).toContain('1.2300')
    expect(output).toContain('1e+09')
    expect(output).toContain('-0')
    const value = parse(output) as Record<string, any>
    expect(value.big.value).toBe('9007199254740993')
    expect(value.decimal.value).toBe('1.2300')
    expect(value.exp.value).toBe('1e+09')
    expect(value.negative.value).toBe('-0')
    expect(value.escaped).toBe('a')
    expect(value.sibling).toBe('after')
  })
})
