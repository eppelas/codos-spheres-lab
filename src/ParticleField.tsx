import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { fragmentShader, vertexShader } from './shaders'

const BURST_COUNT = 7
const WARM_PALETTE = ['#ff80e2', '#ff6a7b', '#ffaa00', '#ff8a1e', '#ffd000', '#fff0e6']

type FieldGeometry = {
  geometry: THREE.BufferGeometry
  radiusBias: Float32Array
}

type PointerState = {
  x: number
  y: number
  active: number
  clickX: number
  clickY: number
  clickAge: number
}

type BurstRoute = {
  target: THREE.Vector3
  scale: number
  fade: number
  energy: number
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

function colorToVec(hex: string) {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ] as const
}

function createParticleGeometry(count: number): FieldGeometry {
  const random = seededRandom(20260604)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const burst = new Float32Array(count)
  const size = new Float32Array(count)
  const alpha = new Float32Array(count)
  const seed = new Float32Array(count)
  const ring = new Float32Array(count)
  const radiusBias = new Float32Array(BURST_COUNT)
  const perBurst = Math.max(1, Math.floor(count / BURST_COUNT))

  for (let i = 0; i < BURST_COUNT; i += 1) {
    radiusBias[i] = 0.78 + random() * 0.58
  }

  for (let i = 0; i < count; i += 1) {
    const b = Math.min(BURST_COUNT - 1, Math.floor(i / perBurst))
    const palette = colorToVec(WARM_PALETTE[Math.floor(random() * WARM_PALETTE.length)])
    const bandCount = 13
    const band = Math.floor(random() * bandCount)
    const latitude = -Math.PI / 2 + ((band + random() * 0.92) / (bandCount - 1)) * Math.PI
    const longitude = random() * Math.PI * 2
    const shell = 0.68 + Math.pow(random(), 0.34) * 0.37
    const lobe = 1 + Math.sin(longitude * 3 + b) * 0.035 + Math.cos(latitude * 5) * 0.025
    const x = Math.cos(latitude) * Math.cos(longitude) * shell * lobe
    const y = Math.sin(latitude) * shell * (0.92 + random() * 0.08)
    const z = Math.cos(latitude) * Math.sin(longitude) * shell * (0.76 + random() * 0.22)
    const colorNoise = 0.82 + random() * 0.34

    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    colors[i * 3] = Math.min(1, palette[0] * colorNoise)
    colors[i * 3 + 1] = Math.min(1, palette[1] * colorNoise)
    colors[i * 3 + 2] = Math.min(1, palette[2] * colorNoise)
    burst[i] = b
    size[i] = 0.035 + random() * 0.07 + (random() < 0.16 ? 0.06 : 0)
    alpha[i] = 0.36 + random() * 0.58
    seed[i] = random() * 1000
    ring[i] = random()
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aBurst', new THREE.BufferAttribute(burst, 1))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  geometry.setAttribute('aRing', new THREE.BufferAttribute(ring, 1))
  geometry.computeBoundingSphere()

  return { geometry, radiusBias }
}

function getScrollProgress() {
  const limit = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  return THREE.MathUtils.clamp(window.scrollY / limit, 0, 1)
}

function range(progress: number, start: number, end: number) {
  return THREE.MathUtils.smoothstep(progress, start, end)
}

function bell(progress: number, center: number, width: number) {
  const distance = Math.abs(progress - center) / Math.max(0.001, width)
  if (distance >= 1) return 0
  const value = 1 - distance
  return value * value * (3 - 2 * value)
}

function routeBurst(index: number, progress: number, viewWidth: number, viewHeight: number, elapsed: number): BurstRoute {
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
  const home = new THREE.Vector3(
    (index % 3 - 1) * viewWidth * 0.2 + Math.sin(phase) * 0.45,
    (index < 4 ? 0.22 : -0.24) * viewHeight + Math.cos(phase) * 0.32,
    Math.sin(phase * 1.4) * 0.55,
  )
  const sweep = new THREE.Vector3(
    (index % 2 === 0 ? -1 : 1) * viewWidth * (0.42 + index * 0.035),
    Math.sin(index * 1.2) * viewHeight * 0.34,
    Math.cos(index * 0.9) * 0.72,
  )
  const graph = new THREE.Vector3(
    (anchor[0] - 0.5) * viewWidth * 0.88,
    (0.5 - anchor[1]) * viewHeight * 0.68,
    Math.sin(index * 0.77) * 0.3,
  )
  const micro = new THREE.Vector3(
    -viewWidth * 0.28 + Math.cos(clusterPhase) * viewWidth * 0.012,
    viewHeight * 0.02 + Math.sin(clusterPhase) * viewHeight * 0.018,
    Math.sin(index) * 0.08,
  )
  const graphCloud = new THREE.Vector3(
    -viewWidth * 0.3 + Math.cos(clusterPhase) * viewWidth * 0.01,
    viewHeight * 0.03 + Math.sin(clusterPhase) * viewHeight * 0.014,
    Math.sin(index * 1.7) * 0.06,
  )
  const release = new THREE.Vector3(
    viewWidth * (-0.32 + ((index * 0.23) % 0.64)) + Math.sin(index) * 0.22,
    viewHeight * (0.22 - ((index * 0.19) % 0.44)),
    Math.sin(index * 2.1) * 0.62,
  )
  const afterglow = new THREE.Vector3(
    Math.sin(index * 1.37 + elapsed * 0.08) * viewWidth * 0.36,
    Math.cos(index * 1.03 + elapsed * 0.07) * viewHeight * 0.28,
    Math.sin(index + elapsed * 0.11) * 0.72,
  )
  const vanish = new THREE.Vector3(
    (index % 2 === 0 ? -1 : 1) * viewWidth * (0.65 + index * 0.04),
    viewHeight * (index % 3 === 0 ? 0.62 : -0.58),
    -0.9 + index * 0.12,
  )

  const target = home
    .lerp(sweep, range(progress, 0.02, 0.18))
    .lerp(graph, range(progress, 0.14, 0.34))
    .lerp(micro, range(progress, 0.36, 0.5))
    .lerp(release, range(progress, 0.5, 0.68))
    .lerp(afterglow, range(progress, 0.64, 0.82))
    .lerp(vanish, range(progress, 0.82, 0.96))

  const graphCloudPulse = bell(progress, 0.28, 0.18)
  const lateCloudPulse = bell(progress, 0.72, 0.075)
  const tinyPulse = Math.max(graphCloudPulse, lateCloudPulse)
  target.lerp(graphCloud, Math.max(graphCloudPulse, lateCloudPulse * 0.72))

  target.x += Math.sin(elapsed * (0.13 + index * 0.015) + phase) * viewWidth * (0.028 + progress * 0.02)
  target.y += Math.cos(elapsed * (0.11 + index * 0.011) + phase) * viewHeight * (0.028 + progress * 0.018)

  const scale = THREE.MathUtils.lerp(1, 0.1, tinyPulse)
  const fadeOut = 1 - range(progress, 0.88, 0.985)
  const fade = fadeOut
  const energy = 0.32 + range(progress, 0.16, 0.68) * 0.22 + bell(progress, 0.58, 0.16) * 0.3

  return { target, scale, fade, energy }
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

function ParticleSystem({ particleCount, reducedMotion }: { particleCount: number; reducedMotion: boolean }) {
  const { camera, size, gl } = useThree()
  const data = useMemo(() => createParticleGeometry(particleCount), [particleCount])
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const centers = useRef(Array.from({ length: BURST_COUNT }, () => new THREE.Vector3()))
  const targets = useRef(Array.from({ length: BURST_COUNT }, () => new THREE.Vector3()))
  const pointer = useRef<PointerState>({ x: 0, y: 0, active: 0, clickX: 0, clickY: 0, clickAge: 10 })

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uFocalScale: { value: 1000 },
      uPointer: { value: new THREE.Vector4(0, 0, 0, 0) },
      uClick: { value: new THREE.Vector4(0, 0, 0, 0) },
      uBurstCenter: { value: Array.from({ length: BURST_COUNT }, () => new THREE.Vector3()) },
      uBurstRadius: { value: new Float32Array(BURST_COUNT) },
      uBurstEnergy: { value: new Float32Array(BURST_COUNT) },
      uBurstFade: { value: new Float32Array(BURST_COUNT) },
    }),
    [],
  )

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -(event.clientY / window.innerHeight) * 2 + 1
      pointer.current.active = 1
    }
    const handleLeave = () => {
      pointer.current.active = 0
    }
    const handleDown = (event: PointerEvent) => {
      pointer.current.clickX = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.clickY = -(event.clientY / window.innerHeight) * 2 + 1
      pointer.current.clickAge = 0
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerleave', handleLeave)
    window.addEventListener('pointerdown', handleDown)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerleave', handleLeave)
      window.removeEventListener('pointerdown', handleDown)
    }
  }, [])

  const scrollTarget = useRef(0)
  const scrollProgress = useRef(0)

  useEffect(() => {
    const syncScroll = () => {
      scrollTarget.current = getScrollProgress()
    }
    syncScroll()
    window.addEventListener('scroll', syncScroll, { passive: true })
    window.addEventListener('resize', syncScroll)
    return () => {
      window.removeEventListener('scroll', syncScroll)
      window.removeEventListener('resize', syncScroll)
    }
  }, [])

  useFrame(({ clock }, delta) => {
    const material = materialRef.current
    if (!material) return

    const elapsed = clock.getElapsedTime()
    const frameDelta = Math.min(delta, 0.05)
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov)
    const cameraZ = camera.position.z
    const viewHeight = 2 * Math.tan(fov / 2) * cameraZ
    const viewWidth = viewHeight * (size.width / Math.max(1, size.height))
    scrollTarget.current = getScrollProgress()
    const scrollFollow = reducedMotion ? 1 : 1 - Math.exp(-frameDelta * 9.5)
    scrollProgress.current = THREE.MathUtils.lerp(scrollProgress.current, scrollTarget.current, scrollFollow)
    const progress = reducedMotion ? 0.18 : scrollProgress.current
    const pointerWorld = new THREE.Vector2(pointer.current.x * viewWidth * 0.5, pointer.current.y * viewHeight * 0.5)
    const clickPulse = Math.max(0, 1 - pointer.current.clickAge / 1.05)
    const clickWorld = new THREE.Vector2(pointer.current.clickX * viewWidth * 0.5, pointer.current.clickY * viewHeight * 0.5)

    pointer.current.clickAge += frameDelta

    material.uniforms.uTime.value = reducedMotion ? 0.25 : elapsed
    material.uniforms.uScroll.value = progress
    material.uniforms.uFocalScale.value = size.height / (2 * Math.tan(fov / 2))
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
    material.uniforms.uPointer.value.set(pointerWorld.x, pointerWorld.y, pointer.current.active, 1.25)
    material.uniforms.uClick.value.set(clickWorld.x, clickWorld.y, clickPulse, 1)

    for (let i = 0; i < BURST_COUNT; i += 1) {
      const route = routeBurst(i, progress, viewWidth, viewHeight, elapsed)
      targets.current[i].copy(route.target)
      const dx = targets.current[i].x - pointerWorld.x
      const dy = targets.current[i].y - pointerWorld.y
      const dist = Math.hypot(dx, dy)
      const repel = pointer.current.active * THREE.MathUtils.smoothstep(1.9, 0.18, dist)

      if (repel > 0.001) {
        targets.current[i].x += (dx / Math.max(0.001, dist)) * repel * 0.9
        targets.current[i].y += (dy / Math.max(0.001, dist)) * repel * 0.7
      }

      centers.current[i].lerp(targets.current[i], reducedMotion ? 0.03 : 1 - Math.exp(-frameDelta * 8.5))
      material.uniforms.uBurstCenter.value[i].copy(centers.current[i])
      material.uniforms.uBurstRadius.value[i] = (0.72 + data.radiusBias[i]) * (size.width < 720 ? 0.55 : 0.72) * route.scale
      material.uniforms.uBurstEnergy.value[i] = reducedMotion ? 0.08 : route.energy + Math.sin(elapsed * 0.17 + i) * 0.08
      material.uniforms.uBurstFade.value[i] = reducedMotion ? 0.72 : route.fade
    }
  })

  useEffect(() => {
    return () => data.geometry.dispose()
  }, [data.geometry])

  return (
    <points geometry={data.geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        args={[
          {
            uniforms,
            vertexShader,
            fragmentShader,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blending: THREE.NormalBlending,
            premultipliedAlpha: true,
          },
        ]}
      />
    </points>
  )
}

export function ParticleField() {
  const reducedMotion = useReducedMotion()
  const [particleCount, setParticleCount] = useState(() => (window.innerWidth < 720 ? 9000 : 22000))

  useEffect(() => {
    const handleResize = () => setParticleCount(window.innerWidth < 720 ? 9000 : 22000)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="particle-field" data-testid="particle-field">
      <Canvas
        camera={{ position: [0, 0, 9.4], fov: 43, near: 0.1, far: 60 }}
        dpr={[1, 2]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          premultipliedAlpha: true,
          preserveDrawingBuffer: true,
        }}
      >
        <ParticleSystem particleCount={particleCount} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
