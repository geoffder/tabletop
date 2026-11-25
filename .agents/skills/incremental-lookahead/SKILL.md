---
name: incremental-lookahead
description: Speed up rule checks that need the position after each candidate action (lookahead), by laying each action's change over one shared position instead of replaying it on a copy. Use when picking a tool, piece or move lags while its targets are marked, or when a rule must test the result of many candidate actions.
---

# Incremental lookahead

Some rules judge an action by the position it leaves: Mexica's first round forbids any action that
shuts in another player's Pilli Mexica. Marking a tool's legal squares then means **lookahead** on
every candidate. Done naively (copy the game, play the action, recompute everything, ask the rule),
Mexica's canal and temple tools took about 200 ms per pick across 190 squares. Done incrementally,
temples took 1 ms and the canal 2 to 6 ms, with the same answers.

[`examples/mexica-measure.mjs`](examples/mexica-measure.mjs) times each tool pick in a harness.

## Steps

1. **Find the worst position.** Lookahead costs (candidates) × (cost of each check), so time it
   where both peak: usually the opening, when the board is open and every square is a candidate.
   A late scenario with a few options hides the cost. Mexica's queries first measured "cheap" in
   a late position and cost 200 ms in the opening. Done when you have the position with the most
   candidates for each slow tool, reached in the harness.
2. **Measure the query apart from the paint.** In the page, pick the tool, read its target set
   (the getter runs the derived query), then wait for the next frame. Time the query, the wait for
   the frame and the paint after it, at 1x and with the CPU slowed 4x, with a CDP profile of self
   time (the example does all three). Done when each tool's pick is split into query and paint, and
   the profile names the functions the query spends its time in. A paint over a few ms belongs to
   `new-game`'s `references/performance.md` (marks drawn as one path per kind), not here.
3. **Cut the per-candidate work**, in the order below (*Techniques*), measuring after each.
   Done when the query is a small part of the frame in the worst position, or what is left is
   named and measured.
4. **Prove the shortcut gives the same answers.** Write a spec that walks seeded positions from the
   opening onward and, for every kind of change an action makes, compares the change laid over the
   position with the action played out on a copy: the whole layout (every piece and every derived
   region), then the rule's answer. Assert that every kind of change was compared, that the
   comparisons run into the thousands, and that the rule said no often enough to matter (Mexica:
   over 2,000 layouts, all five kinds, over 50 Pillis shut in). Check any derived index against
   brute force (each cut square against digging that square). Done when the spec passes and its
   counts show every branch was reached.
5. **Re-measure the same position** and write the before and after times in the commit message.

## Techniques

Each one removes work from every candidate, so the first ones usually pay most.

- **Hoist what the position decides.** Facts that do not depend on the candidate are found once
  per batch. Expose the check as a function that takes the position and returns a per-candidate
  test: `everyoneFreeAfter(playerId)` finds who is free now (only they can be shut in) and returns
  `(change) => boolean`; outside the first round it returns `() => true` at once.
- **Ask only what the rule needs.** Mexica's freedom test planned every route to the whole island,
  paths included, to learn whether a Pilli had one step to take and could reach the largest
  district. Now: one look at its steps, an early yes when it already stands in the largest
  district (every Pilli does on the opening mainland), and only then a reachability search with no
  paths. Use an index, not `shift()`, to run a search queue.
- **Describe the action's change as data.** A small object says what the action puts where:
  `LayoutChange { dug?, temple?, token?, pilli?, bridge? }`. The state handler validates the action
  with the same change the UI marks targets with, so the marks and the rule cannot disagree. Build
  the change from the layout already in hand: a helper that builds a fresh layout to read one fact
  pays that for every candidate.
- **Lay the change over one shared position.** The position's derived view (`Layout`: what stands
  where, as maps and sets) gets `after(change)`, which copies the small maps, applies the change
  and returns a new view. The game itself is never copied.
- **Reuse the derived structures the change leaves alone.** Regions (districts, groups, chains)
  cost the most to rebuild. A change that adds no water shares the region list and index as they
  are. A change that removes squares from regions rebuilds only the regions it touched.
- **Know when a removal splits a region.** Removing one square from a region leaves it whole unless
  that square is a cut vertex. Find every cut vertex of the position at once with Tarjan's
  low-link search (iterative, over typed arrays), cached on the layout the first time it is asked.
  A single square off a region through a non-cut square just filters it out of that region, and no
  search runs. The shared index stays valid when the region lookup checks that a square is still
  ground before reading the index.
- **Look neighbours up from tables.** Precompute each square's neighbours per direction once per
  board; a neighbour function that builds arrays runs millions of times in lookahead.
- **Keep UI results across toggles.** A Svelte `$derived` reruns when anything it read changes.
  Moves shown only while no tool is held should not read the tool: derive the moves from the state
  alone, and the shown moves from the tool and those moves, so picking a tool up and putting it
  down finds them once per state. A class field read by another field's `$derived` must be
  declared first, or `svelte-check` fails on "used before its initialization".

## Where it was done

Mexica, branch `mexica`: `games/mexica/src/model/layout.ts` (`LayoutChange`, `after`,
`isCutSquare`), `gameState.ts` (`isFree`, `everyoneFreeAfter`, `foundingChange`), `board.ts`
(neighbour tables), `layout.spec.ts` (the equivalence spec), and
`games/mexica-ui/src/lib/model/session.svelte.ts` (`targets`, `canalTargets`, `reachable`).
Commits `e963f6d66`, `6fbea6422`, `1fb96c58f`.
