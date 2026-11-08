# Ready for review

The `game-pr-readiness` skill is the gate; this is what the nine GIPF project titles failed on their first review (2026-11-07), so a new title passes it the first time. Each lesson lives in the step that applies it; the index below points there and to the commit on the `gipf` branch that fixed it.

## Before running the review

1. **Rebase onto upstream's `main`** and keep the PR range clean. A title's PR is the range from its first commit to the tip. Commits that never go upstream, such as this skill and the devcontainer's `turbo.json` allowed-host fix, sit below it. Outside `games/<slug>` and `games/<slug>-ui`, the range touches only the title's `games.json` entry and its own lockfile importers. A rebase does not resolve `games.json` or the lockfile: append the title's entry to upstream's file, then take upstream's lockfile and run `pnpm install` in the container. A merged lockfile installs as broken (`no entry for …`).
2. **Run every check against fresh builds.** The UI package reads `@tabletop/frontend-components` from its `dist/`, so build all of its dependencies first (`pnpm --filter @tabletop/<slug>-ui^... build`). A stale `dist/` type-checks and tests the title against the old shared code, and every UI check then means nothing. Then run:
   - `lint` and `check` in both packages;
   - Vitest over `games/<slug>` and `games/<slug>-ui/src`;
   - the UI's Playwright `test`;
   - `bundle` and `bundle-check.mjs`.
3. **Format the tracked files.** Upstream's pre-commit hook formats staged files with prettier and never blocks a commit. A rebase or a commit from a checkout without `node_modules` skips it, so check with `prettier --list-different` over the title's tracked files.

## What the first review failed, and where the fix lives

| Finding | Fix | Lesson | Example on `gipf` |
|---|---|---|---|
| Unused template dependencies | Remove them | `scaffold.md` | `ea4eb081e` |
| No `metadata.visibility` | `GameVisibility.Alpha` | `scaffold.md` | `ea4eb081e` |
| No `randomnessVersion: 1` | Declare it on the runtime | `scaffold.md` | `ea4eb081e` |
| JPEG cover; unused alternative covers | Lossy WebP 680 px high; commit one cover | `scaffold.md` | `ea4eb081e` |
| Preferred colours swap name badges | `allowPreferredPlayerColors()` returns `false` | `scaffold.md` | `ea4eb081e` |
| UI unit tests never ran; old tooling | UI `vitest.config.ts`; Rolldown configs | `scaffold.md`, `ui-lessons.md` | `8dc7c817e` |
| Undo overridden | Register the selection with `localSelections` | `ui-lessons.md` | `231f234b2` |
| Captures reported as final scores; no competition spec | Winner 1, loser 0; `competition.spec.ts` | `logic.md` | `bc0fddcb5` |
| Board left showing an abandoned run | Guard `afterAnimations` overrides | `animation-lessons.md` | `e4021bb49` |
| `test` script fails with no Playwright tests | Smoke spec on the title's port | `browser-checks.md` | `afeee5d9d` |
| Rule readings recorded only in session notes | `docs/rules-interpretations.md` | `logic.md` | `689a366c8` |
| Rules allow a choice the UI never offers | Offer it with the rules' default | `logic.md` (record and test each reading) | `385c527df` |
| A rule reading with no test (GIPF: simultaneous loss, blocked ending) | Test each | `logic.md` | `18c5fad7b` |
| Board geometry and a duplicate turn field in State | Store pieces only; use the turn manager | `logic.md` | `a1666b2af` |
| GSAP and a Svelte outro on one node | One animator per node | `animation-lessons.md` | `54987f69c` |
| Type-assertion casts; silent fallbacks; local copies of shared helpers | `assert`/`assertExists`; reuse `@tabletop/common` helpers (`sameCoordinates`, `distanceAxial`, `coordinatesToNumber`) | `scaffold.md`, `logic.md` | `97a5a493b` |
| Piece looks sized for full zoom | 2.5× the largest fitted size | `performance.md` | `3d1799911` |
| Visual contract out of date | Update it in the change that alters the UI | `docs/ui-interaction-visual-contract.md` | `1e198073c` |
