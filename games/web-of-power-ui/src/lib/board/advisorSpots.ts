// Where each advisor stands on its country's coat of arms. The spots come from advisorRing, a
// search that is too slow to run as the board opens on a phone, so they are worked out ahead of time
// for every count a country can hold (no more advisors than it has cloister spaces) and kept in
// advisorRings.ts; advisorSpots.spec.ts checks the table against advisorRing and rewrites it when
// run with UPDATE=1.
import { Country, SPACES } from '@tabletop/web-of-power'
import { ARMS_FEATURES } from './armsFeatures.js'
import { advisorRing } from './pieces.js'
import { ADVISOR_RINGS } from './advisorRings.js'

// Each coat of arms' radius: as large as the houses round the seals allow (Schwaben's rim runs
// under its neighbours' houses, its middle clear for the advisors). The seals were moved to fit by
// /workspace/tmp/web-of-power/map/arms_fit.py.
export const ARMS_R = 52

const COUNTRIES = Object.values(Country)

// Each emblem's key features in the seal's units (the emblem is drawn at 0.9 of its radius).
function features(country: Country) {
    const scale = (ARMS_R * 0.9) / 50
    return ARMS_FEATURES[country].map(({ x, y, r, weight }) => ({
        x: x * scale,
        y: y * scale,
        r: r * scale,
        weight
    }))
}

// The most advisors a country can hold: one per cloister space in it.
export function mostAdvisors(country: Country): number {
    return SPACES.filter((space) => space.country === country).length
}

// The spots worked out afresh (what the table holds).
export function computeRing(country: Country, count: number): { x: number; y: number }[] {
    return advisorRing(count, 7919 * (COUNTRIES.indexOf(country) + 1), features(country), ARMS_R)
}

export function advisorSpots(country: Country, count: number): { x: number; y: number }[] {
    if (count === 0) return []
    return ADVISOR_RINGS[country]?.[count - 1] ?? computeRing(country, count)
}
