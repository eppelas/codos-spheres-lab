# Codos Spheres Lab

Standalone animation lab for original Codos-inspired scroll scenes.

## Codos Inspection Summary

- Codos lazy-loads `ParticleDrop-DRdzr2Bf.js` from the main React bundle.
- The particle renderer is custom Three.js/WebGL, not CSS or a preset particle library.
- The particle chunk uses Three r169, `WebGLRenderer`, `BufferGeometry`, `ShaderMaterial`, and `Points`.
- Defaults include `particleCount: 21000`, `NUM_BURSTS: 7`, warm palette colors, `sprite.png`, and an unused-looking `brain.obj` config path.
- DOM choreography wraps the renderer in a fixed `data-hero-particles` element and moves/scales/fades that wrapper via GSAP ScrollTrigger between `data-hero-particle-home`, `data-diag-panel`, and `data-particle-release`.
- The shader uses 3D simplex noise and curl noise to churn particles inside burst spheres.
- The `Setting contexts.Graph` scene is a React/SVG/DOM diagram in the main bundle: `1153x777` coordinate system, absolute cards, SVG cubic paths, and 4 orange trail dots per path driven by `getPointAtLength()`.

This project implements its own original version of that architecture.

## Scenes

- Warm WebGL particle spheres with pointer repel, click pulse, broad scroll travel, two `0.1x` compression phases, and final fade-out.
- Firefly duplicate at `/firefly`: the same long-scroll choreography, but the sphere layer is now a Three/R3F WebGL wire-cloud inspired by a local pastel-firefly HTML reference. It reads as one uneven cloud rather than separate matching balls: one dense primary volume, looser edge lobes, smaller escaping fragments, varied particle density, role labels inside the main lobes, strong pointer stretch, click burst, scroll smoothing, `0.1x` compression, and final fade-out. The previous 2D canvas version is left in the repo as a fallback but is no longer mounted by `App`.
- Firefly program map: role hover/click selects `Enterprise`, `Founders / SMB`, or `Micro / personal`; the participant-path scheme and June 6-27 calendar highlight the matching route, days, and workshops.
- Context graph scene with Codos-style source/raw/observer/judge/vault cards, curved SVG connectors, animated orange flow dots, hover lift, and click surge. On desktop the graph sits on the right half of the viewport so it does not fight the small particle cloud on the left.
- The scroll route is now about three times longer than the first version so the spheres have room to travel before shrinking and disappearing.
- The first compression phase now keeps all burst groups together as a single small left-side cloud instead of scattering them across the viewport.

## Local Preview

- Desktop: `http://localhost:5174/`
- Firefly duplicate: `http://localhost:5174/firefly`
- Finder launcher: `_ Codos Spheres Preview.app`
- Command fallback: `! Open Codos Spheres Preview.command`

The launcher starts or reuses the Vite preview. If port `5174` is occupied by a different project, it picks the next free port up to `5199` and prints both localhost and LAN/mobile URLs.

## GitHub Pages

- Repository: `https://github.com/eppelas/codos-spheres-lab`
- Pages root: `https://eppelas.github.io/codos-spheres-lab/`
- Firefly route: `https://eppelas.github.io/codos-spheres-lab/firefly`

GitHub Pages is deployed by `.github/workflows/pages.yml` on pushes to `main`. The workflow builds with `VITE_PAGES_BASE=/codos-spheres-lab/`, and the SPA fallback copies `dist/index.html` to `dist/404.html`.

## Verification

- `npm run verify:runtime`
- `PLAYWRIGHT_PATH=/firefly npm run verify:runtime`
- `npm run verify:runtime -- --path=/firefly`
- `npm run build`

Last local verification on 2026-06-05 passed after the compact participant-path and Codos-like graph revisions. `npm run build` passed, and `npm run verify:runtime -- --path=/firefly` passed for desktop and mobile with no horizontal overflow, `flowDotCount: 48`, `programNodeCount: 12`, and `calendarDayCount: 22`.

Note: headless Chromium WebGL screenshot/readPixels checks are unreliable on this machine for this page, so `verify:runtime` uses stable DOM/runtime/layout checks instead of repeated GPU readback.
