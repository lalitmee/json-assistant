import { expect, test, type Page } from '@playwright/test'
import { parse } from 'lossless-json'

async function source(page: Page, text: string) {
  const code = page.locator('[aria-label="Source pane"] .cm-content')
  await code.fill(text)
  await expect(code).toHaveText(text)
  await expect(page.getByTestId('source')).toHaveText(text)
}

async function changeSibling(page: Page) {
  const value = page.getByRole('region', { name: 'Tree pane' }).getByRole('button', { name: 'before', exact: true })
  await expect(value).toBeVisible()
  await value.dblclick()
  const editable = page.locator('[aria-label="Tree pane"] [contenteditable="true"]')
  await editable.fill('after')
  await editable.press('Enter')
  await expect(page.getByTestId('source')).toContainText('after')
}

test.beforeEach(async ({ page }) => { await page.goto('/') })

test('shared chronological history', async ({ page }) => {
  await source(page, '{"sibling":"before"}')
  await changeSibling(page)
  await expect(page.getByTestId('source')).toContainText('after')
  const edited = await page.getByTestId('source').textContent()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText('{"sibling":"before"}')
  await page.locator('[aria-label="Source pane"] .cm-content').press('ControlOrMeta+z')
  await expect(page.getByTestId('source')).toHaveText('{}')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  const tree = page.getByRole('region', { name: 'Tree pane' })
  await tree.getByRole('button', { name: /Expand or collapse this object/ }).first().click()
  await tree.getByRole('button', { name: '1 prop' }).click()
  await tree.getByRole('button', { name: 'before', exact: true }).click()
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(page.getByTestId('source')).toHaveText(edited!)
})

test('tree edits preserve unaffected lossless values', async ({ page }) => {
  const input = String.raw`{"big":9007199254740993,"decimal":1.2300,"exponent":1e+09,"negative":-0,"escaped":"\u0061","sibling":"before"}`
  await source(page, input)
  await changeSibling(page)
  const output = await page.getByTestId('source').textContent()
  const value = parse(output!) as Record<string, any>
  expect(value.big.value).toBe('9007199254740993')
  expect(value.decimal.value).toBe('1.2300')
  expect(value.exponent.value).toBe('1e+09')
  expect(value.negative.value).toBe('-0')
  expect(value.escaped).toBe('a')
  expect(value.sibling).toBe('after')
})

test('invalid and decoded-equivalent duplicate drafts stay exact and unavailable', async ({ page }) => {
  for (const input of ['{"a":', String.raw`{"a":1,"\u0061":2}`]) {
    await source(page, input)
    await expect(page.getByTestId('source')).toHaveText(input)
    await expect(page.getByRole('status')).toContainText('Tree unavailable')
    await expect(page.getByRole('region', { name: 'Tree pane' }).getByRole('tree')).toBeHidden()
  }
})

test('all root values render without changing source', async ({ page }) => {
  for (const input of ['{}', '[]', '"x"', '0', 'true', 'false', 'null']) {
    await source(page, input)
    await expect(page.getByTestId('source')).toHaveText(input)
    await expect(page.getByRole('region', { name: 'Tree pane' }).getByRole('tree')).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  }
})

test('HTML, URLs and hostile keys remain data', async ({ page }) => {
  const outbound: string[] = []
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:5173/')) outbound.push(request.url())
  })
  const input = String.raw`{"__proto__":{"polluted":true},"constructor":"data","html":"<img src=https://invalid.example/payload onerror=alert(1)>","url":"https://invalid.example/payload"}`
  await source(page, input)
  await expect(page.getByTestId('source')).toHaveText(input)
  await expect(page.getByRole('region', { name: 'Tree pane' }).getByRole('tree')).toBeVisible()
  expect(await page.evaluate(() => Object.hasOwn(Object.prototype, 'polluted'))).toBe(false)
  expect(outbound).toEqual([])
  await expect(page.locator('[aria-label="Tree pane"] img[src]')).toHaveCount(0)
})

test('view changes preserve selection, and deleting a selected child selects its parent', async ({ page }) => {
  await source(page, '{"parent":{"child":"value"},"sibling":1}')
  const expand = page.getByRole('region', { name: 'Tree pane' }).getByRole('button', { name: /Expand or collapse this object/ })
  await expand.first().click()
  await expand.last().click()
  const props = page.getByRole('region', { name: 'Tree pane' }).getByRole('button', { name: '1 prop' })
  if (await props.count()) await props.click()
  const child = page.getByRole('button', { name: 'value', exact: true })
  await child.click()
  await expect(page.getByTestId('tree-selection')).toContainText('parent')
  await page.getByRole('button', { name: 'Code', exact: true }).click()
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  await expect(page.getByTestId('tree-selection')).toContainText('parent')
  await child.click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await menu.getByText('Remove', { exact: true }).click()
  await expect(page.getByTestId('source')).not.toContainText('"child"')
  await expect(page.getByTestId('tree-selection')).toContainText('parent')
})

test('deleting a selected ancestor moves selection to the nearest surviving parent', async ({ page }) => {
  await source(page, '{"parent":{"child":{"deep":"value"}},"sibling":1}')
  const tree = page.getByRole('region', { name: 'Tree pane' })
  const expand = tree.getByRole('button', { name: /Expand or collapse this object/ })
  await expand.first().click()
  await expand.last().click()
  await tree.getByRole('button', { name: '1 prop' }).first().click()
  await tree.getByRole('button', { name: /Expand or collapse this object/ }).last().click()
  await tree.getByRole('button', { name: 'value', exact: true }).click()
  await expect(page.getByTestId('tree-selection')).toContainText('deep')
  await page.evaluate(() => (window as any).__editorGatePatch([{ op: 'remove', path: '/parent' }]))
  await expect(page.getByTestId('source')).toContainText('"sibling"')
  await expect(page.getByTestId('tree-selection')).toHaveText(JSON.stringify({ type: 'inside', path: [] }))
})

test('editor context-menu undo routes through shared history', async ({ page }) => {
  await source(page, '{"item":"value"}')
  const tree = page.getByRole('region', { name: 'Tree pane' })
  const expand = tree.getByRole('button', { name: /Expand or collapse this object/ })
  await expand.first().click()
  await tree.getByRole('button', { name: '1 prop' }).click()
  await tree.getByRole('button', { name: 'value', exact: true }).click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu.getByText('Undo', { exact: true })).toBeVisible()
  await menu.getByText('Undo', { exact: true }).click()
  await expect(page.getByTestId('source')).toHaveText('{}')
})

test('object rename preserves sibling values', async ({ page }) => {
  await source(page, '{"keep":"a","target":"x"}')
  const tree = page.getByRole('region', { name: 'Tree pane' })
  await tree.getByRole('button', { name: /Expand or collapse this object/ }).first().click()
  await tree.getByRole('button', { name: '2 props' }).click()
  const target = tree.getByRole('button', { name: 'x', exact: true })
  await target.click({ button: 'right' })
  await page.getByRole('menu').getByText('Edit key', { exact: true }).click()
  const editor = tree.locator('[contenteditable="true"]')
  await editor.fill('renamed')
  await editor.press('Enter')
  const parsed = parse((await page.getByTestId('source').textContent())!) as Record<string, unknown>
  expect(parsed.keep).toBe('a')
  expect(parsed.renamed).toBe('x')
})

test('object add/remove and array insert/move preserve unaffected values', async ({ page }) => {
  await source(page, String.raw`{"keep":9007199254740993,"decimal":1.2300,"exponent":1e+09,"negative":-0,"escaped":"\u0061","items":[1,2,3],"removeMe":true,"renameMe":"same"}`)
  const apply = async (operations: unknown[]) => {
    const revision = Number(await page.getByTestId('revision').textContent())
    await page.evaluate(ops => (window as any).__editorGatePatch(ops), operations)
    await expect.poll(async () => Number(await page.getByTestId('revision').textContent())).toBe(revision + 1)
  }
  await apply([{ op: 'add', path: '/added', value: 'new' }])
  await apply([{ op: 'remove', path: '/removeMe' }])
  await apply([{ op: 'move', from: '/renameMe', path: '/renamed' }])
  await apply([{ op: 'add', path: '/items/1', value: 9 }])
  await apply([{ op: 'move', from: '/items/0', path: '/items/3' }])
  const result = parse((await page.getByTestId('source').textContent())!) as any
  expect(result.keep.value).toBe('9007199254740993')
  expect(result.decimal.value).toBe('1.2300')
  expect(result.exponent.value).toBe('1e+09')
  expect(result.negative.value).toBe('-0')
  expect(result.escaped).toBe('a')
  expect(result.items.map((item: any) => item.value ?? item)).toEqual(['9', '2', '3', '1'])
  expect(result.added).toBe('new')
  expect(result.removeMe).toBeUndefined()
  expect(result.renamed).toBe('same')
})

test('programmatic pane synchronization does not create echo transactions', async ({ page }) => {
  await source(page, '{"sibling":"before"}')
  const before = Number(await page.getByTestId('revision').textContent())
  const echoes = Number(await page.getByTestId('echo-count').textContent())
  await changeSibling(page)
  await expect(page.getByTestId('revision')).toHaveText(String(before + 1))
  await expect(page.getByTestId('echo-count')).toHaveText(String(echoes))
})

test('synthetic composition sequence keeps composed text and does not hijack undo', async ({ page }) => {
  const editor = page.locator('[aria-label="Source pane"] .cm-content')
  await editor.focus()
  await editor.evaluate(element => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    element.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: '漢' }))
    const shortcut = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
    Object.defineProperty(shortcut, 'isComposing', { value: true })
    element.dispatchEvent(shortcut)
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '漢' }))
  })
  // Synthetic CompositionEvents do not emulate a native IME; this only guards app shortcut routing.
  await page.keyboard.insertText('{"ime":"漢"}')
  await expect(page.getByTestId('source')).toContainText('漢')
})
