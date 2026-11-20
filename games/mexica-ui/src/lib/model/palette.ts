import { Color } from '@tabletop/common'

export type PlayerPaint = { fill: string; ink: string }

const LIGHT_INK = '#fbf7ee'
const DARK_INK = '#1f1a14'

// Earth and mineral pigments, which sit better on the stone and water than the site's colours.
export const PIGMENTS: Record<Color, PlayerPaint> = {
    [Color.Red]: { fill: '#a8322d', ink: LIGHT_INK },
    [Color.Orange]: { fill: '#c9672a', ink: LIGHT_INK },
    [Color.Yellow]: { fill: '#d9a62e', ink: DARK_INK },
    [Color.Green]: { fill: '#3a8a5f', ink: LIGHT_INK },
    [Color.Blue]: { fill: '#2f78a8', ink: LIGHT_INK },
    [Color.Purple]: { fill: '#6d4a8f', ink: LIGHT_INK },
    [Color.Pink]: { fill: '#c25b82', ink: LIGHT_INK },
    [Color.Brown]: { fill: '#7a5232', ink: LIGHT_INK },
    [Color.Gray]: { fill: '#77736c', ink: LIGHT_INK },
    [Color.Black]: { fill: '#2b2622', ink: LIGHT_INK },
    [Color.White]: { fill: '#efe9dc', ink: DARK_INK }
}
