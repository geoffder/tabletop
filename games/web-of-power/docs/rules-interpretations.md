# Rules interpretations

Choices made where the rules are silent or where online play needs a firm rule. The rules followed are the Rio Grande English rulebook (country names as printed on its board) and the German Goldsieber original, _Kardinal & König_, which agree. Tests in `src/definition/game.spec.ts`, `src/definition/visibility.spec.ts` and `src/definition/competition.spec.ts` cover them.

## The board

- **The map is read from the printed board**: 51 named cloister spaces, the roads between them, and the 15 numbered alliances. Alliance 10 is Schwaben–Franken (its box straddles that border); Lothringen and Schwaben have no alliance, as on Schacht's prototype board ([BGG thread 2995339](https://boardgamegeek.com/thread/2995339)). The rulebook's own examples (alliances 14 and 15, the chain from Le Thoronet to Fossanova) agree with the reading.
- **The west-coast cloister of Frankreich is Bontieu**, as its hand-lettered label reads.

## Players and options

- **Three to five players**, as published. There is no two-player mode.
- **The faster variant** from the rulebook is a game option, off by default: pieces may go in one or two countries a turn, and an empty country may be opened with two cloisters, never a cloister and an advisor.
- **Open discard pile** is a game option, on by default: anyone may look through the discard pile. Every card in it was shown when it went there, so this hides nothing a careful player could not remember. The pile is public in the game's state either way; the option decides only whether the table offers to show it.
- **Starting player and colours**: turn order is drawn at random, and the five colours are dealt to the seats at random. Tournaments seat players in the order given.

## Placing pieces

- **The advisor limit counts each piece as it goes down**: a cloister placed first in a turn raises the limit for an advisor placed after it in the same turn ([BGG thread 2713856](https://boardgamegeek.com/thread/2713856), said to match Schacht's own online version).
- **Opening a country ends the placing** in the standard game: the first player to place in a country places one cloister there and nothing else that turn.
- **A joker is two cards of one colour**, for one piece in any country, including a country those cards name.
- **The turn moves on by itself** once a second piece can no longer go down (two placed, no legal place left, or no cards to pay); otherwise the player may stop after one piece.

## Cards

- **Drawing is a card at a time**, from the face-up cards or the deck in any order; a card drawn from the deck is seen before the next choice ([BGG thread 63289](https://boardgamegeek.com/thread/63289)). Face-up cards taken are replaced only once the hand is full again.
- **Cards of one colour are alike**, so taking a face-up card names its colour, not its slot.
- **Exchanging is allowed whenever a player places nothing**, even if they could place.
- **A card drawn from the deck is seen only by its player**; played and exchanged cards are shown.

## Running out of cards

- **The deck runs out when its last card is drawn**, whether a player draws it or it refills a face-up card. The first time, the interim scoring happens at once; the discard pile, not the face-up cards, is shuffled into the new deck, and the player carries on drawing.
- **The second time, drawing stops at once**, for the player drawing too, and face-up cards are no longer replaced. The round is played out, ending with the player before the starting player; if that player emptied the deck, the game ends after their turn.
- **In the last round a player places pieces or passes**: with no drawing, exchanging would leave them a card short.
- **The game also ends at once when nobody could place a piece**, cards aside: every space is taken and no advisor fits anywhere, or nobody has a fitting piece left.

## Scoring

- **Cloisters** score by place in each country: the most scores one point per cloister there, each later place scores the count of the place before it; tied players share their place, and the next place follows them (rulebook examples for Franken and Lothringen).
- **Alliances** score for every player who leads, or shares the lead in, advisors in each of the two countries: one point per advisor in both countries. A country with no advisors has no leader.
- **Chains**: in each connected group of a player's cloisters along the roads, only the longest unbranched run scores, one point per cloister, when it is four or more. Whatever branches off it does not score, even a branch long enough to be a chain itself ([Pöppelkiste review](https://www.poeppelkiste.de/rezensionen/2000/kardinal/kardinal.php): "bei Abzweigungen zählt nur die längste Kette"; [BGG thread 1191485](https://boardgamegeek.com/thread/1191485)). The rulebook says only that branches do not count and each cloister counts once.
- **Ties for the win** go to the player with the most pieces left in their supply; players still tied share the win.
