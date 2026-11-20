export const PAVING_LOOK = 'paving'
export const LAKE_LOOK = 'lake'
export const CANAL_LOOK = 'canal'

export function templeLook(level: number, flat: boolean): string {
    return `temple-${level}${flat ? '-flat' : ''}`
}

// Stretches of bank wall, one cell long, taken in turn along the banks.
export const WALL_VARIANTS = 3

export function wallLook(variant: number): string {
    return `wall-${variant}`
}
