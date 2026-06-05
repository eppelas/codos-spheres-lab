# Task Verification Canvas

Status meanings:
- `requested`: asked for, not yet implemented
- `implemented`: changed in code/content, not fully verified yet
- `self-checked`: assistant re-checked the result directly
- `user-approved`: explicitly approved by the user

## User Requests

- Status: self-checked
  Owner: assistant
  Task: Build a standalone empty project containing only an original interactive Codos-style warm particle-sphere animation.
  Last Checked: 2026-06-04
  Notes: Based on direct Codos runtime/bundle inspection, not only on the screenshot. `fos-landing` was not edited. Preview is running locally through the Vite launcher on port `5174`.

- Status: self-checked
  Owner: assistant
  Task: Add the second Codos `Setting contexts.Graph` animation and extend the page length so spheres travel broadly, shrink to `0.1x` in places, and disappear at the end.
  Last Checked: 2026-06-04
  Notes: Graph scene is based on inspected Codos `E4` logic: `1153x777` absolute-card layout, SVG cubic paths, 4 flow dots per path, and `getPointAtLength()` movement. Latest revision makes the graph 2x smaller on desktop and places it on the right half; graph dots are 3x slower; the first `0.1x` compression keeps the particles together as one small left-side cloud.

- Status: self-checked
  Owner: assistant
  Task: Add a duplicate `/firefly` variant where the same choreography uses black p5-like wire spheres, role labels inside spheres, an interactive participant-path scheme, and a June 6-27 track calendar.
  Last Checked: 2026-06-05
  Notes: Implemented `WireSphereFieldThree` as a Three/R3F WebGL layer based on a local pastel-firefly HTML reference; the earlier native React/canvas layer remains as an unused fallback. Latest revision responds to user feedback that separate matching balls looked like noise, 2D canvas lagged, the Three cloud was not moving on scroll, the first WebGL pass became too visually thin, the participant-path scheme was unusable, and the vertical path had scale gigantism. `/firefly` now uses one GPU-rendered uneven wire cloud with explicit scroll route, dense internal weave, varied density, GPU point-body mass, escaping fragments, pointer stretch, click burst, `0.1x` compression, and fade-out. Vertex/Gemini visual scouts ran with `node scripts/vertex-visual-scout.mjs`; outputs are `.agent-hub/tmp/vertex-gemini-scout/gemini-2.5-pro.report.md` and `.agent-hub/tmp/vertex-original-graph-scout/gemini-2.5-flash.report.md`. The path UI now has two versions: a compact clickable vertical participant journey and a duplicated Codos-like `Setting tracks.Graph` section with lavender cards, yellow merge judge, thin SVG paths, 48 orange runner dots, and pastel bubble background. Track selection is click-only; active nodes show matching June dates/events; the June 6-27 calendar highlights matching days/workshops. Preview route is `http://localhost:5174/firefly`.

- Status: self-checked
  Owner: assistant
  Task: Fix terminal subagent runner so agent-hub can be used again without Codex token/model failures.
  Last Checked: 2026-06-05
  Notes: The workspace-local `.agent-hub/tmp/codex-home/auth.json` was stale and no longer matched `~/.codex/auth.json`; the stale file was moved to `.agent-hub/backups/2026-06-05-subagent-auth-refresh/auth.json.before-sync`, then current auth was copied in. `.agent-hub/bin/agent_exec.py` now refreshes `auth.json` from `~/.codex` on each run and explicitly launches child Codex with `--model gpt-5.5` so the old unsupported `gpt-5.3-codex` config cannot break subagents. Smoke test returned `subagent works.`

- Status: implemented
  Owner: assistant
  Task: Publish the standalone Codos spheres lab to GitHub Pages without additional confirmation and ask Sonya to send the Pages link when it is ready.
  Last Checked: 2026-06-05
  Notes: GitHub Pages workflow and relative Vite asset base are configured. Awaiting production build, GitHub push, Pages deployment check, and Sonya link handoff.

## Agent Self-Checks

- Status: self-checked
  Owner: assistant
  Task: Verify the animation renders, moves, responds to pointer/click/scroll, and works on desktop/mobile preview.
  Last Checked: 2026-06-05
  Notes: Final `npm run build` passed. Final `npm run verify:runtime -- --path=/firefly` passed for desktop and mobile: no horizontal overflow, one canvas, `flowDotCount: 48`, `programNodeCount: 12`, `calendarDayCount: 22`, and click-based track switching updates active days. Playwright screenshots were captured and manually reviewed at `/private/tmp/codos-firefly-path-compact-desktop.png`, `/private/tmp/codos-firefly-path-compact-mobile.png`, `/private/tmp/codos-firefly-codos-graph-desktop.png`, and `/private/tmp/codos-firefly-codos-graph-mobile.png`. WebGL pixel readback is intentionally unavailable in the runtime verifier because the canvas does not use `preserveDrawingBuffer`, which avoids a performance penalty.

- Status: implemented
  Owner: assistant
  Task: Verify the GitHub Pages release path after configuring deploy.
  Last Checked: 2026-06-05
  Notes: Pending local production build, GitHub Actions deploy, live Pages HTTP check, and Sonya handoff.

## Approved / Closed

No user-approved items yet.
