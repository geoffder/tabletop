# Web of Power scenarios

The dev harness lists these under **Scenarios**, named for their files; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/web-of-power`. All but Nearly full are seeded playouts.

- **Middle game.** Four players part way through the first pass of the deck, with cloisters across most of the map and a few advisors: for judging the board half full.
- **Late game.** Five players after the interim scoring, the map nearly full: for judging the crowded board and the advisors on the coats of arms.
- **Red country.** Eve (red) to play, with three cloisters in Franken and Aragon and a Franken-Aragon card: for judging red pieces on lit red countries.
- **Interim scoring.** Four players, one card left in the deck. Place, then draw the last card: the interim scoring plays country by country, the discard pile becomes the new deck, and the player carries on drawing.
- **Final round.** Four players, the deck run out a second time. Place or pass: nobody draws, the face-up cards are not replaced, and the game ends after the player before the starting player.
- **Joker.** Alice holds two Franken-Aragon and a Bayern-Burgund. Choose both Franken-Aragon cards: every country with room lights, England, Italien, Frankreich, Lothringen and Schwaben among them, which neither colour names. Place in England: both cards go to the discard, no second piece can follow there with Bayern-Burgund, and Alice draws.
- **Alliance tie.** Four players, Dan to play the last turn. Pass: the game ends, and alliance 13 scores 5 points each for Bob and Dan, who share the lead in advisors in both its countries.
- **Branched chain.** Four players, Dan to play the last turn, his cloisters in two connected groups along the roads, of eight and five. Pass: the final scoring gives Dan's chains 6 and 4 points, the longest unbranched run of each group; the branches don't score.
- **Faster variant.** Four players with the faster variant on, Alice to play, Bayern still empty. Found a cloister in Bayern: a second cloister may follow there or a piece in another country, but no advisor in Bayern. Or send an advisor to Frankreich: the second piece may go in any country.
- **Nearly full.** The late game filled in by the generator: every space taken but Molesmes, and every country holding as many advisors as its cloisters allow. Alice can only found a cloister at Molesmes in Frankreich; doing so ends the game at once, since nobody could put down another piece, and the final scoring plays.
