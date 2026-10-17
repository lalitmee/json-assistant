import { expect, test, type Page } from '@playwright/test'

async function source(page: Page, text: string) {
  const code = page.locator('[aria-label="Source pane"] .cm-content')
  await code.fill(text)
  await expect(code).toHaveText(text)
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
  await page.getByRole('region', { name: 'Tree pane' }).getByRole('button', { name: 'before', exact: true }).click()
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(page.getByTestId('source')).toHaveText(edited!)
})

test('lossless unchanged tokens', async ({ page }) => {
  const input = String.raw`{"big":9007199254740993,"decimal":1.2300,"exponent":1e+09,"negative":-0,"escaped":"\u0061","sibling":"before"}`
  await source(page, input)
  await changeSibling(page)
  const output = await page.getByTestId('source').textContent()
  for (const token of ['9007199254740993', '1.2300', '1e+09', '-0', String.raw`"\u0061"`]) {
    expect.soft(output).toContain(token)
  }
})

test('numeric-looking member order survives a sibling edit', async ({ page }) => {
  await source(page, '{"2":"two","1":"one","sibling":"before"}')
  await changeSibling(page)
  const text = await page.getByTestId('source').textContent()
  expect(text!.indexOf('"2"')).toBeLessThan(text!.indexOf('"1"'))
})

test('minimal escaped-string sibling case', async ({ page }) => {
  await source(page, String.raw`{"escaped":"\u0061","sibling":"before"}`)
  await changeSibling(page)
  expect(await page.getByTestId('source').textContent()).toContain(String.raw`"\u0061"`)
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
