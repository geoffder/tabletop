// The pieces as scripts/render-pieces.mjs drew them: each outline, filled with the player's
// colour, the box its light image covers, and the circle round it for a choice ring, in map
// units with the piece's foot at the origin. Generated; rerun pnpm run render-pieces.

export type PieceSprite = {
    outline: string
    light: { x: number; y: number; width: number; height: number }
    ring: { x: number; y: number; r: number }
}

export const HOUSE_SPRITE: PieceSprite = {
    outline:
        'M8.27 -43.67 L8.80 -43.60 L9.47 -43.27 L24.93 -27.80 L25.13 -27.40 L25.20 -7.80 L24.93 -7.13 L24.13 -6.33 L17.20 -1.00 L16.27 -0.53 L-15.13 -0.53 L-15.73 -0.80 L-16.13 -1.20 L-16.40 -1.93 L-16.40 -20.93 L-16.13 -21.73 L-0.27 -37.67 L6.93 -43.20 L7.53 -43.53 L8.27 -43.60 Z',
    light: { x: -24, y: -52, width: 60, height: 66 },
    ring: { x: 4.4, y: -22.1, r: 29.0 }
}

export const PEG_SPRITE: PieceSprite = {
    outline:
        'M-1.27 -24.47 L2.47 -24.33 L5.20 -23.60 L6.53 -22.87 L7.33 -22.13 L7.73 -21.53 L8.00 -20.73 L8.00 -0.87 L7.53 0.27 L6.53 1.27 L5.33 1.93 L2.40 2.73 L-1.20 2.87 L-2.80 2.67 L-4.67 2.20 L-6.00 1.60 L-6.87 1.00 L-7.53 0.27 L-8.00 -0.87 L-8.00 -20.73 L-7.73 -21.53 L-7.33 -22.13 L-6.13 -23.13 L-4.27 -23.93 L-2.47 -24.33 L-1.27 -24.40 Z',
    light: { x: -13, y: -29, width: 31, height: 39 },
    ring: { x: 0.0, y: -10.8, r: 14.8 }
}
