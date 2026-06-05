import { useEffect, useMemo, useRef, useState } from 'react'

const WIDTH = 1153
const HEIGHT = 777
const DOT_COUNT = 4
const TRAIL_OPACITY = [1, 0.55, 0.32, 0.18]
const FLOW_SPEED_MULTIPLIER = 3

type Card = {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
  chips: string[]
  kicker?: string
  highlight?: boolean
}

const cards: Card[] = [
  {
    id: 'sources',
    x: 0,
    y: 0,
    w: 1153,
    h: 111,
    label: '.sources',
    chips: ['Interviews', 'Org chart', 'Metrics & OKRs', 'Meeting notes', 'Notion', 'Slack', 'Gmail', 'Hubspot', 'Google Sheets', 'Many more..'],
  },
  { id: 'raw', x: 453, y: 162, w: 248, h: 111, label: '.raw-data', chips: ['MD', 'PDF', 'XLSX', 'transcripts'] },
  { id: 'people', x: 194, y: 324, w: 156, h: 120, kicker: 'observer', label: '.people', chips: ['roles', 'depts', 'OKRs'] },
  { id: 'product', x: 356, y: 324, w: 174, h: 120, kicker: 'observer', label: '.product', chips: ['tech stack', 'systems'] },
  { id: 'operations', x: 536, y: 324, w: 218, h: 120, kicker: 'observer', label: '.operations', chips: ['process', 'financials'] },
  { id: 'market', x: 760, y: 324, w: 200, h: 120, kicker: 'observer', label: '.market', chips: ['competitors', 'customers'] },
  { id: 'judge', x: 379, y: 495, w: 396, h: 111, highlight: true, label: 'company-merge-judge', chips: ['dedup', 'resolve', 'write plan'] },
  { id: 'vCompany', x: 0, y: 657, w: 380, h: 120, kicker: 'vault', label: '.company', chips: ['stable facts'] },
  { id: 'vEngage', x: 386, y: 657, w: 380, h: 120, kicker: 'vault', label: '.engagement', chips: ['operational record'] },
  { id: 'vWorking', x: 772, y: 657, w: 381, h: 120, kicker: 'vault', label: '.working-memory', chips: ['synthesis & priorities'] },
]

const edges = [
  ['sources', 'raw'],
  ['raw', 'people'],
  ['raw', 'product'],
  ['raw', 'operations'],
  ['raw', 'market'],
  ['people', 'judge'],
  ['product', 'judge'],
  ['operations', 'judge'],
  ['market', 'judge'],
  ['judge', 'vCompany'],
  ['judge', 'vEngage'],
  ['judge', 'vWorking'],
] as const

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return reduced
}

function smoothPulse(progress: number) {
  if (progress < 0.12) return progress / 0.12
  if (progress > 0.88) return (1 - progress) / 0.12
  return 1
}

function cardStyle(card: Card) {
  return {
    left: `${(card.x / WIDTH) * 100}%`,
    top: `${(card.y / HEIGHT) * 100}%`,
    width: `${(card.w / WIDTH) * 100}%`,
    height: `${(card.h / HEIGHT) * 100}%`,
  }
}

function bottom(card: Card) {
  return { x: card.x + card.w / 2, y: card.y + card.h }
}

function top(card: Card) {
  return { x: card.x + card.w / 2, y: card.y }
}

function edgePath(from: Card, to: Card) {
  const a = bottom(from)
  const b = top(to)
  const mid = (a.y + b.y) / 2
  return `M ${a.x} ${a.y} C ${a.x} ${mid} ${b.x} ${mid} ${b.x} ${b.y}`
}

function FlowCard({ card }: { card: Card }) {
  return (
    <div className="context-card" data-highlight={card.highlight ? 'true' : 'false'} style={cardStyle(card)}>
      {card.kicker ? <div className="context-card__kicker">{card.kicker}</div> : null}
      <div className="context-card__label">{card.label}</div>
      <div className="context-card__chips">
        {card.chips.map((chip) => (
          <span className="context-chip" key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ContextGraph() {
  const reducedMotion = useReducedMotion()
  const [surge, setSurge] = useState(false)
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [])
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const dotRefs = useRef<(SVGCircleElement | null)[][]>([])
  const surgeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const runners = edges.flatMap((_, edgeIndex) => {
      const path = pathRefs.current[edgeIndex]
      const dots = dotRefs.current[edgeIndex] ?? []
      if (!path || dots.length === 0) return []

      const length = path.getTotalLength()
      if (length <= 0) return []

      if (reducedMotion) {
        dots.forEach((dot, dotIndex) => {
          if (!dot) return
          const point = path.getPointAtLength(length * (0.32 + dotIndex * 0.08))
          dot.setAttribute('cx', point.x.toFixed(1))
          dot.setAttribute('cy', point.y.toFixed(1))
          dot.style.opacity = String(TRAIL_OPACITY[dotIndex] ?? 0.2)
        })
        return []
      }

      return [
        {
          path,
          dots,
          length,
          duration: (1.18 + ((edgeIndex * 7) % 6) * 0.09) * FLOW_SPEED_MULTIPLIER,
          delay: (edgeIndex % 4) * 0.08,
        },
      ]
    })

    if (reducedMotion || runners.length === 0) return undefined

    const updateDots = (now: number) => {
      const seconds = now / 1000

      runners.forEach((runner) => {
        let baseProgress = ((seconds - runner.delay) / runner.duration) % 1
        if (baseProgress < 0) baseProgress += 1

        runner.dots.forEach((dot, dotIndex) => {
          if (!dot) return
          const progress = (baseProgress - dotIndex * 0.055 + 1) % 1
          const point = runner.path.getPointAtLength(progress * runner.length)
          dot.setAttribute('cx', point.x.toFixed(1))
          dot.setAttribute('cy', point.y.toFixed(1))
          dot.style.opacity = String((TRAIL_OPACITY[dotIndex] ?? 0.2) * smoothPulse(progress))
        })
      })
    }

    let frame = 0
    const tick = (now: number) => {
      updateDots(now)
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    const interval = window.setInterval(() => updateDots(performance.now()), 1000 / 30)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearInterval(interval)
    }
  }, [reducedMotion])

  const triggerSurge = () => {
    window.clearTimeout(surgeTimer.current)
    setSurge(true)
    surgeTimer.current = window.setTimeout(() => setSurge(false), 1400)
  }

  useEffect(() => () => window.clearTimeout(surgeTimer.current), [])

  return (
    <section className="context-graph-stage" aria-label="Context graph animation">
      <div className="context-graph-sticky">
        <div className="context-graph-shell" data-testid="context-graph" data-surge={surge ? 'true' : 'false'} onPointerDown={triggerSurge}>
          <h1 className="context-graph-title">Setting contexts.Graph</h1>
          <div className="context-graph-scroll">
            <div className="context-graph-board">
              <svg className="context-graph-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                {edges.map(([fromId, toId], edgeIndex) => {
                  const from = cardMap.get(fromId)
                  const to = cardMap.get(toId)
                  if (!from || !to) return null

                  return (
                    <path
                      className="context-edge"
                      d={edgePath(from, to)}
                      fill="none"
                      key={`${fromId}-${toId}`}
                      ref={(node) => {
                        pathRefs.current[edgeIndex] = node
                      }}
                    />
                  )
                })}
                {edges.map(([fromId], edgeIndex) => {
                  const from = cardMap.get(fromId)
                  if (!from) return null
                  return (
                    <g key={`dots-${edgeIndex}`}>
                      {Array.from({ length: DOT_COUNT }, (_, dotIndex) => (
                        <circle
                          className="context-flow-dot"
                          data-flow-dot="true"
                          cx={from.x + from.w / 2}
                          cy={from.y + from.h}
                          key={dotIndex}
                          r={9}
                          ref={(node) => {
                            if (!dotRefs.current[edgeIndex]) dotRefs.current[edgeIndex] = []
                            dotRefs.current[edgeIndex][dotIndex] = node
                          }}
                        />
                      ))}
                    </g>
                  )
                })}
              </svg>
              {cards.map((card) => (
                <FlowCard card={card} key={card.id} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
