// advisorRing is too slow to run as the board opens on a phone, so its spots are worked out ahead
// of time into advisorRings.ts; advisorSpots.spec.ts checks them and rewrites them with UPDATE=1.
import { Country, SPACES } from '@tabletop/web-of-power'
import { ARMS_FEATURES } from './armsFeatures.js'
import { advisorRing } from './pieces.js'
import { ADVISOR_RINGS } from './advisorRings.js'

export const ARMS_R = 52

const COUNTRIES = Object.values(Country)

// The emblem is drawn at 0.9 of the seal's radius.
function features(country: Country) {
    const scale = (ARMS_R * 0.9) / 50
    return ARMS_FEATURES[country].map(({ x, y, r, weight }) => ({
        x: x * scale,
        y: y * scale,
        r: r * scale,
        weight
    }))
}

export function mostAdvisors(country: Country): number {
    return SPACES.filter((space) => space.country === country).length
}

export function computeRing(country: Country, count: number): { x: number; y: number }[] {
    return advisorRing(count, 7919 * (COUNTRIES.indexOf(country) + 1), features(country), ARMS_R)
}

export function advisorSpots(country: Country, count: number): { x: number; y: number }[] {
    if (count === 0) return []
    return ADVISOR_RINGS[country]?.[count - 1] ?? computeRing(country, count)
}
