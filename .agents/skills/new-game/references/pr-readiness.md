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
| Comments narrating the code (not counted, but the likeliest review comment) | Keep only reasons (coding policy #38–41) | `SKILL.md` | `6fea763d9` |

## What the second and third reviews found

GIPF's second review (all first-pass fixes in) failed on these; MATRX was brought up to the same mark before its first review, which found the last four rows.

| Finding | Fix | Lesson | Example |
|---|---|---|---|
| No `hasScores: false` on a win/loss title | Declare it in the info metadata | `logic.md` | `gipf` `b4007ee0b` |
| One rule written out in several places (a GIPF-piece is two pieces) | One exported helper, used by both packages | `logic.md` | `gipf` `e182ddf4f` |
| A decision tapped several times is one Undo step | A stacked stage (`pushStagedSelectionValue`) | `ui-lessons.md` | `gipf` `0c4b638d8` |
| No test that a stage outside the order throws | Add it to the staged-selection spec | `ui-lessons.md` | `gipf` `0c4b638d8` |
| Another player's Undo leaves the piece staged on its dot | Restage only for your own Undo; anything else slides back and lifts off in one ≤ 0.2 s motion | `animation-lessons.md` | `gipf` `bdc1534c1` |
| A view switch or far-side turn mid-move leaves its tweens running | A session `moveInterrupter`: `abandon()` on `view-switch`, `interrupt()` on the toggle (since superseded: each animator stops only its own tweens, see below) | `animation-lessons.md` | `gipf` `40964fab3`, `3f5923485` |
| After an Undo hands the harness's Non-active view over, a hidden selection absorbs the next Undo | Keep the selection to the player who made it | `ui-lessons.md` | `gipf` `fbf922e9c` |
| A step back animates the wrong push | Read the undone move by index, not from `onHistoryAction` | `animation-lessons.md` | `gipf` `632741e12` |
| `svelte-ignore` on the tap-off `<svg>` | Accepted at first; the maintainer then moved it onto a `role="presentation"` wrapper in every title | `ui-lessons.md` | `a5afb8f2c` |
| No session or staged-selection spec at all | Write both; the UI's `vitest.config.ts` needs `root: projectRoot(import.meta.url)` | `ui-lessons.md` | `matrx` `2e1b0d442` |
| A branch the flow can never reach (MATRX: rows at the start of a turn) | Probe it with a throw under the playouts; delete it if it never fires | `logic.md` | `matrx` `0c81fe0f5` |
| Optional fields kept for "games from before" a change, on a title never deployed | Make them required | `logic.md` | `matrx` `c758aedb6` |
| Smoke spec times out clicking a covered target | Press the target's keyboard path (Enter) | `browser-checks.md` | `matrx` `dc5314f22` |

## What gate 16 found after the merge

Gate 16 (phone rendering) was added to the review after the GIPF project titles first passed it. Merging `main` into each PR branch brought it in, and all four titles failed it the same way. A new title drawn by `docs/phone-rendering.md` from the start avoids each row.

| Finding | Fix | Lesson | Example on `game-gipf` |
|---|---|---|---|
| Labels centred with `dominant-baseline` | Alphabetic baseline, `dy` 0.35 × font size in user units, `letter-spacing` in px | `ui-lessons.md` | `a2aea2931` |
| GSAP writes `matrix()` on moving SVG | A pose that writes `translate()`/`scale()` from its setters | `animation-lessons.md` | `09ee9f3ba` |
| No check that moves stay off `matrix()` | `tests/motion.spec.ts` over each kind of move | `animation-lessons.md` | `dbb96354f` |
| Shadows drawn with a blur filter | Radial-gradient ellipses | `ui-lessons.md`, `performance.md` | `948776b5f` |
| A table-sized mask (MATRX's grid fade) | A gradient of the table's colour laid over it | `performance.md` | `matrx` `af68c72f5` |
| Visual contract silent on the new drawing | Record the motion and shadow rules in it | `docs/ui-interaction-visual-contract.md` | `d6baf2297` |

## What the maintainer changed at merge (2026-11-15/16)

The four titles above merged, then the maintainer made follow-up fixes on `main`. The other five (YINSH, DVONN, LYNGK, TZAAR, PÜNCT) were opened without a review, with a temporary `REVIEW-NOTES.md` listing the known fixes and the author's decisions; he did the readiness work himself, one logic commit and one UI commit per title, and squash-merged. Each lesson now lives in its reference file; the headlines:

| Change | Lesson | Example on `main` |
|---|---|---|
| Pieces carry ids in State; the animator diffs boards by id; inference, `historyMove` and `knownMove` deleted | `logic.md`, `animation-lessons.md` | TZAAR `839351b09`, LYNGK `b7f042747` |
| Optional ids and their fallbacks deleted; icons synthesise ids | `ui-lessons.md` | YINSH `4e1ad36cf` |
| No derivable values, setup-only config or duplicate counts in State; schema invariants checked in specs | `logic.md` | PÜNCT `06fc9dfe6`, YINSH `815e96171` |
| Turn outcome worked out once, in the handler, written as `passedPlayerId` | `logic.md` | DVONN `e8168c726` |
| `seriesKeeps = 'latest'`; config readers throw on unknown values; `bggId`; `series` | `logic.md`, `scaffold.md` | `36405defd`, `4497039ac`, `e35ef711b`, `f879fddf7` |
| White option added to GIPF and YINSH | `logic.md` | `dc33c3d3e`, `891013da4` |
| Staged piece lifts off only when the player lets it go; restage checks read the incoming state | `animation-lessons.md`, `ui-lessons.md` | `c7d160278`, `b277355f5` |
| Each animator stops only its own motion; every layout preference interrupts | `animation-lessons.md` | TZAAR `839351b09` |
| Marks fade per node, never a layer | `animation-lessons.md` | YINSH `4e1ad36cf` |
| No Svelte `crossfade`/`animate:flip`/`Tween`, no reactive writes per frame, no `$effect` feeding motion | `animation-lessons.md` | LYNGK `b7f042747`, PÜNCT `06fc9dfe6` |
| Tap-off on a `role="presentation"` wrapper | `ui-lessons.md` | `a5afb8f2c` |
| End panels assert the result | `ui-lessons.md` | YINSH `4e1ad36cf` |
| Specs fail on console errors; shared `tests/harness.ts`; undo-timing spec | `browser-checks.md` | DVONN `0f8377044` |
| Image pieces' tap areas (a player's report after merge) | `ui-lessons.md` | `a51d325be`, `2414a6e64` |
| Comments that cite other titles or precedent removed | `SKILL.md` | TZAAR `839351b09` |

He kept the author's decisions recorded in the notes: every return motion, overlapped to fit 0.2 s; other movable stacks hidden once one is chosen; win/lose scores with totals on the cards; rule readings; stack limits off. Where the notes proposed patching guessing machinery, he replaced it with diffs by id instead; expect that.

**The PR bot.** A Greptile bot reviews every PR and posts inline findings. Several were real and are now lessons (fractional coordinates, unbounded row building, called games in the end panel, focus rings, scenario ids, staged preview kind, cleanup on detach), and some were still open on `main` after merge. Read and answer each finding before asking for a merge.

**Visual contract.** The reworked contracts carry a "Shared visual state" table (producer → consumers, lifetime, validity) and a regression table whose "Verified" column names the spec or says manual (`games/punct-ui/docs/ui-interaction-visual-contract.md`).

## Opening the PR

1. **Make a `game-<slug>` branch of the title's own commits**: `git rebase --onto <upstream base> <commit below the title's first> game-<slug>` leaves out this skill and the `turbo.json` fix. Then **merge** upstream's `main` rather than rebasing again, so the reviewed commits stay as they were. Take upstream's lockfile, run `pnpm install`, and confirm `pnpm install --frozen-lockfile` passes on the merged branch.
2. **Collect the evidence again on the merged branch**: every check in *Before running the review*, and any gate added since the title's review, run in full. Say in the PR which was which: "passed review before the merge; evidence collected again and gate 16 run in full".
3. **A change to shared code goes in its own PR first.** GIPF with Potentials needed `isOptionDisabled` on the configurator (#264). The title's PR (#268) carries that commit, opens as a **draft** whose first line says "Depends on #264" and that its diff shows the two shared files until then, and is marked ready once #264 merges.
4. **The description** follows #266–#269: what the title is and its two packages, version 0.0.1 shipping as Alpha, and the designer's position. Then what it touches outside its folders, the logic (setups, a turn, rules, end, rulings, tournament setup) and the UI (board, moves, motion, toggles, scenarios, visual contract). Next come phone rendering, and testing with each package's counts, the bundle check and gate 16's phone cost. Notes for review end it: squash-merge, and any known gap with the platform change that would close it. Check every number and description against the branch before posting; drafts overstated playout counts and described motion not yet verified.
