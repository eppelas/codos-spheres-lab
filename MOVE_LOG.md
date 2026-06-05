# Move Log

## 2026-06-04

- `test-results/` -> `Trash/codos-spheres-lab-cleanup-20260604-1852/test-results`
  Reason: stale Playwright trace/error artifacts from earlier failed verifier attempts; not needed for the reviewable project.
  Rollback: move the trashed `test-results` folder back into the project root.

- `.agent-hub/` -> `Trash/codos-spheres-lab-cleanup-20260604-1852/.agent-hub`
  Reason: empty scratch folder in the standalone project.
  Rollback: move the trashed `.agent-hub` folder back into the project root.

## Launcher Updates

- `_ Codos Spheres Preview.app` regenerated in place from `preview-icon-source.png` after adding the graph scene.
  Reason: keep Finder launcher icon representative of the current preview target.
  Rollback: use `! Open Codos Spheres Preview.command` directly, or regenerate the `.app` with an earlier `preview-icon-source.png` if one is restored from backup.
