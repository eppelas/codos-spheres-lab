const BURST_COUNT = 7

export const vertexShader = /* glsl */ `
  precision highp float;

  #define BURST_COUNT ${BURST_COUNT}

  attribute vec3 aColor;
  attribute float aBurst;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSeed;
  attribute float aRing;

  uniform float uTime;
  uniform float uScroll;
  uniform float uPixelRatio;
  uniform float uFocalScale;
  uniform vec4 uPointer;
  uniform vec4 uClick;
  uniform vec3 uBurstCenter[BURST_COUNT];
  uniform float uBurstRadius[BURST_COUNT];
  uniform float uBurstEnergy[BURST_COUNT];
  uniform float uBurstFade[BURST_COUNT];

  varying vec3 vColor;
  varying float vAlpha;
  varying float vRing;
  varying float vDepth;

  mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }

  mat3 rotateX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
  }

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  vec3 fieldFlow(vec3 p, float seed, float time) {
    vec3 q = p * 1.25 + seed * 0.037;
    return vec3(
      sin(q.y * 2.7 + time * 0.74 + seed) + cos(q.z * 3.1 - time * 0.21),
      cos(q.z * 2.4 + time * 0.55 + seed * 0.4) + sin(q.x * 2.9 + time * 0.17),
      sin(q.x * 2.3 - time * 0.36 + seed * 0.7) + cos(q.y * 2.1 + time * 0.29)
    ) * 0.5;
  }

  void main() {
    vec3 center = vec3(0.0);
    float radius = 1.0;
    float energy = 0.2;
    float fade = 1.0;

    for (int i = 0; i < BURST_COUNT; i++) {
      float m = step(abs(float(i) - aBurst), 0.5);
      center += uBurstCenter[i] * m;
      radius += (uBurstRadius[i] - 1.0) * m;
      energy += (uBurstEnergy[i] - 0.2) * m;
      fade += (uBurstFade[i] - 1.0) * m;
    }

    float shell = length(position);
    float phase = uTime * (0.18 + hash(aSeed) * 0.16) + aSeed * 0.08 + aBurst * 0.41;
    vec3 local = rotateY(phase * 0.52) * rotateX(sin(phase) * 0.32) * (position * radius);
    vec3 flow = fieldFlow(local, aSeed, uTime * 0.42);
    local += flow * radius * energy * (0.12 + shell * 0.2);

    float outer = smoothstep(0.55, 1.08, shell);
    local += normalize(position + vec3(0.0001)) * sin(uTime * 0.38 + aSeed) * radius * 0.025 * outer;

    vec3 world = center + local;

    vec2 pointerDelta = world.xy - uPointer.xy;
    float pointerDist = length(pointerDelta);
    float pointerForce = uPointer.z * smoothstep(uPointer.w, 0.05, pointerDist);
    world.xy += normalize(pointerDelta + vec2(0.0001)) * pointerForce * (0.38 + outer * 0.42);

    vec2 clickDelta = world.xy - uClick.xy;
    float clickDist = length(clickDelta);
    float clickForce = uClick.z * smoothstep(1.9, 0.04, clickDist);
    world.xy += normalize(clickDelta + vec2(0.0001)) * clickForce * (0.85 + outer * 0.8);
    world.z += clickForce * 0.35 * sin(aSeed);

    vec4 mvPosition = modelViewMatrix * vec4(world, 1.0);
    float depthScale = clamp((local.z / max(0.01, radius)) * 0.5 + 0.62, 0.16, 1.35);
    float radiusPointScale = clamp(radius * 0.82, 0.12, 1.35);
    gl_PointSize = min(180.0, aSize * uPixelRatio * uFocalScale * depthScale * radiusPointScale / max(0.2, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;

    vColor = aColor * (0.95 + depthScale * 0.4);
    vAlpha = aAlpha * (0.48 + outer * 0.6) * (1.0 + pointerForce * 0.28 + clickForce * 0.45) * fade;
    vRing = aRing;
    vDepth = depthScale;
  }
`

export const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vRing;
  varying float vDepth;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    float ringWidth = mix(0.045, 0.12, vRing);
    float ring = exp(-pow((d - 0.34) / ringWidth, 2.0));
    float core = exp(-pow(d / 0.23, 2.0)) * 0.36;
    float edge = smoothstep(0.5, 0.24, d);
    float alpha = (ring * 0.82 + core) * edge * vAlpha;
    vec3 color = vColor * (0.82 + ring * 0.42 + vDepth * 0.16);

    gl_FragColor = vec4(color * alpha, alpha);
  }
`
