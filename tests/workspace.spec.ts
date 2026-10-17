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

test('search finds text and value in collapsed tree branches and reveals the match', async ({ page }) => {
  await source(page, '{"outer":{"needle":"value"}}')
  const tree = page.getByRole('region', { name: 'Tree pane' })
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
  await expect.poll(() => page.evaluate(() => (window as any).__clipboardText)).toContain('a')
})
