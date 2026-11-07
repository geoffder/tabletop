#!/bin/bash
# Rebuilds the LYNGK, MATRX GIPF or GIPF with Potentials cover (original GIPF project style) with
# the settings the user chose, so it can be redone whenever the pieces or board change. See
# README.md.
#
#   rebuild-cover.sh GAME check
#       Builds from the archived captures in sources/GAME and compares the result with the cover
#       committed on the GAME branch. RMSE 0 means the recipe still holds.
#
#   PORT=5174 rebuild-cover.sh GAME
#       Captures the board again from GAME's harness running on PORT (start it from a GAME
#       checkout: `pnpm exec vite dev --port 5174 --strictPort` in games/GAME-ui), builds the cover
#       into tmp/gipf-covers/rebuild/GAME/GAME-cover.jpg (1200 px, ready to commit as
#       games/GAME-ui/src/lib/images/GAME-cover.jpg) and writes before-after.jpg beside it.
#       After committing it, copy the new captures over the archived ones in sources/GAME (the
#       script prints the command) and commit those here, so `check` matches again.
#
#   [LOOKS_BRANCH=matrx] rebuild-cover.sh gipf-potentials
#       No harness: takes the potentials' looks as committed on the gipf-potentials branch (or on
#       LOOKS_BRANCH: MATRX GIPF's looks have the same names, so a MATRX piece change can be seen
#       on the cover before it reaches gipf-potentials) and builds both the cover and its
#       uncropped -wide version.
#
# Needs: the devcontainer (for the captures), python3 with numpy and Pillow, ImageMagick.
set -euo pipefail

GAME=${1:?lyngk, matrx or gipf-potentials}
MODE=${2:-capture}
S=$(cd "$(dirname "$0")" && pwd)
# The main checkout, mounted in the devcontainer as /workspace; this folder may be in a worktree
# inside it.
ROOT=$(dirname "$(git -C "$S" rev-parse --path-format=absolute --git-common-dir)")
IN_CONTAINER_S=/workspace${S#"$ROOT"}
SOURCES=$S/sources/$GAME
WORK=$ROOT/tmp/gipf-covers/rebuild/$GAME
IN_CONTAINER_WORK=/workspace/tmp/gipf-covers/rebuild/$GAME
PORT=${PORT:-5174}
LOOKS_BRANCH=${LOOKS_BRANCH:-gipf-potentials}
# The covers built, by file name: GIPF with Potentials keeps its uncropped version beside it.
COVERS=("$GAME-cover")
[ "$GAME" = gipf-potentials ] && COVERS+=("$GAME-cover-wide")
mkdir -p "$WORK"

# Runs a command in the devcontainer, failing if it fails; its log lines are left out.
in_container() {
    local out
    out=$(devcontainer exec --workspace-folder "$ROOT" bash -lc "cd /workspace && $*" 2>&1) || {
        echo "$out"
        return 1
    }
    echo "$out" | grep -v '^\[[0-9-]*T[0-9:.]*Z\]' || true
}

# Captures the board into $WORK and leaves the cover's board inputs there.
capture() {
    case $GAME in
    lyngk)
        # Lyngk chain scenario, black claimed and E7 picked, so the LYNGK bolts show.
        in_container "PORT=$PORT VH=1800 BOLT=1.8 node $IN_CONTAINER_S/boardshot.mjs $IN_CONTAINER_WORK/board-chain.png 'Lyngk chain' 1400 3 '[title=\"Claim black\"]' '[aria-label=\"move E7\"]'"
        magick "$WORK/board-chain.png" -trim +repage "$WORK/board-chain-t.png"
        ;;
    matrx)
        # Potentials scenario with every ring, mark, arrow and the table grid hidden; then the
        # same with only the push lines and dots left, for the green underglow.
        local hide='.matrx-board > rect.fine, .matrx-board .dot-hit, .matrx-board .toggle-ring, .matrx-board .mark-spot, .matrx-board .arrow, .matrx-board .reserve-dot, .matrx-board .dot-ring, .matrx-board .top-ring, .matrx-board .target-ring'
        in_container "PORT=$PORT BOARD=.matrx-board VH=1400 HIDE='$hide' node $IN_CONTAINER_S/boardshot.mjs $IN_CONTAINER_WORK/board-pot.png 'Potentials' 1400 3"
        in_container "PORT=$PORT BOARD=.matrx-board VH=1400 HIDE='$hide, .matrx-board .play-area, .matrx-board .stack, .matrx-board polygon.fine, .matrx-board .flier' node $IN_CONTAINER_S/boardshot.mjs $IN_CONTAINER_WORK/board-lines.png 'Potentials' 1400 3"
        python3 -I "$S/matrx_board.py" "$WORK/board-pot.png" "$WORK/board-lines.png" "$WORK"
        ;;
    gipf-potentials)
        # The looks each piece in pieces.txt is drawn from, as committed on the branch.
        mkdir -p "$WORK/looks"
        grep -v '^#' "$SOURCES/pieces.txt" | awk 'NF { print $1 }' | while read -r look; do
            git -C "$ROOT" show "$LOOKS_BRANCH:games/$LOOKS_BRANCH-ui/src/lib/images/$look" > "$WORK/$look"
        done
        ;;
    esac
}

# Builds the covers from the board inputs (or looks) in a folder, into $WORK.
build() {
    local from=$1
    case $GAME in
    lyngk)
        (cd "$WORK" && WINDOW_REL=0.20,0.06 SKY_FLASH='0.163,0.405;0.757,0.35@0.45' KEEP_BOLTS=1 \
            BOLT_SPILL=0.40 GLOW_BACK=0.0 BOARD_TINT=0 BOARD_LIGHT=0.66,0.71,0.84 \
            BOARD_GLOW=0.45,0.75,1.0,0.22 \
            python3 -I "$S/cover.py" full.jpg "$SOURCES/scene-storm7c.png" "$from/board-chain-t.png" \
            '#1d4fa6,#b3212b,#17804a,#ddd3b4,#1b1b1d' 0.74 0.71 0.30 0.82)
        ;;
    matrx)
        (cd "$WORK" && GLOW_MASK="$from/board-lines-c-pad.png" GLOW_COL=0.25,1.0,0.45,0.7 \
            WINDOW_REL=0.20,0.06 TITLE='MATRX/GIPF' BOARD_TINT=0 BOARD_LIGHT=0.80,0.94,0.84 \
            BOARD_GLOW=0.15,1.0,0.40,0.09 \
            python3 -I "$S/cover.py" full.jpg "$SOURCES/scene-construct-20h.png" "$from/board-pot-c-pad.png" \
            '#1c1c1e/#2f63b0' 0.86 0.716 0.30 0.82)
        ;;
    gipf-potentials)
        # The 1996 GIPF box with "with potentials" lettered on (base.png), the five potentials
        # scattered over it; the cover is cropped to about 4:3, as the original boxes are.
        (cd "$from" && python3 -I "$S/pieces.py" "$SOURCES/base.png" "$WORK/full.jpg" < "$SOURCES/pieces.txt")
        # Cropped to a JPEG of its own first, as the committed cover was.
        magick "$WORK/full.jpg" -crop 1224x900+187+0 +repage "$WORK/full-43.jpg"
        magick "$WORK/full-43.jpg" -filter Lanczos -resize '1200x1200>' \
            -strip -quality 88 -sampling-factor 4:2:0 "$WORK/$GAME-cover.jpg"
        magick "$WORK/full.jpg" -colorspace sRGB -alpha off -filter Lanczos -resize '1200x1200>' \
            -strip -quality 88 -sampling-factor 4:2:0 "$WORK/$GAME-cover-wide.jpg"
        return
        ;;
    esac
    magick "$WORK/full.jpg" -filter Lanczos -resize 1200x -quality 90 "$WORK/$GAME-cover.jpg"
}

for cover in "${COVERS[@]}"; do
    git -C "$ROOT" show "$GAME:games/$GAME-ui/src/lib/images/$cover.jpg" > "$WORK/committed-$cover.jpg"
done

if [ "$MODE" = check ]; then
    build "$SOURCES"
    for cover in "${COVERS[@]}"; do
        printf 'RMSE of %s against the committed one: ' "$cover"
        magick compare -metric RMSE "$WORK/$cover.jpg" "$WORK/committed-$cover.jpg" null: 2>&1 || true
        echo
    done
else
    capture
    build "$WORK"
    magick "$WORK/committed-$GAME-cover.jpg" "$WORK/$GAME-cover.jpg" +append -resize 1800x -quality 88 "$WORK/before-after.jpg"
    echo "Built ${COVERS[*]/#/$WORK/} (.jpg) and $WORK/before-after.jpg"
    case $GAME in
    lyngk) echo "After committing: cp $WORK/board-chain-t.png $SOURCES/" ;;
    matrx) echo "After committing: cp $WORK/{board-pot,board-lines,board-pot-c-pad,board-lines-c-pad}.png $SOURCES/" ;;
    gipf-potentials) echo "After committing: cp $WORK/looks/*.webp $SOURCES/looks/" ;;
    esac
fi
