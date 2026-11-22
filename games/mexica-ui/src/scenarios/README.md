# Mexica scenarios

The dev harness lists these under **Scenarios**; loading one again starts it over.
`scripts/build-scenarios.mjs` writes Founding, Canal rides, Jump over, Jump into canoe, Ruled out, First scoring and Final scoring (it plays bot games, so rerunning
it also rewrites Middle game and Late game; restore those with `git checkout` unless they are
meant to change). `src/lib/model/scenarioFiles.spec.ts` checks every file.

## Founding

Four players in the first period, Alice to move. Three players can found straight away, each on
their own turn, in a different setting:

The prompt offers the founding without forcing it: the Pilli Mexica's moves stay marked and the
pieces can still be picked. The matching token on the display is ringed like a choice; choosing
it picks up the founding, as **Found** does, and choosing it again lets go.

- **Alice** stands at A4 in a district of 7 in the island's top left, across the board from the
  Emperor's display. Choose **Found**, then D3: the 7 lifts off the display and fades, the
  tokens after it slide over to close the gap, and it drops onto D3 behind the tall green temple
  on D4, with a bounce.
- **End turn. Bob** stands at R6 in a district of 8 right by the display. Found, then P7: a
  short drop just above the display.
- **End turn. Carol** stands at B7 in a district of 4 on the west side, where Dan's Pilli Mexica
  also stands. Found, then B8: Carol scores second place and Dan third as a visitor.
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

## Jump over

Four players in the first period, Carol to move from the bridge at O6, with Alice's Pilli Mexica
moved onto the bridge at O9 and an empty bridge just beyond it at O10, all on one canal.

- **O10**: the canoe slides out from under O6 and paddles down the canal. Carol stays behind Alice
  while rising, jumps clear over her headdress as the canoe passes under O9, and comes down in
  front of her straight onto O10's deck, never touching the canoe again; the canoe slides on
  under O10.
- **R8**: the same leap onto O10's deck, then a hop down into the canoe beyond it and a ride on
  to R8.
- **N10**: the leap onto O10, then a walk off its end.
- O9 is not offered as a place to stop.
- Undo: the Pilli slides straight back to O6.

## Jump into canoe

Four players in the first period, Bob to move from the bridge at N5, with Alice's Pilli Mexica
moved onto the bridge at O7 and the next bridge, M10, a long way on by water.

- **M10**: the canoe slides out from under N5, the Pilli hops in, jumps clear over Alice as the
  canoe passes under O7, comes back down into the canoe beyond her bridge and rides on to M10.
- O7 is not offered as a place to stop.
- Undo: the Pilli slides straight back to N5.

## Ruled out

Four players late in the second period, Carol to move. The Emperor's display holds two 4s, and
the only district left that can take a 4 is up at F1.

- Pick the **3-level temple** and choose **F1**: no district can take a 4 any more, so both 4s
  crack in two, the halves drifting apart and fading.
- Undo: the temple lifts off and both 4s fade back onto the display.

## First scoring

Four players at the end of the first period: every district token is founded and a player has
built all their temples, and the last player in turn order is to move.

- **End turn**: the period scores. Each founded district in turn, smallest first, shows its awards as chips in the players' colours rising over its token; a Pilli
  Mexica on a starting space gets **+5** over its head; the cards count the scores up. Then the
  second period's tokens drop onto the display together, and any that no district can take
  break apart.

## Final scoring

Four players at the end of the second period, the last player to move.

- **End turn**: the game ends. Founded districts score over their tokens and unfounded ones over
  their middle square, one after another from the smallest to the largest, and the cards count up to the final scores.
