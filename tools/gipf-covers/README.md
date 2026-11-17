# GIPF project covers

Rebuilds the covers drawn in the style of the original Don & Co GIPF project boxes for the titles
that never had one: LYNGK and MATRX GIPF, each a rendered landscape seen through a frosted window,
the game's own board captured from its harness and set in perspective, title discs, and the GIPF
project logo; and GIPF with Potentials, the 1996 GIPF box lettered "with potentials" with five of
the game's own potentials scattered over it. The other GIPF project titles use their original box
art; TZAAR's scan lacks the logo the other boxes carry, so it is added here too.

Rebuild a cover whenever the pieces or the board change, so the cover shows them as they are:
GIPF with Potentials whenever MATRX GIPF's pieces change, since its potentials are drawn the same.

## Rebuilding

```sh
# Is the recipe intact? Builds from the archived captures; RMSE 0 against the committed cover.
tools/gipf-covers/rebuild-cover.sh lyngk check
tools/gipf-covers/rebuild-cover.sh matrx check

# New cover from the game as it is now. Start the game's harness on port 5174 first, from a
# checkout with the game as it is now: `pnpm exec vite dev --port 5174 --strictPort` in games/GAME-ui.
PORT=5174 tools/gipf-covers/rebuild-cover.sh lyngk

# GIPF with Potentials needs no harness: it takes its own committed looks, or
# MATRX GIPF's with LOOKS_GAME=matrx (same file names) to see a MATRX piece change on it first.
# Covers and looks are read from upstream/main; COVER_REF and LOOKS_REF name another ref.
tools/gipf-covers/rebuild-cover.sh gipf-potentials check
tools/gipf-covers/rebuild-cover.sh gipf-potentials

# TZAAR: the box scan in sources/tzaar with the logo added.
tools/gipf-covers/rebuild-cover.sh tzaar check
```

The rebuild writes `tmp/gipf-covers/rebuild/GAME/GAME-cover.webp` and `before-after.jpg` beside
it, and commits nothing. The cover is composed as a 1200 px JPEG, then encoded by `webp.py` as a
lossy WebP 680 px high, twice the large catalog card's height: the readiness review fails a JPEG
cover and one far above that size. Commit it on a branch off upstream `main` as
`games/GAME-ui/src/lib/images/GAME-cover.webp`, then copy the new captures into `sources/GAME`
(the script prints the command) and commit them here, so `check` matches again once that branch
merges (until then, `COVER_REF=origin/<branch>`). Commit no other
version of a cover; an image nothing imports fails the review too.

Needs the devcontainer (for the captures), python3 with numpy and Pillow, and ImageMagick.

## The recipes

The settings in `rebuild-cover.sh` are the ones the user chose; change them only when asked.

- **LYNGK:** a storm over the mountains, lit by lightning, with a bolt jumping peak to peak. The
  board is the Lyngk chain scenario with black claimed and E7 picked, so its LYNGK bolts show,
  lit by the storm and with cyan spill round its own bolts. Title discs in the five piece colours.
- **MATRX GIPF:** the GIPF mountains as a green wireframe construct with falling code. The board is
  the Potentials scenario with every ring, mark and arrow hidden, lit a soft green, with a green
  underglow under its push lines and dots from a second, lines-only capture. Its captures are
  cropped to a fixed frame with the board toggles' corners masked (`matrx_board.py`), and padded
  above so the perspective step does not clip the top dot. Title on two rows: black MATRX, blue
  GIPF discs.
- **GIPF with Potentials:** `sources/gipf-potentials/base.png` is the 1996 black GIPF box with
  "with potentials" centred under the title on a dark glow (lettering cut from the MATRX GIPF box,
  its "w" from Courgette; made once, it does not depend on the pieces). `pieces.txt` places
  light ZÈRTZ, dark DVONN, light TAMSK, dark YINSH (turned) and light PÜNCT with drop shadows,
  as on the GIPF Project Set boxes. The cover is cropped to about 4:3, as the original boxes are,
  and given the logo.
- **Logo:** the user's clean copy of the GIPF project logo (`assets/gipf-project-logo-source.jpg`,
  black "project" on white), cut by `cut_logo.py` into a discs layer and an ink layer, then drawn
  by `logo.py` as the original boxes print it: rims tinted dark navy, "project" in white, a
  little larger and tucked up under the discs, over a blue swoosh (a fine point under the G
  arcing up and thickening to a rounded end past the F), all with a tight dark shadow (between
  ZÈRTZ's tightest and YINSH's softest). `stamp` places it as on the boxes: 18% of the cover's
  width, 3% in from the right and 2.5% up from the bottom; `logo.py --stamp` adds it to a
  finished cover.

## Files

- `rebuild-cover.sh`: the recipes, and `check`.
- `boardshot.mjs`: screenshots a board alone from the harness, transparent, without labels or marks.
- `matrx_board.py`: crops and pads MATRX GIPF's two captures.
- `pieces.py`: scatters the potentials over the GIPF with Potentials base.
- `cover.py`: composes the cover: scene, board in perspective with its lighting, frosted window,
  title discs and logo. Its options are environment variables, documented where it reads them.
- `scene.py`: renders a landscape. The archived scenes are
  `scene.py OUT.png storm 1600 1180 0.14 80 7` (LYNGK) and
  `scene.py OUT.png construct 1600 1180 0.14 105 20` (MATRX GIPF); both re-render identically.
- `disc.py`: the title discs. `cut_logo.py`, `logo.py`: the GIPF project logo.
- `assets/`: EB Garamond (SIL Open Font License) for the disc letters, and the logo's source and
  cut layers.
- `sources/`: the scenes and the board captures the committed covers were built from.
