# Mexica scenarios

The dev harness lists these under **Scenarios**; loading one again starts it over.
`scripts/build-scenarios.mjs` writes Founding and Canal rides (it plays bot games, so rerunning
it also rewrites Middle game and Late game; restore those with `git checkout` unless they are
meant to change). `src/lib/model/scenarioFiles.spec.ts` checks every file.

## Founding

Four players in the first period, Alice to move. Three players can found straight away, each on
their own turn, in a different setting:

The prompt offers the founding without forcing it: the Pilli Mexica's moves stay marked and the
pieces can still be picked. The matching token on the display is ringed like a choice; choosing
it picks up the founding, as **Found it** does, and choosing it again lets go.

- **Alice** stands at A4 in a district of 7 in the island's top left, across the board from the
  Emperor's display. Choose **Found it**, then D3: the 7 lifts off the display and fades, the
  tokens after it slide over to close the gap, and it drops onto D3 behind the tall green temple
  on D4, with a bounce.
- **End turn. Bob** stands at R6 in a district of 8 right by the display. Found it, then P7: a
  short drop just above the display.
- **End turn. Carol** stands at B7 in a district of 4 on the west side, where Dan's Pilli Mexica
  also stands. Found it, then B8: Carol scores second place and Dan third as a visitor.
- Undo after any founding: the token slides straight back to its place on the display and the
  others open up for it.

## Canal rides

Four players in the first period, Bob to move from the bridge at Q8 with 6 action points. Each
way of moving by water is a choice:

- **Q9**, the bridge beside Q8: the Pilli Mexica just hops across.
- **O8** or **O6**: a canoe slides out from under Q8, the Pilli hops down into it, it paddles
  round to the bridge, the Pilli hops up and the canoe slides back under.
- **N7**: a ride to O6 and on, the canoe passing under O6 while the Pilli hops over its deck.
- **H13**: the water joins only round the island, so the canoe paddles off the board's east
  edge and back on at the south, near H14, before the Pilli lands on H13.
- Undo after any ride: the Pilli slides straight back to Q8.
