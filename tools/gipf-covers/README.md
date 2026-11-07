# GIPF project covers

Rebuilds the covers drawn in the style of the original Don & Co GIPF project boxes for the titles
that never had one: LYNGK and MATRX GIPF (the other GIPF project titles use their original box art).
Each cover is a rendered landscape seen through a frosted window, the game's own board captured
from its harness and set in perspective, title discs, and the GIPF project logo.

Rebuild a cover whenever the pieces or the board change, so the cover shows them as they are.

## Rebuilding

```sh
# Is the recipe intact? Builds from the archived captures; RMSE 0 against the committed cover.
tools/gipf-covers/rebuild-cover.sh lyngk check
tools/gipf-covers/rebuild-cover.sh matrx check

# New cover from the game as it is now. Start the game's harness on port 5174 first, from a
# checkout of its branch: `pnpm exec vite dev --port 5174 --strictPort` in games/GAME-ui.
PORT=5174 tools/gipf-covers/rebuild-cover.sh lyngk
```

The rebuild writes `tmp/gipf-covers/rebuild/GAME/GAME-cover.jpg` (1200 px wide) and
`before-after.jpg` beside it, and commits nothing. Commit the cover on the game's branch as
`games/GAME-ui/src/lib/images/GAME-cover.jpg`, then copy the new captures into `sources/GAME`
(the script prints the command) and commit them here, so `check` matches again.

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

## Files

- `rebuild-cover.sh`: the recipes, and `check`.
- `boardshot.mjs`: screenshots a board alone from the harness, transparent, without labels or marks.
- `matrx_board.py`: crops and pads MATRX GIPF's two captures.
- `cover.py`: composes the cover: scene, board in perspective with its lighting, frosted window,
  title discs and logo. Its options are environment variables, documented where it reads them.
- `scene.py`: renders a landscape. The archived scenes are
  `scene.py OUT.png storm 1600 1180 0.14 80 7` (LYNGK) and
  `scene.py OUT.png construct 1600 1180 0.14 105 20` (MATRX GIPF); both re-render identically.
- `disc.py`, `logo.py`: the title discs and the GIPF project logo.
- `assets/`: EB Garamond (SIL Open Font License) for the disc letters, and the logo's "project"
  script.
- `sources/`: the scenes and the board captures the committed covers were built from.
