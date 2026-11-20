export const PAVING_LOOK = 'paving'
export const LAKE_LOOK = 'lake'
export const CANAL_LOOK = 'canal'
export const SHORE_LOOK = 'shore'

export function templeLook(level: number, flat: boolean): string {
    return `temple-${level}${flat ? '-flat' : ''}`
}
