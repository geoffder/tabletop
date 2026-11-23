// A Pilli Mexica's proportions, on their own so that the board can take the figure's height
// from them without importing how the figure is drawn.

// What the figure takes up as drawn, in its own units, with its headdress at its first scale:
// half its width and depth, and its height.
export const EXTENT = { half: 9.6, depth: 9.5, height: 31.5 }
// The back row of feathers: half as wide, and how much higher its top reaches for each step
// the headdress is scaled up from its foot.
export const HEADDRESS = { half: 7.8, rise: 11.2 }
// The head, with its hood, mask and feathers, grows round the neck's foot, which stands on the
// robe.
export const NECK_FOOT = 17.6

// The figure's height and width as multiples of it as drawn, tall enough to show behind a temple
// and slim enough to stand between a bridge's curbs; its headdress's scale; and the head's scale
// and the robe's height under it. A big head reads from across the table; the robe keeps its
// width to stand square on a bridge. Rerun scripts/render-looks.mjs after changing any of them;
// the board's height for the figure, and the animations over its head, follow by themselves.
export type PilliProportions = {
    height: number
    width: number
    headdress: number
    head: number
    robe: number
}
export const PILLI: PilliProportions = {
    height: 1.61,
    width: 1.242,
    headdress: 1.2,
    head: 1.3,
    robe: 0.9
}

// To the top of the headdress, in board units.
export function pilliHeight(proportions = PILLI): number {
    const top = EXTENT.height + HEADDRESS.rise * (proportions.headdress - 1)
    const neck = NECK_FOOT * proportions.robe
    return (neck + (top - NECK_FOOT) * proportions.head) * proportions.height
}
