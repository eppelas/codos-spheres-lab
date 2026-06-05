import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'
const cliPath = process.argv.find((arg) => arg.startsWith('--path='))?.slice('--path='.length)
const previewPath = cliPath ?? process.env.PLAYWRIGHT_PATH ?? '/'
const targetURL = new URL(previewPath, baseURL).toString()

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    delay(ms).then(() => {
      throw new Error(`Timed out: ${label}`)
    }),
  ])
}

async function dotFrame(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-flow-dot]')]
      .slice(0, 10)
      .map((dot) => `${dot.getAttribute('cx')},${dot.getAttribute('cy')},${getComputedStyle(dot).opacity}`),
  )
}

async function canvasSample(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null
    const probe = document.createElement('canvas')
    probe.width = 96
    probe.height = 96
    const context = probe.getContext('2d')
    if (!context) return null
    context.drawImage(canvas, 0, 0, probe.width, probe.height)
    const image = context.getImageData(0, 0, probe.width, probe.height).data
    let hash = 0
    let darkPixels = 0
    for (let i = 0; i < image.length; i += 16) {
      const luminance = image[i] * 0.2126 + image[i + 1] * 0.7152 + image[i + 2] * 0.0722
      hash = (hash * 31 + image[i] + image[i + 1] * 3 + image[i + 2] * 5 + image[i + 3] * 7) >>> 0
      if (image[i + 3] > 0 && luminance < 210) darkPixels += 1
    }
    return { hash, darkPixels }
  })
}

async function checkViewport(browser, name, viewport) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: name === 'mobile' ? 2 : 1,
    isMobile: name === 'mobile',
    hasTouch: name === 'mobile',
    reducedMotion: 'no-preference',
  })

  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      errors.push(message.text())
    }
  })

  try {
    const expectedFirefly = new URL(targetURL).pathname.includes('firefly')
    const stageSelector = expectedFirefly ? '[data-testid="program-path"]' : '[data-testid="context-graph"]'

    await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForSelector('canvas', { state: 'attached', timeout: 30_000 })
    await page.waitForSelector(stageSelector, { state: 'attached', timeout: 30_000 })
    if (expectedFirefly) await page.waitForSelector('[data-testid="track-calendar"]', { state: 'attached', timeout: 30_000 })

    const initial = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')?.getBoundingClientRect()
      return {
        innerWidth,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        canvasCount: document.querySelectorAll('canvas').length,
        canvas: canvas && { width: Math.round(canvas.width), height: Math.round(canvas.height) },
        variant: document.querySelector('main')?.getAttribute('data-variant') ?? null,
        visual: document.querySelector('[data-testid="particle-field"]')?.getAttribute('data-visual') ?? 'codos',
      }
    })

    if (initial.canvasCount !== 1) throw new Error(`${name}: expected one canvas, got ${initial.canvasCount}`)
    if (!initial.canvas || initial.canvas.width < 64 || initial.canvas.height < 64) {
      throw new Error(`${name}: invalid canvas bounds ${JSON.stringify(initial.canvas)}`)
    }
    if (initial.scrollWidth > initial.innerWidth + 1) {
      throw new Error(`${name}: horizontal overflow ${initial.scrollWidth} > ${initial.innerWidth}`)
    }
    if (initial.scrollHeight < initial.innerHeight * 8) {
      throw new Error(`${name}: page is not long enough for extended choreography ${initial.scrollHeight}`)
    }

    await page.mouse.move(Math.round(viewport.width * 0.7), Math.round(viewport.height * 0.45))
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(250)

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.22))
    await page.waitForTimeout(1200)

    let canvasMotion = null
    if (initial.visual?.includes('firefly')) {
      const firstSample = await canvasSample(page)
      await page.waitForTimeout(700)
      const secondSample = await canvasSample(page)
      if (!firstSample || !secondSample) throw new Error(`${name}: firefly canvas sample failed`)
      const minDarkPixels = name === 'mobile' ? 6 : 10
      if (firstSample.darkPixels < minDarkPixels || secondSample.darkPixels < minDarkPixels) {
        canvasMotion = { firstSample, secondSample, readbackUnavailable: firstSample.hash === 0 && secondSample.hash === 0 }
      } else if (firstSample.hash === secondSample.hash) {
        throw new Error(`${name}: firefly canvas hash did not change`)
      } else {
        canvasMotion = { firstSample, secondSample }
      }
    }

    const graphBox = await page.locator(stageSelector).first().boundingBox()
    if (!graphBox || graphBox.width < 240 || graphBox.height < 160) {
      throw new Error(`${name}: stage has invalid box ${JSON.stringify(graphBox)}`)
    }
    if (!expectedFirefly && name === 'desktop') {
      if (graphBox.x < viewport.width * 0.42) {
        throw new Error(`${name}: context graph is not placed on the right side ${JSON.stringify(graphBox)}`)
      }
      if (graphBox.width > viewport.width * 0.62) {
        throw new Error(`${name}: context graph is too wide ${JSON.stringify(graphBox)}`)
      }
    }

    let interaction = null
    if (expectedFirefly) {
      await page.locator('.program-track-tab').first().click()
      await page.waitForTimeout(160)
      interaction = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('.program-track-tab')]
        if (tabs.length !== 3) throw new Error(`expected 3 program track tabs, got ${tabs.length}`)
        const activeTab = document.querySelector('.program-track-tab[data-active="true"]')?.textContent?.trim() ?? ''
        const activeDays = document.querySelectorAll('.program-day[data-active="true"]').length
        return { activeTab, activeDays }
      })
      if (!interaction.activeTab.includes('enterprise')) throw new Error(`${name}: firefly active track did not switch to enterprise`)
      if (interaction.activeDays < 6) throw new Error(`${name}: firefly calendar did not highlight enough days ${JSON.stringify(interaction)}`)
    } else {
      const firstDots = await dotFrame(page)
      await page.waitForTimeout(1200)
      const secondDots = await dotFrame(page)
      if (firstDots.join('|') === secondDots.join('|')) {
        throw new Error(`${name}: graph flow dots did not move`)
      }

      await page.evaluate(() => {
        const graph = document.querySelector('[data-testid="context-graph"]')
        if (!graph) throw new Error('context graph missing before pointer event')
        graph.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 120, clientY: 120, pointerType: 'mouse' }))
      })
      await page.waitForTimeout(80)
      const surge = await page.locator('[data-testid="context-graph"]').first().getAttribute('data-surge')
      if (surge !== 'true') throw new Error(`${name}: graph pointer interaction did not trigger surge`)
      interaction = { dotsMoved: true }
    }

    const metrics = await page.evaluate((selector) => {
      const graph = document.querySelector(selector)?.getBoundingClientRect()
      return {
        innerWidth,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        canvasCount: document.querySelectorAll('canvas').length,
        flowDotCount: document.querySelectorAll('[data-flow-dot]').length,
        programNodeCount: document.querySelectorAll('.program-node').length,
        calendarDayCount: document.querySelectorAll('.program-day').length,
        variant: document.querySelector('main')?.getAttribute('data-variant') ?? null,
        visual: document.querySelector('[data-testid="particle-field"]')?.getAttribute('data-visual') ?? 'codos',
        graph: graph && { x: Math.round(graph.x), y: Math.round(graph.y), width: Math.round(graph.width), height: Math.round(graph.height) },
      }
    }, stageSelector)

    if (expectedFirefly) {
      if (metrics.programNodeCount !== 12) throw new Error(`${name}: expected 12 program nodes, got ${metrics.programNodeCount}`)
      if (metrics.calendarDayCount !== 22) throw new Error(`${name}: expected 22 calendar days, got ${metrics.calendarDayCount}`)
    } else if (metrics.flowDotCount !== 48) {
      throw new Error(`${name}: expected 48 graph flow dots, got ${metrics.flowDotCount}`)
    }
    if (errors.length > 0) throw new Error(`${name}: page errors: ${errors.join(' | ')}`)

    return { name, interaction, canvasMotion, initial, metrics }
  } finally {
    await withTimeout(page.close().catch(() => undefined), 3_000, `${name} page close`).catch(() => undefined)
  }
}

let browser
try {
  browser = await chromium.launch({ headless: true })
  const desktop = await checkViewport(browser, 'desktop', { width: 1440, height: 900 })
  const mobile = await checkViewport(browser, 'mobile', { width: 412, height: 915 })
  const result = { ok: true, baseURL, targetURL, mode: 'dom-runtime-layout', desktop, mobile }
  writeFileSync('verification-result.json', `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
} finally {
  if (browser) await withTimeout(browser.close().catch(() => undefined), 5_000, 'browser close').catch(() => undefined)
}
