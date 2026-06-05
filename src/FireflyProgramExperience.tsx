import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { PROGRAM_TRACKS, TRACK_BY_ID, type TrackId } from './programTracks'

type FireflyProgramExperienceProps = {
  activeTrack: TrackId
  onTrackChange: (track: TrackId) => void
}

type NodeId =
  | 'prereq'
  | 'enterprise'
  | 'founders'
  | 'personal'
  | 'routing'
  | 'core'
  | 'personal-system'
  | 'automation'
  | 'team'
  | 'strategy'
  | 'artifacts'
  | 'memory'

type PathNode = {
  id: NodeId
  title: string
  kicker?: string
  chips?: string[]
  x: number
  y: number
  w: number
  h: number
  track?: TrackId
  tone?: 'base' | 'role' | 'artifact' | 'final'
}

type CalendarItem = {
  date: number
  title: string
  meta: string
  tracks: TrackId[]
}

type CodosGraphTone = 'source' | 'raw' | 'observer' | 'judge' | 'vault'

type CodosGraphNode = {
  id: NodeId
  title: string
  kicker?: string
  chips: string[]
  x: number
  y: number
  w: number
  h: number
  track?: TrackId
  tone: CodosGraphTone
}

type CodosGraphEdge = {
  from: NodeId
  to: NodeId
}

type ProgramBubble = {
  cx: number
  cy: number
  r: number
  stroke: string
  fill: string
  opacity: number
  width: number
}

const PATH_NODES: PathNode[] = [
  {
    id: 'prereq',
    title: 'POS archive + baseline tasks',
    kicker: '/prereq',
    chips: ['личный стек', 'контекст', 'первые навыки'],
    x: 9,
    y: 5,
    w: 82,
    h: 10,
    tone: 'base',
  },
  {
    id: 'enterprise',
    title: 'enterprise',
    kicker: 'role',
    chips: ['curator', 'company graph'],
    x: 8,
    y: 23,
    w: 26,
    h: 12,
    track: 'enterprise',
    tone: 'role',
  },
  {
    id: 'founders',
    title: 'founders / smb',
    kicker: 'role',
    chips: ['curator', 'growth map'],
    x: 37,
    y: 23,
    w: 26,
    h: 12,
    track: 'founders',
    tone: 'role',
  },
  {
    id: 'personal',
    title: 'micro / personal',
    kicker: 'role',
    chips: ['curator', 'personal OS'],
    x: 66,
    y: 23,
    w: 26,
    h: 12,
    track: 'personal',
    tone: 'role',
  },
  {
    id: 'routing',
    title: 'маршрутизация',
    chips: ['5-7 вопросов', 'по типу работы'],
    x: 38,
    y: 43,
    w: 24,
    h: 12,
    tone: 'base',
  },
  {
    id: 'core',
    title: 'общее ядро',
    chips: ['нулевой старт 48ч', 'weekly pulse'],
    x: 38,
    y: 62,
    w: 24,
    h: 12,
    tone: 'base',
  },
  {
    id: 'personal-system',
    title: 'личная система',
    chips: ['среда на каждый день'],
    x: 6,
    y: 82,
    w: 23,
    h: 12,
    tone: 'artifact',
  },
  {
    id: 'automation',
    title: 'прикладная автоматизация',
    chips: ['процесс в работе'],
    x: 33,
    y: 82,
    w: 26,
    h: 12,
    tone: 'artifact',
  },
  {
    id: 'team',
    title: 'командное внедрение',
    chips: ['пилот в команде'],
    x: 64,
    y: 82,
    w: 24,
    h: 12,
    tone: 'artifact',
  },
  {
    id: 'strategy',
    title: 'стратегический поиск',
    chips: ['гипотеза проверена'],
    x: 74,
    y: 101,
    w: 24,
    h: 12,
    tone: 'artifact',
  },
  {
    id: 'artifacts',
    title: 'артефакты',
    chips: ['operating map', 'workflow / pilot'],
    x: 38,
    y: 119,
    w: 24,
    h: 12,
    tone: 'final',
  },
  {
    id: 'memory',
    title: 'ГигаЭйАй · система-память',
    chips: ['LMS', '400+ skills', 'MCP tutor'],
    x: 38,
    y: 141,
    w: 24,
    h: 12,
    tone: 'final',
  },
]

const CALENDAR_ITEMS: CalendarItem[] = [
  { date: 6, title: 'Kickoff + baseline', meta: 'общий старт', tracks: ['enterprise', 'founders', 'personal'] },
  { date: 8, title: 'Personal stack', meta: 'система на каждый день', tracks: ['personal'] },
  { date: 9, title: 'Founder map', meta: 'цели, unit economics', tracks: ['founders'] },
  { date: 10, title: 'Company ontology', meta: 'структура компании', tracks: ['enterprise'] },
  { date: 11, title: 'Prompt routines', meta: 'персональные навыки', tracks: ['personal'] },
  { date: 12, title: 'Agent infra', meta: 'каркас компании', tracks: ['founders'] },
  { date: 13, title: 'Access + safety', meta: 'политики и аудит', tracks: ['enterprise'] },
  { date: 15, title: 'Sales automations', meta: 'воронка и follow-up', tracks: ['founders'] },
  { date: 16, title: 'Personal workflows', meta: 'ежедневные циклы', tracks: ['personal'] },
  { date: 17, title: 'Ops / HR / finance', meta: 'процессы внедрения', tracks: ['enterprise'] },
  { date: 18, title: 'Marketing agents', meta: 'контент и аналитика', tracks: ['founders'] },
  { date: 19, title: 'Personal OS clinic', meta: 'память и контекст', tracks: ['personal'] },
  { date: 20, title: 'Team pilot', meta: 'ролевая карта', tracks: ['enterprise'] },
  { date: 22, title: 'Strategy search', meta: 'гипотезы и рынок', tracks: ['founders', 'personal'] },
  { date: 24, title: 'Implementation plan', meta: '90 дней', tracks: ['enterprise'] },
  { date: 25, title: 'Skill set assembly', meta: 'личный набор', tracks: ['personal'] },
  { date: 26, title: 'Artifacts clinic', meta: 'операционная карта', tracks: ['enterprise', 'founders', 'personal'] },
  { date: 27, title: 'Demo Day + memory', meta: 'система-память', tracks: ['enterprise', 'founders', 'personal'] },
]

const NODE_CALENDAR_DATES: Partial<Record<NodeId, number[]>> = {
  prereq: [6],
  enterprise: [10, 13],
  founders: [9, 12],
  personal: [8, 11],
  routing: [6],
  core: [12, 13, 19],
  'personal-system': [8, 16, 19, 25],
  automation: [15, 16, 18],
  team: [17, 20],
  strategy: [22],
  artifacts: [24, 26],
  memory: [27],
}

function isActiveNode(node: PathNode, activeTrack: TrackId) {
  return TRACK_BY_ID[activeTrack].pathNodes.includes(node.id)
}

function nodeCalendarItemsById(nodeId: NodeId, activeTrack: TrackId) {
  const dates = NODE_CALENDAR_DATES[nodeId] ?? []
  return dates
    .map((date) => CALENDAR_ITEMS.find((item) => item.date === date))
    .filter((item): item is CalendarItem => Boolean(item && item.tracks.includes(activeTrack)))
}

function nodeCalendarItems(node: PathNode, activeTrack: TrackId) {
  return nodeCalendarItemsById(node.id, activeTrack)
}

const CODOS_GRAPH_WIDTH = 1153
const CODOS_GRAPH_HEIGHT = 777
const CODOS_DOT_COUNT = 4
const CODOS_TRAIL_OPACITY = [1, 0.55, 0.32, 0.18]

const CODOS_GRAPH_NODES: CodosGraphNode[] = [
  {
    id: 'prereq',
    x: 0,
    y: 0,
    w: 1153,
    h: 112,
    kicker: '.sources',
    title: 'program sources',
    chips: ['POS archive', 'baseline tasks', 'role notes', 'LMS', 'work context', 'calendar'],
    tone: 'source',
  },
  {
    id: 'routing',
    x: 445,
    y: 158,
    w: 264,
    h: 112,
    kicker: '.raw-data',
    title: 'routing',
    chips: ['5-7 вопросов', 'тип работы', 'контекст'],
    tone: 'raw',
  },
  {
    id: 'enterprise',
    x: 166,
    y: 318,
    w: 178,
    h: 122,
    kicker: 'observer',
    title: '.enterprise',
    chips: ['C-level', 'HRD', 'company graph'],
    track: 'enterprise',
    tone: 'observer',
  },
  {
    id: 'founders',
    x: 358,
    y: 318,
    w: 194,
    h: 122,
    kicker: 'observer',
    title: '.founders',
    chips: ['founder', 'COO', 'growth map'],
    track: 'founders',
    tone: 'observer',
  },
  {
    id: 'personal',
    x: 566,
    y: 318,
    w: 206,
    h: 122,
    kicker: 'observer',
    title: '.personal',
    chips: ['solo', 'expert', 'personal OS'],
    track: 'personal',
    tone: 'observer',
  },
  {
    id: 'core',
    x: 786,
    y: 318,
    w: 196,
    h: 122,
    kicker: 'observer',
    title: '.common-core',
    chips: ['48h start', 'weekly pulse'],
    tone: 'observer',
  },
  {
    id: 'artifacts',
    x: 365,
    y: 492,
    w: 424,
    h: 112,
    title: 'program-merge-judge',
    chips: ['dedup', 'resolve', 'write plan'],
    tone: 'judge',
  },
  {
    id: 'team',
    x: 0,
    y: 658,
    w: 364,
    h: 119,
    kicker: 'vault',
    title: '.company-rollout',
    chips: ['pilot', 'access', 'safety'],
    tone: 'vault',
  },
  {
    id: 'automation',
    x: 382,
    y: 658,
    w: 376,
    h: 119,
    kicker: 'vault',
    title: '.automation',
    chips: ['sales', 'marketing', 'workflow'],
    tone: 'vault',
  },
  {
    id: 'memory',
    x: 776,
    y: 658,
    w: 377,
    h: 119,
    kicker: 'vault',
    title: '.working-memory',
    chips: ['LMS', '400+ skills', 'Demo Day'],
    tone: 'vault',
  },
]

const CODOS_GRAPH_EDGES: CodosGraphEdge[] = [
  { from: 'prereq', to: 'routing' },
  { from: 'routing', to: 'enterprise' },
  { from: 'routing', to: 'founders' },
  { from: 'routing', to: 'personal' },
  { from: 'routing', to: 'core' },
  { from: 'enterprise', to: 'artifacts' },
  { from: 'founders', to: 'artifacts' },
  { from: 'personal', to: 'artifacts' },
  { from: 'core', to: 'artifacts' },
  { from: 'artifacts', to: 'team' },
  { from: 'artifacts', to: 'automation' },
  { from: 'artifacts', to: 'memory' },
]

const CODOS_GRAPH_ACTIVE_NODES: Record<TrackId, NodeId[]> = {
  enterprise: ['prereq', 'routing', 'enterprise', 'core', 'artifacts', 'team', 'memory'],
  founders: ['prereq', 'routing', 'founders', 'core', 'artifacts', 'automation', 'memory'],
  personal: ['prereq', 'routing', 'personal', 'core', 'artifacts', 'automation', 'memory'],
}

const CODOS_GRAPH_ACTIVE_EDGES: Record<TrackId, string[]> = {
  enterprise: ['prereq->routing', 'routing->enterprise', 'routing->core', 'enterprise->artifacts', 'core->artifacts', 'artifacts->team', 'artifacts->memory'],
  founders: ['prereq->routing', 'routing->founders', 'routing->core', 'founders->artifacts', 'core->artifacts', 'artifacts->automation', 'artifacts->memory'],
  personal: ['prereq->routing', 'routing->personal', 'routing->core', 'personal->artifacts', 'core->artifacts', 'artifacts->automation', 'artifacts->memory'],
}

function pseudoRandom(seed: number) {
  return Math.sin(seed * 12.9898) * 43758.5453 % 1
}

function makeProgramBubbles() {
  const clusters = [
    { x: 880, y: 12, rx: 210, ry: 116, count: 74 },
    { x: 795, y: 410, rx: 250, ry: 120, count: 86 },
    { x: 1026, y: 520, rx: 168, ry: 154, count: 62 },
    { x: 650, y: 588, rx: 190, ry: 96, count: 52 },
  ]
  const strokes = ['#ff8a00', '#ffd600', '#ff66b2', '#ffffff', '#ffb8cf']
  const fills = ['transparent', 'rgba(255, 214, 0, 0.08)', 'rgba(255, 102, 178, 0.06)', 'rgba(255, 255, 255, 0.16)']
  const bubbles: ProgramBubble[] = []

  clusters.forEach((cluster, clusterIndex) => {
    Array.from({ length: cluster.count }, (_, index) => {
      const seed = clusterIndex * 97 + index * 13 + 3
      const angle = pseudoRandom(seed) * Math.PI * 2
      const distance = Math.sqrt(Math.abs(pseudoRandom(seed + 4)))
      const cx = cluster.x + Math.cos(angle) * cluster.rx * distance
      const cy = cluster.y + Math.sin(angle) * cluster.ry * distance
      bubbles.push({
        cx,
        cy,
        r: 2.2 + Math.abs(pseudoRandom(seed + 9)) * 12.5,
        stroke: strokes[(index + clusterIndex) % strokes.length],
        fill: fills[(index + clusterIndex * 2) % fills.length],
        opacity: 0.16 + Math.abs(pseudoRandom(seed + 15)) * 0.48,
        width: 0.8 + Math.abs(pseudoRandom(seed + 22)) * 2.2,
      })
    })
  })

  return bubbles
}

const PROGRAM_BUBBLES = makeProgramBubbles()

function edgeKey(edge: CodosGraphEdge) {
  return `${edge.from}->${edge.to}`
}

function codosCardStyle(card: CodosGraphNode) {
  return {
    left: `${(card.x / CODOS_GRAPH_WIDTH) * 100}%`,
    top: `${(card.y / CODOS_GRAPH_HEIGHT) * 100}%`,
    width: `${(card.w / CODOS_GRAPH_WIDTH) * 100}%`,
    height: `${(card.h / CODOS_GRAPH_HEIGHT) * 100}%`,
  }
}

function codosBottom(card: CodosGraphNode) {
  return { x: card.x + card.w / 2, y: card.y + card.h }
}

function codosTop(card: CodosGraphNode) {
  return { x: card.x + card.w / 2, y: card.y }
}

function codosEdgePath(from: CodosGraphNode, to: CodosGraphNode) {
  const start = codosBottom(from)
  const end = codosTop(to)
  const middle = (start.y + end.y) / 2
  const bend = Math.min(72, Math.abs(start.x - end.x) * 0.14)
  return `M ${start.x} ${start.y} C ${start.x} ${middle + bend * 0.1} ${end.x} ${middle - bend * 0.1} ${end.x} ${end.y}`
}

function smoothRunnerPulse(progress: number) {
  if (progress < 0.12) return progress / 0.12
  if (progress > 0.88) return (1 - progress) / 0.12
  return 1
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      setReduced(query.matches)
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return reduced
}

function ProgramBubbleCloud() {
  return (
    <svg className="program-codos-bubbles" viewBox={`0 0 ${CODOS_GRAPH_WIDTH} ${CODOS_GRAPH_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      {PROGRAM_BUBBLES.map((bubble, index) => (
        <circle
          cx={bubble.cx.toFixed(1)}
          cy={bubble.cy.toFixed(1)}
          fill={bubble.fill}
          key={`${bubble.cx}-${bubble.cy}-${index}`}
          opacity={bubble.opacity.toFixed(2)}
          r={bubble.r.toFixed(1)}
          stroke={bubble.stroke}
          strokeWidth={bubble.width.toFixed(1)}
        />
      ))}
    </svg>
  )
}

function ProgramCodosCard({
  active,
  card,
  events,
  onTrackChange,
}: {
  active: boolean
  card: CodosGraphNode
  events: CalendarItem[]
  onTrackChange: (track: TrackId) => void
}) {
  const content = (
    <>
      {card.kicker ? <span className="program-codos-card__kicker">{card.kicker}</span> : null}
      <span className="program-codos-card__label">{card.title}</span>
      <span className="program-codos-card__chips">
        {card.chips.map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
      </span>
      {events.length > 0 ? (
        <span className="program-codos-card__events">
          {events.slice(0, 2).map((event) => (
            <span key={`${card.id}-${event.date}`}>
              <b>{event.date} июня</b>
              {event.title}
            </span>
          ))}
        </span>
      ) : null}
    </>
  )

  const commonProps = {
    className: 'program-codos-card',
    'data-active': active,
    'data-tone': card.tone,
    style: codosCardStyle(card),
  }

  if (card.track) {
    return (
      <button {...commonProps} aria-pressed={active} onClick={() => onTrackChange(card.track as TrackId)} type="button">
        {content}
      </button>
    )
  }

  return <div {...commonProps}>{content}</div>
}

function CodosPathGraph({ activeTrack, onTrackChange }: FireflyProgramExperienceProps) {
  const active = TRACK_BY_ID[activeTrack]
  const reducedMotion = useReducedMotion()
  const cardMap = useMemo(() => new Map(CODOS_GRAPH_NODES.map((card) => [card.id, card])), [])
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const dotRefs = useRef<(SVGCircleElement | null)[][]>([])
  const activeNodes = useMemo(() => new Set(CODOS_GRAPH_ACTIVE_NODES[activeTrack]), [activeTrack])
  const activeEdges = useMemo(() => new Set(CODOS_GRAPH_ACTIVE_EDGES[activeTrack]), [activeTrack])

  useEffect(() => {
    const runners = CODOS_GRAPH_EDGES.flatMap((edge, edgeIndex) => {
      const path = pathRefs.current[edgeIndex]
      const dots = dotRefs.current[edgeIndex] ?? []
      const activeEdge = activeEdges.has(edgeKey(edge))

      dots.forEach((dot) => {
        if (dot) dot.style.opacity = '0'
      })

      if (!path || !activeEdge || dots.length === 0) return []

      const length = path.getTotalLength()
      if (length <= 0) return []

      if (reducedMotion) {
        dots.forEach((dot, dotIndex) => {
          if (!dot) return
          const point = path.getPointAtLength(length * (0.42 + dotIndex * 0.06))
          dot.setAttribute('cx', point.x.toFixed(1))
          dot.setAttribute('cy', point.y.toFixed(1))
          dot.style.opacity = String(CODOS_TRAIL_OPACITY[dotIndex] ?? 0.2)
        })
        return []
      }

      return [
        {
          path,
          dots,
          length,
          duration: 4.8 + (edgeIndex % 5) * 0.34,
          delay: (edgeIndex % 4) * 0.16,
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
          dot.style.opacity = String((CODOS_TRAIL_OPACITY[dotIndex] ?? 0.2) * smoothRunnerPulse(progress))
        })
      })
    }

    let frame = 0
    const tick = (now: number) => {
      updateDots(now)
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [activeEdges, reducedMotion])

  return (
    <section className="program-codos-stage" data-testid="program-codos-graph" style={{ '--track-color': active.color, '--track-muted': active.mutedColor } as CSSProperties}>
      <div className="program-codos-sticky">
        <div className="program-codos-shell">
          <div className="program-codos-head">
            <p className="program-path-kicker">// duplicate graph</p>
            <h2>Setting tracks.Graph</h2>
            <div className="program-codos-tabs" aria-label="program graph tracks">
              {PROGRAM_TRACKS.map((track) => (
                <button
                  data-active={track.id === activeTrack}
                  key={track.id}
                  onClick={() => onTrackChange(track.id)}
                  style={{ '--track-color': track.color, '--track-muted': track.mutedColor } as CSSProperties}
                  type="button"
                >
                  {track.shortLabel}
                </button>
              ))}
            </div>
          </div>
          <div className="program-codos-scroll">
            <div className="program-codos-board">
              <ProgramBubbleCloud />
              <svg className="program-codos-svg" viewBox={`0 0 ${CODOS_GRAPH_WIDTH} ${CODOS_GRAPH_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                {CODOS_GRAPH_EDGES.map((edge, edgeIndex) => {
                  const from = cardMap.get(edge.from)
                  const to = cardMap.get(edge.to)
                  if (!from || !to) return null
                  const activeEdge = activeEdges.has(edgeKey(edge))

                  return (
                    <path
                      className="program-codos-edge"
                      data-active={activeEdge}
                      d={codosEdgePath(from, to)}
                      fill="none"
                      key={edgeKey(edge)}
                      ref={(node) => {
                        pathRefs.current[edgeIndex] = node
                      }}
                    />
                  )
                })}
                {CODOS_GRAPH_EDGES.map((edge, edgeIndex) => {
                  const from = cardMap.get(edge.from)
                  if (!from) return null
                  return (
                    <g key={`dots-${edgeKey(edge)}`}>
                      {Array.from({ length: CODOS_DOT_COUNT }, (_, dotIndex) => (
                        <circle
                          className="program-codos-flow-dot"
                          cx={from.x + from.w / 2}
                          cy={from.y + from.h}
                          data-flow-dot="true"
                          key={dotIndex}
                          r={8.5}
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
              {CODOS_GRAPH_NODES.map((card) => (
                <ProgramCodosCard active={activeNodes.has(card.id)} card={card} events={nodeCalendarItemsById(card.id, activeTrack)} key={card.id} onTrackChange={onTrackChange} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PathGraph({ activeTrack, onTrackChange }: FireflyProgramExperienceProps) {
  const active = TRACK_BY_ID[activeTrack]

  return (
    <section className="program-path-stage" data-testid="program-path" style={{ '--track-color': active.color, '--track-muted': active.mutedColor } as CSSProperties}>
      <div className="program-path-sticky">
        <div className="program-path-shell">
          <div className="program-path-head">
            <div>
              <p className="program-path-kicker">// participant path</p>
              <h2 className="program-path-title">маршрут под выбранную роль</h2>
            </div>
            <div className="program-track-tabs" aria-label="program tracks">
              {PROGRAM_TRACKS.map((track) => (
                <button
                  className="program-track-tab"
                  data-active={track.id === activeTrack}
                  key={track.id}
                  onClick={() => onTrackChange(track.id)}
                  style={{ '--track-color': track.color, '--track-muted': track.mutedColor } as CSSProperties}
                  type="button"
                >
                  <span>{track.shortLabel}</span>
                  <small>{track.chips.slice(0, 2).join(' / ')}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="program-path-board">
            {PATH_NODES.map((node, index) => {
              const activeNode = isActiveNode(node, activeTrack)
              const interactiveTrack = node.track
              const events = nodeCalendarItems(node, activeTrack)
              const hasEvents = events.length > 0
              const content = (
                <>
                  <span className="program-node__meta">
                    {node.kicker ? <span className="program-node__kicker">{node.kicker}</span> : null}
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </span>
                  <span className="program-node__title">{node.title}</span>
                  <span className="program-node__chips">
                    {node.chips?.map((chip) => <span key={chip}>{chip}</span>)}
                  </span>
                  {hasEvents ? (
                    <span className="program-node__events">
                      {events.map((event) => (
                        <span key={`${node.id}-${event.date}`}>
                          <b>{event.date} июня</b>
                          {event.title}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </>
              )

              const nodeElement = interactiveTrack ? (
                <button
                  className="program-node"
                  data-active={activeNode}
                  data-tone={node.tone ?? 'base'}
                  onClick={() => onTrackChange(interactiveTrack)}
                  type="button"
                >
                  {content}
                </button>
              ) : (
                <div className="program-node" data-active={activeNode} data-tone={node.tone ?? 'base'}>
                  {content}
                </div>
              )

              return (
                <div className="program-node-row" data-active={activeNode} data-has-events={hasEvents} key={node.id}>
                  <div className="program-node-date" aria-hidden="true">
                    {hasEvents ? (
                      <>
                        <span>{events[0].date}</span>
                        <small>июня</small>
                      </>
                    ) : (
                      <span>·</span>
                    )}
                  </div>
                  {nodeElement}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function TrackCalendar({ activeTrack, onTrackChange }: FireflyProgramExperienceProps) {
  const active = TRACK_BY_ID[activeTrack]
  const dateItems = new Map(CALENDAR_ITEMS.map((item) => [item.date, item]))
  const days = Array.from({ length: 22 }, (_, index) => index + 6)

  return (
    <section className="program-calendar-stage" data-testid="track-calendar" style={{ '--track-color': active.color, '--track-muted': active.mutedColor } as CSSProperties}>
      <div className="program-calendar-shell">
        <div className="program-calendar-head">
          <p className="program-path-kicker">// sprint calendar</p>
          <h2>6-27 июня</h2>
          <div className="program-calendar-tabs">
            {PROGRAM_TRACKS.map((track) => (
              <button
                data-active={track.id === activeTrack}
                key={track.id}
                onClick={() => onTrackChange(track.id)}
                style={{ '--track-color': track.color, '--track-muted': track.mutedColor } as CSSProperties}
                type="button"
              >
                {track.shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="program-calendar-grid">
          {days.map((date) => {
            const item = dateItems.get(date)
            const dateObj = new Date(2026, 5, date)
            const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(dateObj)
            const activeDay = Boolean(item?.tracks.includes(activeTrack))
            const shared = Boolean(item && item.tracks.length === PROGRAM_TRACKS.length)

            return (
              <article className="program-day" data-active={activeDay} data-shared={shared} key={date}>
                <div className="program-day__date">
                  <span>{date}</span>
                  <small>{weekday}</small>
                </div>
                {item ? (
                  <div className="program-day__body">
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </div>
                ) : (
                  <div className="program-day__body program-day__body--empty">
                    <span>practice window</span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function FireflyProgramExperience(props: FireflyProgramExperienceProps) {
  return (
    <>
      <PathGraph {...props} />
      <CodosPathGraph {...props} />
      <TrackCalendar {...props} />
    </>
  )
}
