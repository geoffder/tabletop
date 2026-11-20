# Mexica: rules interpretations

The game follows the Super Meeple / Iello rulebook (2015), which matches the Ravensburger / Rio Grande rules of 2002. Readings below were settled with the user on 2026-11-19. Each has a test in `src/definition/game.spec.ts`.

## Sources

- Super Meeple / Iello English rulebook, and the Super Meeple French rulebook (2015).
- Rio Grande Games rules, 2002 (Garry Lloyd's translation of the Ravensburger rules).
- BoardGameGeek rules forum for Mexica (thing 2955), threads cited below.

## Board and pieces

- The island is a 21 × 14 grid with 196 land spaces, including the five palace spaces and the four spaces of the canal dug before play. The original and Super Meeple boards have the same layout.
- The palace spaces count toward a district's size. No canal, temple or token may go on them; Pilli Mexica may stand on all five, the emblem included (Rio Grande calls it the Sacred Site).
- The fifteen calpulli tokens have sizes 3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10, 11, 12, 13. Their three values are the size, half the size rounded up, and half of that rounded up.

## Founding

- The founder scores the token's middle value; every other player with a Pilli Mexica in the district scores its small value. Play For Keeps' draft rulebook gives every player in the district the middle value; a backer flagged it as an error (BGG thread 3759052), and the Iello rules are followed.
- Founding is free and needs the founder's Pilli Mexica in the district, a token of the district's exact size on display, and an empty non-palace space for the token.

## Movement

- Bridges are boarded on foot only from their ends (BGG thread 1758738).
- A boat ride costs one point to each next bridge reached through canals and the lake. Passing under a bridge costs the same as stopping on it; a bridge with another Pilli Mexica on it can be passed under but not stopped on. The lake joins every canal that touches it (BGG thread 2017301).
- A player clicks a destination and the Pilli Mexica goes by the cheapest route on foot and by boat, or by the 5-point teleport when that is cheaper. Nothing happens on the way, so the route is never the player's choice.
- No canal may go on a space a bridge's ramp rests on (BGG thread 2454913).

## The first round

- Until every player has had their first turn of play, no action may shut in another player's Pilli Mexica or cut it off: afterwards it must still have a one-point move, and must still reach the island's largest district on foot or by boat. Rules: Super Meeple's Teleport remark ("not allowed to pen a player in, or to surround her"), the French temple example ("enfermer … qu'en bâtissant un pont ou par un transfert de 5 PA"), Rio Grande's "not allowed to lock up a Mexica" as quoted in BGG thread 4042 ("require the owner to spend 5 AP or build a bridge to escape"). The first round is every player's first turn, not the first period (BGG thread 92986).

## Action points

- Actions spend the turn's six points first, then action tokens, which return to the supply.
- Action tokens are bought only with the turn's own points, at most two a turn, while the supply of twelve lasts.

## Period ends

- A period ends after the round in which its tokens are all used and some player has built all their temples, so everyone has had as many turns.
- Tokens no district can take any more leave the display automatically, in either period: when no unfounded district of the token's size has room for the token and a Pilli Mexica, and no larger one could still be cut down to it (no canal tiles left, or too few free spaces). The printed rule has players agree to remove them; online, nobody can block it (BGG thread 2515299).
- If every player ends a turn without doing anything, one after another for a full round, the period ends at once. Rio Grande's rules: "the scoring is also triggered if nobody wishes to take any further actions."

## Scoring

- A player needs at least one temple level in a district to place (BGG thread 2052789).
- Tied players each score their place in full, and the places they fill are skipped. Unfounded districts in the final scoring tie the same way (BGG thread 2038909).
- A Pilli Mexica on one of the four starting spaces (not the emblem) scores 5 at each scoring.
- The most prestige wins; then the most action tokens; still tied, the win is shared.

## Two players

- Peter Steinert's neutral temples are a creation option, on by default: ten temples (four 1s, three 2s, two 3s, one 4) placed at random, never touching the lake on a side or corner, never on the palace or the dug canal, and at least five steps apart along rows and columns ("at least four spaces between them"). They take places in every district but score nothing.

## Not offered

- Play For Keeps' second, smaller map: its layout and setup were not public when the title was built.
