# Mexica scenarios

The dev harness lists these under **Scenarios**; loading one again starts it over.

## Founding

Four players in the first period, Alice to move with 6 action points. Written by
`scripts/build-scenarios.mjs` (`foundingBehindTemple`): a district in the island's top left,
across the board from the Emperor's display, with a tall red temple on B2 in front of its free
square B1.

- Choose C2 (the 5-point teleport), then **Found it**, then B1: the 7 token lifts off the display
  and fades, the tokens after it slide over to close the gap, and the token drops onto B1 behind
  the red temple with a bounce.
- Undo: the token slides straight back to its place on the display and the others open up for
  it.
