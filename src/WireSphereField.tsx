import { useEffect, useRef, useState } from 'react'

import { TRACK_BY_ID, type TrackId } from './programTracks'

const BURST_COUNT = 7
const CAMERA_Z = 9.4
const CAMERA_FOV = 43
const CLOUD_OFFSETS = [
  [-0.86, -0.12],
  [-0.34, -0.05],
  [0.22, 0.03],
  [0.72, -0.02],
  [-0.58, 0.36],
  [-0.02, 0.34],
  [0.48, 0.32],
] as const
const SPHERE_TRACKS: Partial<Record<number, TrackId>> = {
  0: 'enterprise',
  1: 'founders',
  3: 'personal',
}

type Vec3 = {
  x: number
  y: number
  z: number
}

type Route = {
  target: Vec3
  scale: number
  fade: number
  energy: number
}

type SketchParticle = {
  angle: number
  phi: number
  offset: number
  seed: number
  speed: number
  partner: number
}

type SketchSphere = {
  baseRadius: number
  density: number
  index: number
  particles: SketchParticle[]
  pos: { x: number; y: number }
  target: { x: number; y: number }
  radius: number
}

type PointerState = {
  x: number
  y: number
  active: number
  clickX: number
  clickY: number
  clickAge: number
}

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function smoothstep(value: number, min: number, max: number) {
  const t = clamp((value - min) / Math.max(0.0001, max - min), 0, 1)
  return t * t * (3 - 2 * t)
}

function bell(progress: number, center: number, width: number) {
  const distance = Math.abs(progress - center) / Math.max(0.001, width)
  if (distance >= 1) return 0
  const value = 1 - distance
  return value * value * (3 - 2 * value)
}

function mixVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  }
}

function getScrollProgress() {
  const limit = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  return clamp(window.scrollY / limit, 0, 1)
}

function routeBurst(index: number, progress: number, viewWidth: number, viewHeight: number, elapsed: number): Route {
  const phase = index * 0.83
  const clusterPhase = index * 2.399
  const graphAnchors = [
    [0.5, 0.16],
    [0.28, 0.42],
    [0.42, 0.42],
    [0.58, 0.42],
    [0.73, 0.42],
    [0.5, 0.62],
    [0.22, 0.84],
  ] as const
  const anchor = graphAnchors[index % graphAnchors.length]
  const home = {
    x: (index % 3 - 1) * viewWidth * 0.2 + Math.sin(phase) * 0.45,
    y: (index < 4 ? 0.22 : -0.24) * viewHeight + Math.cos(phase) * 0.32,
    z: Math.sin(phase * 1.4) * 0.55,
  }
  const sweep = {
    x: (index % 2 === 0 ? -1 : 1) * viewWidth * (0.42 + index * 0.035),
    y: Math.sin(index * 1.2) * viewHeight * 0.34,
    z: Math.cos(index * 0.9) * 0.72,
  }
  const graph = {
    x: (anchor[0] - 0.5) * viewWidth * 0.88,
    y: (0.5 - anchor[1]) * viewHeight * 0.68,
    z: Math.sin(index * 0.77) * 0.3,
  }
  const micro = {
    x: -viewWidth * 0.28 + Math.cos(clusterPhase) * viewWidth * 0.012,
    y: viewHeight * 0.02 + Math.sin(clusterPhase) * viewHeight * 0.018,
    z: Math.sin(index) * 0.08,
  }
  const graphCloud = {
    x: -viewWidth * 0.3 + Math.cos(clusterPhase) * viewWidth * 0.01,
    y: viewHeight * 0.03 + Math.sin(clusterPhase) * viewHeight * 0.014,
    z: Math.sin(index * 1.7) * 0.06,
  }
  const release = {
    x: viewWidth * (-0.32 + ((index * 0.23) % 0.64)) + Math.sin(index) * 0.22,
    y: viewHeight * (0.22 - ((index * 0.19) % 0.44)),
    z: Math.sin(index * 2.1) * 0.62,
  }
  const afterglow = {
    x: Math.sin(index * 1.37 + elapsed * 0.08) * viewWidth * 0.36,
    y: Math.cos(index * 1.03 + elapsed * 0.07) * viewHeight * 0.28,
    z: Math.sin(index + elapsed * 0.11) * 0.72,
  }
  const vanish = {
    x: (index % 2 === 0 ? -1 : 1) * viewWidth * (0.65 + index * 0.04),
    y: viewHeight * (index % 3 === 0 ? 0.62 : -0.58),
    z: -0.9 + index * 0.12,
  }

  let target = mixVec(home, sweep, smoothstep(progress, 0.02, 0.18))
  target = mixVec(target, graph, smoothstep(progress, 0.14, 0.34))
  target = mixVec(target, micro, smoothstep(progress, 0.36, 0.5))
  target = mixVec(target, release, smoothstep(progress, 0.5, 0.68))
  target = mixVec(target, afterglow, smoothstep(progress, 0.64, 0.82))
  target = mixVec(target, vanish, smoothstep(progress, 0.82, 0.96))

  const graphCloudPulse = bell(progress, 0.28, 0.18)
  const lateCloudPulse = bell(progress, 0.72, 0.075)
  const tinyPulse = Math.max(graphCloudPulse, lateCloudPulse)
  target = mixVec(target, graphCloud, Math.max(graphCloudPulse, lateCloudPulse * 0.72))

  target.x += Math.sin(elapsed * (0.13 + index * 0.015) + phase) * viewWidth * (0.028 + progress * 0.02)
  target.y += Math.cos(elapsed * (0.11 + index * 0.011) + phase) * viewHeight * (0.028 + progress * 0.018)

  return {
    target,
    scale: lerp(1, 0.1, tinyPulse),
    fade: 1 - smoothstep(progress, 0.88, 0.985),
    energy: 0.32 + smoothstep(progress, 0.16, 0.68) * 0.22 + bell(progress, 0.58, 0.16) * 0.3,
  }
}

function routeCloud(progress: number, viewWidth: number, viewHeight: number, elapsed: number): Route {
  const routes = Array.from({ length: BURST_COUNT }, (_, index) => routeBurst(index, progress, viewWidth, viewHeight, elapsed))
  const target = routes.reduce(
    (acc, route) => ({
      x: acc.x + route.target.x / BURST_COUNT,
      y: acc.y + route.target.y / BURST_COUNT,
      z: acc.z + route.target.z / BURST_COUNT,
    }),
    { x: 0, y: 0, z: 0 },
  )

  return {
    target,
    scale: routes.reduce((sum, route) => sum + route.scale, 0) / BURST_COUNT,
    fade: routes.reduce((sum, route) => sum + route.fade, 0) / BURST_COUNT,
    energy: routes.reduce((sum, route) => sum + route.energy, 0) / BURST_COUNT,
  }
}

function escapePulse(index: number, progress: number) {
  const early = bell(progress, 0.12 + index * 0.018, 0.032) * (index % 3 === 0 ? 1 : 0)
  const mid = bell(progress, 0.47 + index * 0.013, 0.042) * (index % 2 === 0 ? 0.9 : 0)
  const late = bell(progress, 0.69 + index * 0.011, 0.036) * (index === 1 || index === 5 ? 1 : 0)
  return Math.max(early, mid, late)
}

function noise(seed: number, time: number) {
  return Math.sin(seed * 12.9898 + time * 0.93) * Math.cos(seed * 78.233 - time * 0.71)
}

function createSpheres(width: number): SketchSphere[] {
  const random = seededRandom(6102026)
  const mobile = width < 720
  const baseRadii = mobile ? [116, 82, 52, 70, 42, 64, 34] : [248, 172, 98, 138, 78, 120, 58]
  const particleCounts = mobile ? [118, 78, 42, 64, 34, 54, 30] : [238, 152, 76, 116, 54, 94, 42]
  const maxParticles = Math.max(...particleCounts)

  return baseRadii.map((baseRadius, index) => {
    const particleCount = particleCounts[index]
    const particles = Array.from({ length: particleCount }, (_, particleIndex) => ({
      angle: random() * Math.PI * 2,
      phi: random() * Math.PI,
      offset: 0.86 + random() * 0.24,
      seed: random() * 1000 + index * 37,
      speed: 0.36 + random() * 0.92,
      partner: (particleIndex + 17 + Math.floor(random() * 41)) % particleCount,
    }))

    return {
      baseRadius,
      density: particleCount / maxParticles,
      index,
      particles,
      pos: { x: width / 2, y: window.innerHeight / 2 },
      target: { x: width / 2, y: window.innerHeight / 2 },
      radius: baseRadius,
    }
  })
}

function worldToScreen(target: Vec3, viewWidth: number, viewHeight: number, width: number, height: number) {
  return {
    x: width / 2 + (target.x / viewWidth) * width,
    y: height / 2 - (target.y / viewHeight) * height,
  }
}

function drawSphere(
  ctx: CanvasRenderingContext2D,
  sphere: SketchSphere,
  pointer: PointerState,
  elapsed: number,
  progress: number,
  fade: number,
  energy: number,
) {
  if (fade <= 0.005 || sphere.radius < 1) return

  const jitterBoost = pointer.clickAge < 0.55 ? 1.6 : 1
  const jitter = (1.6 + energy * 5.2) * jitterBoost
  const rotation = elapsed * (sphere.index % 2 === 0 ? 0.33 : -0.29) + sphere.index * 0.4
  const pulse = 1 + Math.sin(elapsed * 1.6 + sphere.index) * 0.045
  const radius = sphere.radius * pulse
  const clickPulse = Math.max(0, 1 - pointer.clickAge / 0.8)

  const points = sphere.particles.map((particle) => {
    const phi = particle.phi + Math.sin(elapsed * 0.27 + particle.seed) * 0.055
    const angle = particle.angle + elapsed * particle.speed * (sphere.index % 2 === 0 ? 1 : -1)
    const shellRadius = radius * particle.offset
    const sinPhi = Math.sin(phi)
    const rawX = shellRadius * sinPhi * Math.cos(angle)
    const rawY = shellRadius * sinPhi * Math.sin(angle)
    const rawZ = shellRadius * Math.cos(phi)
    const spinX = rawX * Math.cos(rotation) - rawZ * Math.sin(rotation)
    const spinZ = rawX * Math.sin(rotation) + rawZ * Math.cos(rotation)
    let x = sphere.pos.x + spinX
    let y = sphere.pos.y + rawY * 0.82 + spinZ * 0.14
    const depth = clamp((spinZ / Math.max(1, radius) + 1) * 0.5, 0, 1)

    const dx = pointer.x - x
    const dy = pointer.y - y
    const distance = Math.hypot(dx, dy)
    if (pointer.active && distance < 680) {
      const pull = Math.pow(1 - distance / 680, 1.58) * (245 + energy * 260)
      x += (dx / Math.max(1, distance)) * pull
      y += (dy / Math.max(1, distance)) * pull
    }

    if (clickPulse > 0) {
      const cdx = x - pointer.clickX
      const cdy = y - pointer.clickY
      const cdist = Math.hypot(cdx, cdy)
      if (cdist < 620) {
        const burst = Math.pow(1 - cdist / 620, 2) * clickPulse * 110
        x += (cdx / Math.max(1, cdist)) * burst
        y += (cdy / Math.max(1, cdist)) * burst
      }
    }

    x += noise(particle.seed, elapsed * 2.1) * jitter
    y += noise(particle.seed + 500, elapsed * 2.1) * jitter

    return { x, y, depth, partner: particle.partner }
  })

  ctx.save()
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'
  ctx.globalAlpha = fade

  ctx.beginPath()
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.closePath()
  ctx.strokeStyle = `rgba(0, 0, 0, ${0.42 + sphere.density * 0.34})`
  ctx.lineWidth = clamp(radius * (0.006 + sphere.density * 0.003), 0.65, 1.9)
  ctx.stroke()

  ctx.beginPath()
  const chordStep = sphere.density > 0.72 ? 2 : sphere.density > 0.42 ? 3 : 4
  for (let i = 0; i < points.length; i += chordStep) {
    const a = points[i]
    const b = points[a.partner]
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.strokeStyle = `rgba(0, 0, 0, ${0.12 + sphere.density * 0.26})`
  ctx.lineWidth = clamp(radius * (0.0038 + sphere.density * 0.0024), 0.38, 1.28)
  ctx.stroke()

  ctx.beginPath()
  const spikeStep = sphere.density > 0.7 ? 11 : 7
  for (let i = 0; i < points.length; i += spikeStep) {
    const point = points[i]
    const length = radius * (0.16 + point.depth * 0.12)
    const angle = elapsed * 0.7 + i * 0.61
    ctx.moveTo(point.x, point.y)
    ctx.lineTo(point.x + Math.cos(angle) * length, point.y + Math.sin(angle) * length)
  }
  ctx.strokeStyle = `rgba(0, 0, 0, ${0.24 + sphere.density * 0.24})`
  ctx.lineWidth = clamp(radius * 0.006, 0.55, 1.35)
  ctx.stroke()

  const ringTotal = Math.max(2, Math.round(2 + sphere.density * 3))
  for (let ring = 0; ring < ringTotal; ring += 1) {
    const ringRadius = radius * (0.18 + ring * 0.19)
    const ringJitterX = noise(sphere.index * 11 + ring, elapsed * 1.6) * jitter * 0.85
    const ringJitterY = noise(sphere.index * 17 + ring, elapsed * 1.6) * jitter * 0.85

    ctx.beginPath()
    ctx.ellipse(
      sphere.pos.x + ringJitterX,
      sphere.pos.y + ringJitterY,
      ringRadius,
      ringRadius * (0.58 + ring * 0.06),
      rotation * 0.55 + ring * 0.35,
      0,
      Math.PI * 2,
    )
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)'
    ctx.lineWidth = clamp(radius * 0.004, 0.4, 1)
    ctx.stroke()

    ctx.beginPath()
    const hatchCount = 8 + ring * 2
    for (let i = 0; i < hatchCount; i += 1) {
      const a = (Math.PI * 2 * i) / hatchCount + rotation * 0.22
      const inner = ringRadius * 0.62
      const outer = ringRadius * 1.03
      ctx.moveTo(sphere.pos.x + ringJitterX + Math.cos(a) * inner, sphere.pos.y + ringJitterY + Math.sin(a) * inner * 0.58)
      ctx.lineTo(sphere.pos.x + ringJitterX + Math.cos(a) * outer, sphere.pos.y + ringJitterY + Math.sin(a) * outer * 0.58)
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.stroke()
  }

  if (progress > 0.82) {
    ctx.globalAlpha = fade * smoothstep(progress, 0.82, 0.98)
    ctx.beginPath()
    points.forEach((point, index) => {
      if (index % 5 !== 0) return
      const split = 20 + (index % 17) * 3
      const angle = elapsed * 0.4 + index
      ctx.moveTo(point.x, point.y)
      ctx.lineTo(point.x + Math.cos(angle) * split, point.y + Math.sin(angle) * split)
    })
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
    ctx.lineWidth = 0.55
    ctx.stroke()
  }

  ctx.restore()
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawTrackLabel(ctx: CanvasRenderingContext2D, sphere: SketchSphere, trackId: TrackId, activeTrack: TrackId, fade: number) {
  if (fade <= 0.08 || sphere.radius < 42) return
  const track = TRACK_BY_ID[trackId]
  const isActive = trackId === activeTrack
  const width = clamp(sphere.radius * 1.3, 128, 240)
  const height = 66
  const x = sphere.pos.x - width / 2
  const y = sphere.pos.y - height / 2

  ctx.save()
  ctx.globalAlpha = clamp(fade * (isActive ? 0.96 : 0.76), 0, 1)
  roundedRect(ctx, x, y, width, height, 16)
  ctx.fillStyle = isActive ? track.mutedColor : 'rgba(255, 255, 255, 0.72)'
  ctx.fill()
  ctx.lineWidth = isActive ? 2 : 1
  ctx.strokeStyle = isActive ? track.color : 'rgba(0, 0, 0, 0.28)'
  ctx.stroke()

  ctx.fillStyle = '#111111'
  ctx.font = `700 ${clamp(width * 0.075, 15, 22)}px "IBM Plex Mono", ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(track.label, sphere.pos.x, sphere.pos.y - 10)

  ctx.font = `500 ${clamp(width * 0.052, 10, 13)}px "IBM Plex Mono", ui-monospace, monospace`
  ctx.fillStyle = isActive ? track.color : 'rgba(0, 0, 0, 0.58)'
  ctx.fillText(track.chips.slice(0, 2).join('  /  '), sphere.pos.x, sphere.pos.y + 16)
  ctx.restore()
}

type WireSphereFieldProps = {
  activeTrack?: TrackId
  onTrackFocus?: (track: TrackId) => void
}

export function WireSphereField({ activeTrack = 'founders', onTrackFocus }: WireSphereFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeTrackRef = useRef<TrackId>(activeTrack)
  const onTrackFocusRef = useRef(onTrackFocus)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    activeTrackRef.current = activeTrack
  }, [activeTrack])

  useEffect(() => {
    onTrackFocusRef.current = onTrackFocus
  }, [onTrackFocus])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { alpha: false })
    if (!canvas || !context) return

    let width = 0
    let height = 0
    let dpr = 1
    let raf = 0
    let lastTime = performance.now()
    let scrollTarget = getScrollProgress()
    let scrollProgress = scrollTarget
    let tiltX = 0
    let tiltY = 0
    let tiltTargetX = 0
    let tiltTargetY = 0
    let firstFrame = true
    let lastTrackHit: TrackId | null = null
    let spheres = createSpheres(window.innerWidth)
    const pointer: PointerState = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5,
      active: 0,
      clickX: window.innerWidth * 0.5,
      clickY: window.innerHeight * 0.5,
      clickAge: 10,
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.5 : 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      spheres = createSpheres(width)
      firstFrame = true
    }

    const syncScroll = () => {
      scrollTarget = getScrollProgress()
    }

    const trackAtPoint = (x: number, y: number) => {
      let best: { track: TrackId; distance: number } | null = null
      for (const sphere of spheres) {
        const track = SPHERE_TRACKS[sphere.index]
        if (!track) continue
        const distance = Math.hypot(sphere.pos.x - x, sphere.pos.y - y)
        const hitRadius = Math.max(78, sphere.radius * 0.66)
        if (distance <= hitRadius && (!best || distance < best.distance)) {
          best = { track, distance }
        }
      }
      return best?.track ?? null
    }

    const emitTrackHit = (track: TrackId | null) => {
      if (!track || track === lastTrackHit) return
      lastTrackHit = track
      onTrackFocusRef.current?.(track)
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.active = 1
      emitTrackHit(trackAtPoint(event.clientX, event.clientY))
    }

    const handlePointerLeave = () => {
      pointer.active = 0
    }

    const handlePointerDown = (event: PointerEvent) => {
      pointer.clickX = event.clientX
      pointer.clickY = event.clientY
      pointer.clickAge = 0
      pointer.active = 1
      emitTrackHit(trackAtPoint(event.clientX, event.clientY))
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      tiltTargetX = clamp((event.gamma || 0) / 45, -1, 1)
      tiltTargetY = clamp((event.beta || 0) / 45, -1, 1)
    }

    const draw = (now: number) => {
      const delta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000))
      lastTime = now
      const elapsed = now / 1000

      scrollTarget = getScrollProgress()
      const follow = reducedMotion ? 1 : 1 - Math.exp(-delta * 8.6)
      scrollProgress = lerp(scrollProgress, scrollTarget, follow)
      tiltX = lerp(tiltX, tiltTargetX, 1 - Math.exp(-delta * 6))
      tiltY = lerp(tiltY, tiltTargetY, 1 - Math.exp(-delta * 6))
      pointer.clickAge += delta

      context.globalCompositeOperation = 'source-over'
      context.globalAlpha = 1
      context.fillStyle = firstFrame || reducedMotion ? '#ffffff' : 'rgba(255, 255, 255, 0.105)'
      context.fillRect(0, 0, width, height)
      firstFrame = false

      const fov = (CAMERA_FOV * Math.PI) / 180
      const viewHeight = 2 * Math.tan(fov / 2) * CAMERA_Z
      const viewWidth = viewHeight * (width / Math.max(1, height))
      const progress = reducedMotion ? 0.18 : scrollProgress

      const route = routeCloud(progress, viewWidth, viewHeight, elapsed)
      const screen = worldToScreen(route.target, viewWidth, viewHeight, width, height)
      const cloudSpread = (width < 720 ? 86 : 178) * (0.72 + route.scale * 0.28)

      for (const sphere of spheres) {
        const offset = CLOUD_OFFSETS[sphere.index % CLOUD_OFFSETS.length]
        const escape = escapePulse(sphere.index, progress)
        const escapeAngle = sphere.index * 1.77 + elapsed * (0.38 + sphere.index * 0.03)
        const escapeDistance = (width < 720 ? 92 : 250) * escape
        const localScale = route.scale * (1 + escape * 0.22)

        sphere.target.x = screen.x + offset[0] * cloudSpread * localScale + Math.cos(escapeAngle) * escapeDistance + tiltX * 52
        sphere.target.y = screen.y + offset[1] * cloudSpread * localScale + Math.sin(escapeAngle) * escapeDistance * 0.62 + tiltY * 52

        const dx = sphere.target.x - pointer.x
        const dy = sphere.target.y - pointer.y
        const distance = Math.hypot(dx, dy)
        const repel = pointer.active * Math.pow(clamp(1 - distance / Math.max(1, Math.min(width, height) * 0.3), 0, 1), 2)
        if (repel > 0.001) {
          sphere.target.x += (dx / Math.max(1, distance)) * repel * 18
          sphere.target.y += (dy / Math.max(1, distance)) * repel * 14
        }

        sphere.pos.x = lerp(sphere.pos.x, sphere.target.x, reducedMotion ? 0.03 : 1 - Math.exp(-delta * 8.2))
        sphere.pos.y = lerp(sphere.pos.y, sphere.target.y, reducedMotion ? 0.03 : 1 - Math.exp(-delta * 8.2))
        sphere.radius = sphere.baseRadius * route.scale * (1 - escape * 0.46)

        drawSphere(context, sphere, pointer, elapsed, progress, route.fade, route.energy + escape * 0.42)
        const track = SPHERE_TRACKS[sphere.index]
        if (track) drawTrackLabel(context, sphere, track, activeTrackRef.current, route.fade)
      }

      raf = window.requestAnimationFrame(draw)
    }

    resize()
    syncScroll()
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', syncScroll, { passive: true })
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('deviceorientation', handleOrientation)
    raf = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', syncScroll)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [reducedMotion])

  return (
    <div className="wire-sphere-field" data-testid="particle-field" data-visual="firefly" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
