"""Prepare MATRX GIPF's board captures for its cover: the board and its glow mask.

Usage: python3 -I matrx_board.py BOARD.png LINES.png OUTDIR

Crops both captures to the same box (the board capture's fixed frame, with the corner toggles
masked off, trimmed to what is left), then pads 80 px of transparent room above, so the
perspective step in cover.py does not clip the top dot. Writes board-pot-c-pad.png and
board-lines-c-pad.png in OUTDIR.
"""
import os
import sys

import numpy as np
from PIL import Image

# The capture's frame inside the harness screenshot (1400 px wide at DPR 3, VH 1400).
FRAME = (214, 271, 214 + 2738, 271 + 2312)
PAD = 80


def prep(path):
    im = Image.open(path).convert('RGBA').crop(FRAME)
    a = np.asarray(im).copy()
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    # The board toggles' corners: top right and bottom left.
    a[(yy < 0.12 * h) & (xx > 0.68 * w), 3] = 0
    a[(yy > 0.88 * h) & (xx < 0.22 * w), 3] = 0
    return Image.fromarray(a)


def padded(im):
    out = Image.new('RGBA', (im.width, im.height + PAD), (0, 0, 0, 0))
    out.paste(im, (0, PAD))
    return out


def main(board_path, lines_path, outdir):
    board = prep(board_path)
    box = board.getbbox()
    padded(board.crop(box)).save(os.path.join(outdir, 'board-pot-c-pad.png'))
    padded(prep(lines_path).crop(box)).save(os.path.join(outdir, 'board-lines-c-pad.png'))


if __name__ == '__main__':
    main(*sys.argv[1:4])
