import { expect, test, type Page } from '@playwright/test'

async function source(page: Page, text: string) {
  const editor = page.locator('[aria-label="Source pane"] .cm-content')
  await editor.click()
  await editor.press('ControlOrMeta+a')
  await page.keyboard.insertText(text)
  await expect(page.getByTestId('source')).toHaveText(text)
}

test.beforeEach(async ({ page }) => { await page.goto('/') })

test('format and minify are undoable, redoable, and superseded by a new edit', async ({ page }) => {
  const compact = '{"a":1}'
  await source(page, compact)
  await page.getByRole('button', { name: 'Format', exact: true }).click()
  const formatted = '{\n  "a": 1\n}'
  await expect(page.getByTestId('source')).toHaveText(formatted)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText(compact)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText(formatted)
  await expect(page.getByRole('button', { name: 'Minify', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Minify', exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText(compact)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText(formatted)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText(compact)
  await source(page, '{"b":2}')
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled()
})

test('invalid source remains exact and disables tree edits while diagnostics stay visible', async ({ page }) => {
  for (const invalid of ['{"a":', String.raw`{"a":1,"\u0061":2}`]) {
    await source(page, invalid)
    await expect(page.getByTestId('source')).toHaveText(invalid)
    await expect(page.getByTestId('diagnostic')).toContainText(/Invalid JSON at|Duplicate key at/)
    await expect(page.getByRole('button', { name: 'Format', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Minify', exact: true })).toBeDisabled()
    await expect(page.getByRole('region', { name: 'Tree pane' }).getByRole('tree')).toBeHidden()
  }
  await expect(page.getByText(/UTF-8/)).toBeVisible()
  await source(page, '{"a":1}')
  await expect(page.getByRole('region', { name: 'Tree pane' }).getByRole('tree')).toBeVisible()
})

test('out-of-order analysis and completion cannot replace the latest source or tree revision', async ({ page }) => {
  await source(page, '{"first":1}')
  const oldRevision = Number(await page.getByTestId('revision').textContent())
  await source(page, '{"latest":2}')
  await expect(page.getByRole('treeitem', { name: 'latest : 2', exact: true })).toBeVisible()

  await page.evaluate(revision => (window as any).__editorGateApplyResult({
    analysis: { revision, bytes: 12, valid: false, diagnostics: [{ kind: 'syntax', message: 'stale', offset: 0, line: 1, column: 1 }], depth: 0, nodes: 1 }
  }), oldRevision)
  await expect(page.getByText(/Valid JSON ·/)).toBeVisible()
  await page.evaluate(revision => (window as any).__editorGateApplyResult({
    analysis: { revision, bytes: 10, valid: true, diagnostics: [], depth: 0, nodes: 1 },
    source: '{"stale":0}'
  }), oldRevision)

  await expect(page.getByTestId('source')).toHaveText('{"latest":2}')
  await expect(page.getByRole('treeitem', { name: 'latest : 2', exact: true })).toBeVisible()
  await expect(page.getByTestId('diagnostic')).toHaveCount(0)
})

test('search finds text and value in collapsed tree branches and reveals the match', async ({ page }) => {
  await source(page, '{"outer":{"needle":"value"}}')
  const tree = page.getByRole('region', { name: 'Tree pane' })
  const outer = tree.getByRole('treeitem', { name: /outer/ }).last()
  const collapseOuter = outer.getByRole('button', { name: /Expand or collapse/ })
  await collapseOuter.click()
  await expect(tree.getByRole('treeitem', { name: 'needle : value', exact: true })).toBeVisible()
  await collapseOuter.click()
  await expect(tree.getByRole('treeitem', { name: 'needle : value', exact: true })).toHaveCount(0)
  await expect(tree.getByRole('button', { name: /Transform|Sort|Schema|Query|Repair/i })).toHaveCount(0)
  await page.getByRole('button', { name: /Search/ }).click()
  const search = page.getByPlaceholder('Find')
  await search.fill('needle')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('treeitem', { name: 'needle : value', exact: true })).toBeVisible()
  await search.fill('value')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('treeitem', { name: 'needle : value', exact: true })).toBeVisible()
})

test('path action copies an escaped JSONPath for selected keys', async ({ page }) => {
  await page.evaluate(() => {
    ;(window as any).__clipboardText = ''
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { (window as any).__clipboardText = text } } })
  })
  await source(page, String.raw`{"a.\"b\\c":1}`)
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  const tree = page.getByRole('region', { name: 'Tree pane' })
  await tree.getByRole('treeitem', { name: 'a.\"b\\c : 1', exact: true }).click()
  await page.getByRole('button', { name: /Copy path/ }).click()
  const copiedPath = await page.evaluate(() => (window as any).__clipboardText)
  expect(copiedPath).toBe(String.raw`["a.\"b\c"]`)
  await expect.poll(() => page.evaluate(path => (window as any).__editorGateParsePath(path), copiedPath))
    .toEqual(['a."b\\c'])
})

test('chooses a responsive default without overriding an explicit view', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Split', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.setViewportSize({ width: 899, height: 800 })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Code', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  await page.setViewportSize({ width: 1200, height: 800 })
  await expect(page.getByRole('button', { name: 'Tree', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('stacks narrow split and preserves source/history across view changes', async ({ page }) => {
  await source(page, '{"a":1}')
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  await page.getByRole('treeitem', { name: 'a : 1', exact: true }).click()
  const selection = await page.getByTestId('tree-selection').textContent()
  await page.getByRole('button', { name: 'Split', exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText('{"a":1}')
  await expect(page.getByTestId('tree-selection')).toHaveText(selection!)
  await page.getByRole('button', { name: 'Code', exact: true }).click()
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  await expect(page.getByTestId('tree-selection')).toHaveText(selection!)
  await page.getByRole('button', { name: 'Split', exact: true }).click()
  await page.setViewportSize({ width: 500, height: 800 })
  const panes = page.locator('.panes')
  const geometry = await panes.evaluate(element => {
    const sourcePane = element.querySelector('[aria-label="Source pane"]')!.getBoundingClientRect()
    const treePane = element.querySelector('[aria-label="Tree pane"]')!.getBoundingClientRect()
    return { stacked: treePane.top >= sourcePane.bottom, overflow: element.scrollWidth > element.clientWidth }
  })
  expect(geometry).toEqual({ stacked: true, overflow: false })
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText('{}')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText('{"a":1}')
})

test('exposes keyboard-operable divider and named, reachable layout controls', async ({ page }) => {
  const split = page.getByRole('button', { name: 'Split', exact: true })
  const code = page.getByRole('button', { name: 'Code', exact: true })
  const tree = page.getByRole('button', { name: 'Tree', exact: true })
  await expect(split).toHaveAttribute('aria-pressed', 'true')
  await expect(code).toHaveAccessibleName('Code')
  const divider = page.getByRole('separator', { name: /Resize panes/ })
  await divider.focus()
  await expect(divider).toBeFocused()
  const initial = Number(await divider.getAttribute('aria-valuenow'))
  await page.keyboard.press('ArrowRight')
  expect(Number(await divider.getAttribute('aria-valuenow'))).toBeGreaterThan(initial)
  await page.keyboard.press('Home')
  const minimum = await divider.getAttribute('aria-valuemin')
  expect(await divider.getAttribute('aria-valuenow')).toBe(minimum)
  await page.keyboard.press('End')
  const maximum = await divider.getAttribute('aria-valuemax')
  expect(await divider.getAttribute('aria-valuenow')).toBe(maximum)
  await tree.focus()
  await page.keyboard.press('Tab')
  await expect(divider).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.cm-content:visible').first()).toBeFocused()
})

test('honors system color preference and refreshes a hidden source editor', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await expect(page.locator('html')).toHaveCSS('--editor-background', '#1e1e1e')
  await source(page, '{"hidden":1}')
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  await page.evaluate(() => (window as any).__editorGatePatch([{ op: 'replace', path: '/hidden', value: 2 }]))
  await page.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(page.locator('[aria-label="Source pane"] .cm-content')).toContainText('"hidden": 2')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveCSS('--editor-background', '#fff')
})

test('undo shortcut remains available after focusing source and tree controls', async ({ page }) => {
  await source(page, '{"value":1}')
  await source(page, '{"value":2}')
  await page.keyboard.press('Control+z')
  await expect.poll(() => page.getByTestId('source').textContent().then(text => JSON.parse(text!).value)).toBe(1)
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(() => page.getByTestId('source').textContent().then(text => JSON.parse(text!).value)).toBe(2)
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  await page.getByRole('treeitem', { name: 'value : 2', exact: true }).click()
  await page.keyboard.press('Control+z')
  await expect.poll(() => page.getByTestId('source').textContent().then(text => JSON.parse(text!).value)).toBe(1)
})

test('keyboard navigation reaches and operates the divider and source editor', async ({ page }) => {
  const split = page.getByRole('button', { name: 'Split', exact: true })
  let splitFocused = false
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab')
    if (await split.evaluate(element => element === document.activeElement)) { splitFocused = true; break }
  }
  expect(splitFocused).toBe(true)
  await page.keyboard.press('Enter')
  await expect(split).toHaveAttribute('aria-pressed', 'true')
  const divider = page.getByRole('separator', { name: 'Resize panes' })
  let dividerFocused = false
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    if (await divider.evaluate(element => element === document.activeElement)) { dividerFocused = true; break }
  }
  expect(dividerFocused).toBe(true)
  await page.keyboard.press('ArrowRight')
  const increased = Number(await divider.getAttribute('aria-valuenow'))
  expect(increased).toBeGreaterThan(50)
  await page.keyboard.press('Home')
  expect(await divider.getAttribute('aria-valuenow')).toBe('25')
  await page.keyboard.press('Tab')
  await expect(page.locator('[aria-label="Source pane"] .cm-content')).toBeFocused()
})
