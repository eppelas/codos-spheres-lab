import { Html } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import * as THREE from 'three'

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

type Vec3 = { x: number; y: number; z: number }
type Route = { target: Vec3; scale: number; fade: number; energy: number }
type Particle = { angle: number; phi: number; offset: number; seed: number; speed: number; partner: number }
type PointerState = { x: number; y: number; active: number; clickX: number; clickY: number; clickAge: number }

type WireSphere = {
  baseRadius: number
  density: number
  index: number
  particles: Particle[]
  center: Vec3
  radius: number
  geometry: THREE.BufferGeometry
  pointGeometry: THREE.BufferGeometry
  positions: Float32Array
  pointPositions: Float32Array
}

type WireSphereFieldProps = {
  activeTrack?: TrackId
  onTrackFocus?: (track: TrackId) => void
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
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }
}

function getScrollProgress() {
  const limit = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  return clamp(window.scrollY / limit, 0, 1)
}

function routeBurst(index: number, progress: number, viewWidth: number, viewHeight: number, elapsed: number): Route {
  const phase = index * 0.83
  const clusterPhase = index * 2.399
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
  const home = {
    x: -viewWidth * 0.04,
    y: viewHeight * 0.08,
    z: 0,
  }
  const wideSweep = {
    x: -viewWidth * 0.24 + Math.sin(elapsed * 0.08) * viewWidth * 0.025,
    y: viewHeight * 0.2,
    z: 0.18,
  }
  const programLeft = {
    x: -viewWidth * 0.34 + Math.sin(elapsed * 0.12) * viewWidth * 0.018,
    y: viewHeight * 0.02 + Math.cos(elapsed * 0.1) * viewHeight * 0.018,
    z: 0.08,
  }
  const release = {
    x: viewWidth * 0.22 + Math.sin(elapsed * 0.1) * viewWidth * 0.055,
    y: -viewHeight * 0.12 + Math.cos(elapsed * 0.09) * viewHeight * 0.04,
    z: 0.36,
  }
  const afterglow = {
    x: Math.sin(elapsed * 0.1) * viewWidth * 0.34,
    y: Math.cos(elapsed * 0.08) * viewHeight * 0.26,
    z: 0.5,
  }
  const vanish = {
    x: viewWidth * 0.78,
    y: -viewHeight * 0.58,
    z: -0.4,
  }

  let target = mixVec(home, wideSweep, smoothstep(progress, 0.02, 0.16))
  target = mixVec(target, programLeft, smoothstep(progress, 0.14, 0.34))
  target = mixVec(target, programLeft, bell(progress, 0.42, 0.12))
  target = mixVec(target, release, smoothstep(progress, 0.48, 0.66))
  target = mixVec(target, afterglow, smoothstep(progress, 0.62, 0.82))
  target = mixVec(target, vanish, smoothstep(progress, 0.82, 0.98))

  const compression = Math.max(bell(progress, 0.29, 0.18), bell(progress, 0.72, 0.08))
  const scale = lerp(1, 0.1, compression)
  const fade = 1 - smoothstep(progress, 0.88, 0.985)
  const energy = 0.34 + smoothstep(progress, 0.12, 0.68) * 0.22 + bell(progress, 0.58, 0.18) * 0.28

  return {
    target,
    scale,
    fade,
    energy,
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

function createSpheres(width: number) {
  const random = seededRandom(6102026)
  const mobile = width < 720
  const baseRadii = mobile ? [116, 82, 52, 70, 42, 64, 34] : [248, 172, 98, 138, 78, 120, 58]
  const particleCounts = mobile ? [128, 88, 52, 72, 38, 58, 30] : [270, 184, 108, 146, 76, 118, 58]
  const maxParticles = Math.max(...particleCounts)

  return baseRadii.map<WireSphere>((baseRadius, index) => {
    const particleCount = particleCounts[index]
    const density = particleCount / maxParticles
    const particles = Array.from({ length: particleCount }, () => ({
      angle: random() * Math.PI * 2,
      phi: Math.acos(lerp(-0.9, 0.9, random())),
      offset: 0.42 + Math.pow(random(), 0.78) * 0.56,
      seed: random() * 1000 + index * 37,
      speed: 0.36 + random() * 0.92,
      partner: 0,
    })).sort((a, b) => a.angle - b.angle)
    particles.forEach((particle, particleIndex) => {
      const localBridge = Math.floor(5 + random() * 14 + density * 12)
      const occasionalSpan = particleIndex % 7 === 0 ? Math.floor(particleCount * (0.11 + random() * 0.12)) : 0
      particle.partner = (particleIndex + localBridge + occasionalSpan) % particleCount
    })
    const chordStep = density > 0.72 ? 1 : density > 0.42 ? 2 : 3
    const spikeStep = density > 0.7 ? 18 : 13
    const segmentCount = Math.ceil(particleCount / chordStep) * 2 + Math.ceil(particleCount / spikeStep)
    const positions = new Float32Array(segmentCount * 2 * 3)
    const pointPositions = new Float32Array(particleCount * 3)
    const geometry = new THREE.BufferGeometry()
    const pointGeometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3))
    geometry.setDrawRange(0, 0)
    return {
      baseRadius,
      density,
      index,
      particles,
      center: { x: 0, y: 0, z: 0 },
      radius: baseRadius,
      geometry,
      pointGeometry,
      positions,
      pointPositions,
    }
  })
}

function writeSegment(buffer: Float32Array, cursor: number, a: Vec3, b: Vec3) {
  const offset = cursor * 6
  buffer[offset] = a.x
  buffer[offset + 1] = a.y
  buffer[offset + 2] = a.z
  buffer[offset + 3] = b.x
  buffer[offset + 4] = b.y
  buffer[offset + 5] = b.z
}

function computePoint(sphere: WireSphere, particle: Particle, elapsed: number, energy: number, pxToWorld: number, pointer: PointerState) {
  const jitter = (1.6 + energy * 5.2) * (pointer.clickAge < 0.55 ? 1.6 : 1) * pxToWorld
  const rotation = elapsed * (sphere.index % 2 === 0 ? 0.33 : -0.29) + sphere.index * 0.4
  const radius = sphere.radius * pxToWorld * (1 + Math.sin(elapsed * 1.6 + sphere.index) * 0.045)
  const phi = particle.phi + Math.sin(elapsed * 0.27 + particle.seed) * 0.055
  const angle = particle.angle + elapsed * particle.speed * (sphere.index % 2 === 0 ? 1 : -1)
  const shellRadius = radius * particle.offset
  const sinPhi = Math.sin(phi)
  const rawX = shellRadius * sinPhi * Math.cos(angle)
  const rawY = shellRadius * sinPhi * Math.sin(angle)
  const rawZ = shellRadius * Math.cos(phi)
  const spinX = rawX * Math.cos(rotation) - rawZ * Math.sin(rotation)
  const spinZ = rawX * Math.sin(rotation) + rawZ * Math.cos(rotation)
  let x = sphere.center.x + spinX
  let y = sphere.center.y + rawY * 0.82 + spinZ * 0.14
  let z = spinZ * 0.42

  const dx = pointer.x - x
  const dy = pointer.y - y
  const distance = Math.hypot(dx, dy)
  const pullLimit = 680 * pxToWorld
  if (pointer.active && distance < pullLimit) {
    const pull = Math.pow(1 - distance / pullLimit, 1.58) * (245 + energy * 260) * pxToWorld
    x += (dx / Math.max(0.001, distance)) * pull
    y += (dy / Math.max(0.001, distance)) * pull
    z += pull * 0.18 * Math.sin(particle.seed)
  }

  const clickPulse = Math.max(0, 1 - pointer.clickAge / 0.8)
  if (clickPulse > 0) {
    const cdx = x - pointer.clickX
    const cdy = y - pointer.clickY
    const cdist = Math.hypot(cdx, cdy)
    const clickLimit = 620 * pxToWorld
    if (cdist < clickLimit) {
      const burst = Math.pow(1 - cdist / clickLimit, 2) * clickPulse * 110 * pxToWorld
      x += (cdx / Math.max(0.001, cdist)) * burst
      y += (cdy / Math.max(0.001, cdist)) * burst
      z += burst * 0.22
    }
  }

  x += noise(particle.seed, elapsed * 2.1) * jitter
  y += noise(particle.seed + 500, elapsed * 2.1) * jitter
  return { x, y, z, depth: clamp((spinZ / Math.max(0.001, radius) + 1) * 0.5, 0, 1) }
}

function updateGeometry(sphere: WireSphere, elapsed: number, energy: number, pxToWorld: number, pointer: PointerState) {
  const points = sphere.particles.map((particle) => computePoint(sphere, particle, elapsed, energy, pxToWorld, pointer))
  const radius = sphere.radius * pxToWorld
  let cursor = 0

  for (let i = 0; i < points.length; i += 1) {
    const offset = i * 3
    sphere.pointPositions[offset] = points[i].x
    sphere.pointPositions[offset + 1] = points[i].y
    sphere.pointPositions[offset + 2] = points[i].z
  }

  const chordStep = sphere.density > 0.72 ? 1 : sphere.density > 0.42 ? 2 : 3
  for (let i = 0; i < points.length; i += chordStep) {
    writeSegment(sphere.positions, cursor, points[i], points[sphere.particles[i].partner])
    cursor += 1
    const weaveOffset = Math.floor(points.length * (0.045 + ((i + sphere.index * 3) % 6) * 0.012))
    writeSegment(sphere.positions, cursor, points[i], points[(i + Math.max(3, weaveOffset)) % points.length])
    cursor += 1
  }

  const spikeStep = sphere.density > 0.7 ? 18 : 13
  for (let i = 0; i < points.length; i += spikeStep) {
    const point = points[i]
    const length = radius * (0.045 + point.depth * 0.07)
    const angle = elapsed * 0.7 + i * 0.61
    writeSegment(sphere.positions, cursor, point, { x: point.x + Math.cos(angle) * length, y: point.y + Math.sin(angle) * length, z: point.z + Math.sin(angle + sphere.index) * length * 0.16 })
    cursor += 1
  }

  sphere.geometry.setDrawRange(0, cursor * 2)
  const attr = sphere.geometry.getAttribute('position') as THREE.BufferAttribute
  attr.needsUpdate = true
  const pointAttr = sphere.pointGeometry.getAttribute('position') as THREE.BufferAttribute
  pointAttr.needsUpdate = true
}

function getViewSize(camera: THREE.PerspectiveCamera, size: { width: number; height: number }) {
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const viewHeight = 2 * Math.tan(fov / 2) * camera.position.z
  const viewWidth = viewHeight * (size.width / Math.max(1, size.height))
  return { viewWidth, viewHeight }
}

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

function WireCloud({ activeTrack, onTrackFocus, reducedMotion }: Required<WireSphereFieldProps> & { reducedMotion: boolean }) {
  const { camera, gl, size } = useThree()
  const spheres = useMemo(() => createSpheres(size.width), [size.width])
  const materials = useRef<Array<THREE.LineBasicMaterial | null>>([])
  const softPointMaterials = useRef<Array<THREE.PointsMaterial | null>>([])
  const corePointMaterials = useRef<Array<THREE.PointsMaterial | null>>([])
  const hitRefs = useRef<Array<THREE.Mesh | null>>([])
  const labelRefs = useRef<Array<THREE.Group | null>>([])
  const labelElementRefs = useRef<Array<HTMLDivElement | null>>([])
  const pointer = useRef<PointerState>({ x: 0, y: 0, active: 0, clickX: 0, clickY: 0, clickAge: 10 })
  const scrollTarget = useRef(0)
  const scrollProgress = useRef(0)
  const activeTrackRef = useRef(activeTrack)
  const onTrackFocusRef = useRef(onTrackFocus)
  const hitGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 10), [])
  const hitMaterial = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [])

  useEffect(() => {
    activeTrackRef.current = activeTrack
  }, [activeTrack])

  useEffect(() => {
    onTrackFocusRef.current = onTrackFocus
  }, [onTrackFocus])

  useEffect(() => {
    gl.setClearColor('#ffffff', 0)
    const syncScroll = () => {
      scrollTarget.current = getScrollProgress()
    }
    const pointerToWorld = (clientX: number, clientY: number) => {
      const { viewWidth, viewHeight } = getViewSize(camera as THREE.PerspectiveCamera, size)
      return {
        x: (clientX / window.innerWidth - 0.5) * viewWidth,
        y: -(clientY / window.innerHeight - 0.5) * viewHeight,
      }
    }
    const handleMove = (event: PointerEvent) => {
      const world = pointerToWorld(event.clientX, event.clientY)
      pointer.current.x = world.x
      pointer.current.y = world.y
      pointer.current.active = 1
    }
    const handleLeave = () => {
      pointer.current.active = 0
    }
    const handleDown = (event: PointerEvent) => {
      const world = pointerToWorld(event.clientX, event.clientY)
      pointer.current.clickX = world.x
      pointer.current.clickY = world.y
      pointer.current.clickAge = 0
    }

    syncScroll()
    window.addEventListener('scroll', syncScroll, { passive: true })
    window.addEventListener('resize', syncScroll)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerleave', handleLeave)
    window.addEventListener('pointerdown', handleDown)
    return () => {
      window.removeEventListener('scroll', syncScroll)
      window.removeEventListener('resize', syncScroll)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerleave', handleLeave)
      window.removeEventListener('pointerdown', handleDown)
    }
  }, [camera, gl, size])

  useEffect(() => {
    return () => {
      spheres.forEach((sphere) => {
        sphere.geometry.dispose()
        sphere.pointGeometry.dispose()
      })
      hitGeometry.dispose()
      hitMaterial.dispose()
    }
  }, [hitGeometry, hitMaterial, spheres])

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime()
    const frameDelta = Math.min(delta, 0.05)
    const { viewWidth, viewHeight } = getViewSize(camera as THREE.PerspectiveCamera, size)
    const pxToWorld = viewHeight / Math.max(1, size.height)
    const follow = reducedMotion ? 1 : 1 - Math.exp(-frameDelta * 8.6)
    scrollTarget.current = getScrollProgress()
    scrollProgress.current = lerp(scrollProgress.current, scrollTarget.current, follow)
    const progress = reducedMotion ? 0.18 : scrollProgress.current
    const route = routeCloud(progress, viewWidth, viewHeight, elapsed)
    const labelsCanBreathe = progress < 0.1 || progress > 0.78
    const cloudSpread = (size.width < 720 ? 86 : 178) * (0.72 + route.scale * 0.28) * pxToWorld
    pointer.current.clickAge += frameDelta

    for (const sphere of spheres) {
      const offset = CLOUD_OFFSETS[sphere.index % CLOUD_OFFSETS.length]
      const escape = escapePulse(sphere.index, progress)
      const escapeAngle = sphere.index * 1.77 + elapsed * (0.38 + sphere.index * 0.03)
      const escapeDistance = (size.width < 720 ? 92 : 250) * escape * pxToWorld
      const localScale = route.scale * (1 + escape * 0.22)
      const targetX = route.target.x + offset[0] * cloudSpread * localScale + Math.cos(escapeAngle) * escapeDistance
      const targetY = route.target.y + offset[1] * cloudSpread * localScale + Math.sin(escapeAngle) * escapeDistance * 0.62
      const centerFollow = reducedMotion ? 0.03 : 1 - Math.exp(-frameDelta * 8.2)
      sphere.center.x = lerp(sphere.center.x, targetX, centerFollow)
      sphere.center.y = lerp(sphere.center.y, targetY, centerFollow)
      sphere.radius = sphere.baseRadius * route.scale * (1 - escape * 0.46)
      updateGeometry(sphere, elapsed, route.energy + escape * 0.42, pxToWorld, pointer.current)
      const material = materials.current[sphere.index]
      if (material) material.opacity = clamp(route.fade * (0.18 + sphere.density * 0.48), 0, 0.78)
      const softPointMaterial = softPointMaterials.current[sphere.index]
      if (softPointMaterial) softPointMaterial.opacity = clamp(route.fade * (0.09 + sphere.density * 0.22), 0, 0.36)
      const corePointMaterial = corePointMaterials.current[sphere.index]
      if (corePointMaterial) corePointMaterial.opacity = clamp(route.fade * (0.14 + sphere.density * 0.24), 0, 0.44)
      const hit = hitRefs.current[sphere.index]
      if (hit) {
        hit.position.set(sphere.center.x, sphere.center.y, 0.2)
        hit.scale.set(Math.max(0.62, sphere.radius * 0.0048), Math.max(0.48, sphere.radius * 0.0036), 0.04)
      }
      const label = labelRefs.current[sphere.index]
      const labelElement = labelElementRefs.current[sphere.index]
      const labelVisible = labelsCanBreathe && sphere.radius > 36 && route.fade > 0.08
      if (label) {
        label.position.set(sphere.center.x, sphere.center.y, 0.65)
        label.visible = labelVisible
      }
      if (labelElement) {
        labelElement.style.opacity = labelVisible ? '1' : '0'
        labelElement.style.pointerEvents = labelVisible ? 'auto' : 'none'
        labelElement.style.visibility = labelVisible ? 'visible' : 'hidden'
      }
    }
  })

  return (
    <>
      {spheres.map((sphere) => {
        const track = SPHERE_TRACKS[sphere.index]
        const trackMeta = track ? TRACK_BY_ID[track] : null
        const labelScale = clamp((sphere.radius || sphere.baseRadius) / 190, 0.56, 1.04)
        return (
          <group key={sphere.index}>
            <points geometry={sphere.pointGeometry} frustumCulled={false}>
              <pointsMaterial
                ref={(material) => {
                  softPointMaterials.current[sphere.index] = material
                }}
                color="#000000"
                size={size.width < 720 ? 0.062 : 0.088}
                sizeAttenuation
                transparent
                opacity={0.08}
                depthTest={false}
                depthWrite={false}
              />
            </points>
            <points geometry={sphere.pointGeometry} frustumCulled={false}>
              <pointsMaterial
                ref={(material) => {
                  corePointMaterials.current[sphere.index] = material
                }}
                color="#000000"
                size={size.width < 720 ? 0.012 : 0.018}
                sizeAttenuation
                transparent
                opacity={0.22}
                depthTest={false}
                depthWrite={false}
              />
            </points>
            <lineSegments geometry={sphere.geometry} frustumCulled={false}>
              <lineBasicMaterial
                ref={(material) => {
                  materials.current[sphere.index] = material
                }}
                color="#020202"
                transparent
                opacity={0.32}
                depthTest={false}
                depthWrite={false}
              />
            </lineSegments>
            {track ? (
              <mesh
                ref={(mesh) => {
                  hitRefs.current[sphere.index] = mesh
                }}
                geometry={hitGeometry}
                material={hitMaterial}
                onClick={() => onTrackFocusRef.current(track)}
                onPointerEnter={() => onTrackFocusRef.current(track)}
              />
            ) : null}
            {track && trackMeta && sphere.radius > 36 ? (
              <group
                ref={(group) => {
                  labelRefs.current[sphere.index] = group
                }}
              >
                <Html zIndexRange={[30, 0]}>
                  <div
                    className="wire-track-label"
                    data-active={track === activeTrack}
                    ref={(element) => {
                      labelElementRefs.current[sphere.index] = element
                    }}
                    style={
                      {
                        '--track-color': trackMeta.color,
                        '--track-muted': trackMeta.mutedColor,
                        transform: `translate(-50%, -50%) scale(${labelScale})`,
                      } as CSSProperties
                    }
                    onClick={() => onTrackFocusRef.current(track)}
                    onMouseEnter={() => onTrackFocusRef.current(track)}
                  >
                    <strong>{trackMeta.label}</strong>
                    <span>{trackMeta.chips.slice(0, 2).join(' / ')}</span>
                  </div>
                </Html>
              </group>
            ) : null}
          </group>
        )
      })}
    </>
  )
}

export function WireSphereFieldThree({ activeTrack = 'founders', onTrackFocus = () => undefined }: WireSphereFieldProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className="wire-sphere-field" data-testid="particle-field" data-visual="firefly-three">
      <Canvas
        camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV, near: 0.1, far: 80 }}
        dpr={[1, 1.45]}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor('#ffffff', 0)}
      >
        <WireCloud activeTrack={activeTrack} onTrackFocus={onTrackFocus} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
