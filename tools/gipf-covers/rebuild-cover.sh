#!/bin/bash
# Rebuilds the LYNGK or MATRX GIPF cover (original GIPF project style) with the settings the user
# chose, so it can be redone whenever the pieces or board change. See README.md.
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
# Needs: the devcontainer (for the captures), python3 with numpy and Pillow, ImageMagick.
set -euo pipefail

GAME=${1:?lyngk or matrx}
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
    esac
}

# Builds the cover from the board inputs in a folder, into $WORK/GAME-cover.jpg.
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
    esac
    magick "$WORK/full.jpg" -filter Lanczos -resize 1200x -quality 90 "$WORK/$GAME-cover.jpg"
}

git -C "$ROOT" show "$GAME:games/$GAME-ui/src/lib/images/$GAME-cover.jpg" > "$WORK/committed.jpg"

if [ "$MODE" = check ]; then
    build "$SOURCES"
    printf 'RMSE against the committed cover: '
    magick compare -metric RMSE "$WORK/$GAME-cover.jpg" "$WORK/committed.jpg" null: 2>&1 || true
    echo
else
    capture
    build "$WORK"
    magick "$WORK/committed.jpg" "$WORK/$GAME-cover.jpg" +append -resize 1800x -quality 88 "$WORK/before-after.jpg"
    echo "Built $WORK/$GAME-cover.jpg and $WORK/before-after.jpg"
    case $GAME in
    lyngk) echo "After committing: cp $WORK/board-chain-t.png $SOURCES/" ;;
    matrx) echo "After committing: cp $WORK/{board-pot,board-lines,board-pot-c-pad,board-lines-c-pad}.png $SOURCES/" ;;
    esac
fi
