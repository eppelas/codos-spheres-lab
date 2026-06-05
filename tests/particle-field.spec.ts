import { expect, type Page, test } from '@playwright/test'

async function canvasSample(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null
    const probe = document.createElement('canvas')
    probe.width = 64
    probe.height = 64
    const context = probe.getContext('2d')
    if (!context) return null

    context.drawImage(canvas, 0, 0, 64, 64)
    const image = context.getImageData(0, 0, 64, 64).data
    let hash = 0
    let visible = 0
    for (let i = 0; i < image.length; i += 16) {
      hash = (hash * 31 + image[i] + image[i + 1] * 3 + image[i + 2] * 5 + image[i + 3] * 7) >>> 0
      if (image[i + 3] > 0) visible += 1
    }
    return { hash, visible }
  })
}

test('particle field renders and responds to pointer and scroll', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="particle-field"] canvas')).toBeVisible()
  await expect(page.locator('[data-testid="context-graph"]')).toBeAttached()
  await page.waitForTimeout(800)

  const first = await canvasSample(page)
  expect(first?.visible).toBeGreaterThan(12)

  await page.mouse.move(1080, 420)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(450)
  const afterPointer = await canvasSample(page)
  expect(afterPointer?.hash).not.toBe(first?.hash)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.62))
  await page.waitForTimeout(600)
  const afterScroll = await canvasSample(page)
  expect(afterScroll?.hash).not.toBe(afterPointer?.hash)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.22))
  await page.waitForTimeout(700)
  await expect(page.locator('[data-testid="context-graph"]')).toBeVisible()

  const firstDots = await page.locator('[data-flow-dot]').evaluateAll((dots) =>
    dots.slice(0, 8).map((dot) => `${dot.getAttribute('cx')},${dot.getAttribute('cy')}`),
  )
  await page.waitForTimeout(700)
  const secondDots = await page.locator('[data-flow-dot]').evaluateAll((dots) =>
    dots.slice(0, 8).map((dot) => `${dot.getAttribute('cx')},${dot.getAttribute('cy')}`),
  )
  await expect(page.locator('[data-flow-dot]')).toHaveCount(48)
  expect(secondDots.join('|')).not.toBe(firstDots.join('|'))
})

test('particle field stays viewport-bound on mobile', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="particle-field"] canvas')).toBeVisible()
  await page.waitForTimeout(800)

  const metrics = await page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvasCount: document.querySelectorAll('canvas').length,
  }))

  expect(metrics.canvasCount).toBe(1)
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1)
  await expect(page.locator('[data-flow-dot]')).toHaveCount(48)
  const sample = await canvasSample(page)
  expect(sample?.visible).toBeGreaterThan(12)
})
