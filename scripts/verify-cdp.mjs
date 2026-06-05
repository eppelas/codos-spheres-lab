import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { PNG } from 'pngjs'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'
const debugPort = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : await getFreePort()
const profileDir = mkdtempSync(join(tmpdir(), 'codos-spheres-cdp.'))

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === 'object' && address?.port) resolve(address.port)
        else reject(new Error('Could not allocate a local CDP port'))
      })
    })
  })
}

async function waitForJson(url, timeout = 20_000) {
  const started = Date.now()
  let lastError
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return response.json()
      lastError = new Error(`${response.status} ${response.statusText}`)
    } catch (error) {
      lastError = error
    }
    await delay(250)
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`)
}

function createCdpClient(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketUrl)
    let nextId = 1
    const pending = new Map()
    const events = []

    ws.onopen = () => {
      resolve({
        events,
        send(method, params = {}, timeout = 10_000) {
          return new Promise((sendResolve, sendReject) => {
            const id = nextId
            nextId += 1
            const timer = setTimeout(() => {
              pending.delete(id)
              sendReject(new Error(`CDP timeout: ${method}`))
            }, timeout)
            pending.set(id, (message) => {
              clearTimeout(timer)
              if (message.error) sendReject(new Error(`${method}: ${JSON.stringify(message.error)}`))
              else sendResolve(message.result ?? {})
            })
            ws.send(JSON.stringify({ id, method, params }))
          })
        },
        close() {
          ws.close()
        },
      })
    }

    ws.onerror = () => reject(new Error(`Could not connect to ${webSocketUrl}`))
    ws.onmessage = (raw) => {
      const message = JSON.parse(raw.data)
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message)
        pending.delete(message.id)
      } else if (message.method) {
        events.push(message)
      }
    }
  })
}

async function evaluate(client, expression, timeout = 15_000) {
  const result = await client.send(
    'Runtime.evaluate',
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    timeout,
  )
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails))
  }
  return result.result?.value
}

async function waitForCanvas(client) {
  const started = Date.now()
  while (Date.now() - started < 30_000) {
    const ready = await evaluate(
      client,
      `(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();
        return rect.width > 64 && rect.height > 64;
      })()`,
    )
    if (ready) return
    await delay(250)
  }
  const state = await evaluate(
    client,
    `(() => ({
      title: document.title,
      root: document.getElementById('root')?.innerHTML.slice(0, 1000) ?? null,
      scripts: [...document.scripts].map((script) => script.src),
      canvasCount: document.querySelectorAll('canvas').length
    }))()`,
  )
  throw new Error(`Canvas did not become ready: ${JSON.stringify(state)}`)
}

async function sampleCanvas(client) {
  return evaluate(
    client,
    `(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return null;
      const blocks = [[0.18,0.22],[0.5,0.28],[0.78,0.34],[0.32,0.58],[0.62,0.66],[0.82,0.74]];
      const blockSize = 72;
      const image = new Uint8Array(blockSize * blockSize * 4);
      let hash = 0;
      let visible = 0;
      for (const pair of blocks) {
        const x = Math.max(0, Math.min(gl.drawingBufferWidth - blockSize, Math.round(gl.drawingBufferWidth * pair[0] - blockSize / 2)));
        const y = Math.max(0, Math.min(gl.drawingBufferHeight - blockSize, Math.round(gl.drawingBufferHeight * pair[1] - blockSize / 2)));
        gl.readPixels(x, y, blockSize, blockSize, gl.RGBA, gl.UNSIGNED_BYTE, image);
        for (let i = 0; i < image.length; i += 32) {
          hash = (hash * 31 + image[i] + image[i + 1] * 3 + image[i + 2] * 5 + image[i + 3] * 7) >>> 0;
          if (image[i + 3] > 0 || image[i] + image[i + 1] + image[i + 2] > 8) visible += 1;
        }
      }
      return { hash, visible };
    })()`,
  )
}

async function sampleScreenshot(client) {
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 20_000)
  const png = PNG.sync.read(Buffer.from(screenshot.data, 'base64'))
  let hash = 0
  let visible = 0
  let opaque = 0

  for (let i = 0; i < png.data.length; i += 4 * 37) {
    const r = png.data[i]
    const g = png.data[i + 1]
    const b = png.data[i + 2]
    const a = png.data[i + 3]
    hash = (hash * 31 + r + g * 3 + b * 5 + a * 7) >>> 0
    if (a > 0) opaque += 1
    if (a > 0 && r > 180 && g > 70 && g < 238 && b < 238 && (r - g > 18 || r - b > 18)) visible += 1
  }

  return { hash, visible, opaque, source: 'screenshot' }
}

async function sampleRendered(client) {
  const direct = await sampleCanvas(client)
  if (direct) return { ...direct, source: 'webgl' }
  return sampleScreenshot(client)
}

async function capturePreviewIconSource(client) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await client.send('Page.navigate', { url: baseURL })
  await delay(1500)
  await waitForCanvas(client)
  await delay(800)
  await evaluate(client, `window.scrollTo(0, document.documentElement.scrollHeight * 0.28); true`)
  await delay(700)
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 20_000)
  writeFileSync('preview-icon-source.png', Buffer.from(screenshot.data, 'base64'))
}

async function checkViewport(client, name, width, height, mobile = false) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  })
  await client.send('Page.navigate', { url: baseURL })
  await delay(1500)
  await waitForCanvas(client)
  await delay(800)

  const first = await sampleRendered(client)
  if (!first || first.visible < 12) throw new Error(`${name}: blank canvas sample ${JSON.stringify(first)}`)

  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: width * 0.72, y: height * 0.45, button: 'none' })
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: width * 0.72, y: height * 0.45, button: 'left', clickCount: 1 })
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: width * 0.72, y: height * 0.45, button: 'left', clickCount: 1 })
  await delay(600)
  const afterPointer = await sampleRendered(client)
  if (!afterPointer || afterPointer.hash === first.hash) throw new Error(`${name}: no pixel change after pointer/click`)

  await evaluate(client, `window.scrollTo(0, document.documentElement.scrollHeight * 0.64); true`)
  await delay(900)
  const afterScroll = await sampleRendered(client)
  if (!afterScroll || afterScroll.hash === afterPointer.hash) throw new Error(`${name}: no pixel change after scroll`)

  const metrics = await evaluate(
    client,
    `(() => ({
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      canvasCount: document.querySelectorAll('canvas').length,
      canvasRect: (() => {
        const rect = document.querySelector('canvas').getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
      })()
    }))()`,
  )

  if (metrics.canvasCount !== 1) throw new Error(`${name}: expected one canvas, got ${metrics.canvasCount}`)
  if (metrics.scrollWidth > metrics.innerWidth + 1) throw new Error(`${name}: horizontal overflow ${metrics.scrollWidth} > ${metrics.innerWidth}`)

  return { name, first, afterPointer, afterScroll, metrics }
}

const chrome = spawn(chromePath, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--remote-debugging-address=127.0.0.1',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  '--disable-background-networking',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })

let chromeExit = null
let chromeStderr = ''
chrome.stderr?.on('data', (chunk) => {
  if (chromeStderr.length < 20_000) chromeStderr += chunk.toString()
})
chrome.on('exit', (code, signal) => {
  chromeExit = { code, signal }
})

let client
try {
  try {
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`, 30_000)
  } catch (error) {
    throw new Error(
      [
        `Chrome CDP endpoint did not start on port ${debugPort}: ${error.message}`,
        `Chrome exit: ${JSON.stringify(chromeExit)}`,
        `Chrome stderr: ${chromeStderr.trim().slice(-4000) || '(empty)'}`,
      ].join('\n'),
    )
  }
  const newTargetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })
  if (!newTargetResponse.ok) {
    throw new Error(`Could not create CDP page target: ${newTargetResponse.status} ${newTargetResponse.statusText}`)
  }
  const tab = await newTargetResponse.json()
  client = await createCdpClient(tab.webSocketDebuggerUrl)
  await client.send('Page.enable')
  await client.send('Runtime.enable')
  await client.send('Input.setIgnoreInputEvents', { ignore: false })

  const desktop = await checkViewport(client, 'desktop', 1440, 900, false)
  const mobile = await checkViewport(client, 'mobile', 412, 915, true)
  await capturePreviewIconSource(client)
  const result = { ok: true, baseURL, desktop, mobile }
  writeFileSync('verification-result.json', `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
} finally {
  if (client) client.close()
  if (!chrome.killed) chrome.kill('SIGKILL')
  rmSync(profileDir, { recursive: true, force: true })
}
