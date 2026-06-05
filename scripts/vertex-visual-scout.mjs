import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const project = process.env.VERTEX_PROJECT || execFileSync('gcloud', ['config', 'get-value', 'project', '--quiet'], { encoding: 'utf8' }).trim()
const location = process.env.VERTEX_LOCATION || 'us-central1'
const screenshotPath = process.argv[2] || '/private/tmp/codos-firefly-arc-mid-forced.png'
const outDir = process.argv[3] || '.agent-hub/tmp/vertex-gemini-scout'
const models = (process.env.VERTEX_GEMINI_MODELS || 'gemini-3-flash-preview,gemini-2.5-flash,gemini-2.5-pro,gemini-2.0-flash-001')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean)

mkdirSync(outDir, { recursive: true })

const imageBase64 = readFileSync(screenshotPath).toString('base64')
const programCode = readFileSync('src/FireflyProgramExperience.tsx', 'utf8').slice(0, 24000)
const stylesCode = readFileSync('src/styles.css', 'utf8').slice(0, 26000)

const prompt = `
You are a senior interactive web art director and frontend systems designer.

Context:
- We are building a standalone React/Vite prototype at /firefly.
- It has a Three.js moving wire cloud behind/around a participant-path scheme and a June 6-27 calendar.
- The attached screenshot shows the current readable participant-path scheme.
- The user now asks in Russian: "can we duplicate this scheme and make the duplicate more like the original?"
- The "original" reference is Codos.ai's "Setting contexts.Graph": huge mono title, pale green grid background, lavender cards, a wide top ".sources" card, a middle ".raw-data" card, four observer cards, a yellow merge-judge card, three vault cards, thin gray SVG paths, orange runner dots, and warm pastel particle-sphere clouds drifting behind the graph.

Task:
1. Keep the existing vertical path as the clear/usable version.
2. Design a second duplicate section that adapts the participant path into a Codos-like context graph composition, not a generic dashboard.
3. Use the original's visual grammar: pale grid stage, big mono headline, lavender cards, yellow decision/output card, thin curved links, orange runner dots, warm particle cloud behind/around the graph.
4. Preserve the interaction goal: choosing Enterprise, Founders/SMB, or Micro/personal changes the highlighted path, active cards, labels, line/dot color emphasis, and later the calendar highlights matching dates/workshops.
5. Give implementation-level guidance for React/CSS/SVG changes. Be concrete: node data, card sizing, sticky behavior, horizontal scrolling on mobile if needed, active/inactive states, line weight, dot animation speed, and how to keep background cloud decorative without blocking reading.
6. We need a practical patch plan for the local files below.

Current relevant React file:
\`\`\`tsx
${programCode}
\`\`\`

Current relevant CSS excerpt:
\`\`\`css
${stylesCode}
\`\`\`

Return:
- "Duplicate Graph Direction"
- "Implementation Patch Plan"
- "Specific CSS/DOM Rules"
- "Interaction Notes"
`

const body = {
  contents: [
    {
      role: 'user',
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.35,
    maxOutputTokens: 8192,
  },
}

const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim()
let lastError = ''

for (const model of models) {
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`
  const startedAt = new Date().toISOString()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const raw = await response.text()
  const safeName = model.replace(/[^a-z0-9._-]/gi, '_')
  writeFileSync(join(outDir, `${safeName}.response.json`), raw)

  if (!response.ok) {
    lastError = `${model}: HTTP ${response.status} ${raw.slice(0, 600)}`
    writeFileSync(join(outDir, `${safeName}.error.txt`), `${startedAt}\n${lastError}\n`)
    continue
  }

  const json = JSON.parse(raw)
  const text = json.candidates?.flatMap((candidate) => candidate.content?.parts || [])?.map((part) => part.text || '')?.join('\n\n') || raw
  const reportPath = join(outDir, `${safeName}.report.md`)
  writeFileSync(reportPath, text)
  writeFileSync(
    join(outDir, 'latest.json'),
    JSON.stringify({ project, location, model, screenshot: screenshotPath, reportPath, responsePath: join(outDir, `${safeName}.response.json`) }, null, 2),
  )
  console.log(JSON.stringify({ ok: true, project, location, model, screenshot: basename(screenshotPath), reportPath }, null, 2))
  process.exit(0)
}

console.error(lastError)
process.exit(1)
