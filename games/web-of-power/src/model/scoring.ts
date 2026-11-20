import * as Type from 'typebox'
import { Abbey, AbbeySchema, CountrySchema, roadNeighbours } from './map.js'

export type Award = Type.Static<typeof Award>
export const Award = Type.Object({
    playerId: Type.String(),
    points: Type.Integer({ minimum: 1 })
})

export type CountryAwards = Type.Static<typeof CountryAwards>
export const CountryAwards = Type.Object({
    country: CountrySchema,
    awards: Type.Array(Award)
})

export type AllianceAwards = Type.Static<typeof AllianceAwards>
export const AllianceAwards = Type.Object({
    // The number printed on the board, 1 to 15.
    alliance: Type.Integer({ minimum: 1, maximum: 15 }),
    awards: Type.Array(Award)
})

export type ChainAward = Type.Static<typeof ChainAward>
export const ChainAward = Type.Object({
    playerId: Type.String(),
    // The chain's cloisters in order along the road.
    abbeys: Type.Array(AbbeySchema, { minItems: 4 })
})

export const MIN_CHAIN = 4

// Cloister majorities in one country. The most cloisters scores one point for every cloister there;
// each later place scores the count of the place before it. Tied players share their place, and the
// next place follows them.
export function cloisterAwards(counts: ReadonlyMap<string, number>): Award[] {
    const present = [...counts.entries()].filter(([, count]) => count > 0)
    const total = present.reduce((sum, [, count]) => sum + count, 0)
    const levels = [...new Set(present.map(([, count]) => count))].sort((a, b) => b - a)
    return present
        .map(([playerId, count]) => {
            const place = levels.indexOf(count)
            return { playerId, points: place === 0 ? total : levels[place - 1] }
        })
        .sort((a, b) => b.points - a.points)
}

// The players with the most advisors in a country, none when it has none.
export function advisorLeaders(counts: ReadonlyMap<string, number>): string[] {
    const most = Math.max(0, ...counts.values())
    if (most === 0) return []
    return [...counts.entries()].filter(([, count]) => count === most).map(([id]) => id)
}

// The longest unbranched run of a player's cloisters along the roads in each connected group;
// whatever branches off it does not count (rules-interpretations: chains).
export function longestChains(abbeys: ReadonlySet<Abbey>): Abbey[][] {
    const chains: Abbey[][] = []
    const seen = new Set<Abbey>()
    for (const start of abbeys) {
        if (seen.has(start)) continue
        const group = connectedGroup(start, abbeys)
        for (const abbey of group) seen.add(abbey)
        const chain = longestPath(group)
        if (chain.length >= MIN_CHAIN) chains.push(chain)
    }
    return chains
}

function connectedGroup(start: Abbey, abbeys: ReadonlySet<Abbey>): Set<Abbey> {
    const group = new Set<Abbey>([start])
    const queue = [start]
    for (let abbey = queue.pop(); abbey !== undefined; abbey = queue.pop()) {
        for (const next of roadNeighbours(abbey)) {
            if (abbeys.has(next) && !group.has(next)) {
                group.add(next)
                queue.push(next)
            }
        }
    }
    return group
}

// A player holds at most 20 cloisters, so trying every simple path is quick.
function longestPath(group: ReadonlySet<Abbey>): Abbey[] {
    let best: Abbey[] = []
    const path: Abbey[] = []
    const onPath = new Set<Abbey>()
    const walk = (abbey: Abbey) => {
        path.push(abbey)
        onPath.add(abbey)
        if (path.length > best.length) best = [...path]
        for (const next of roadNeighbours(abbey)) {
            if (group.has(next) && !onPath.has(next)) walk(next)
        }
        path.pop()
        onPath.delete(abbey)
    }
    for (const start of group) walk(start)
    return best
}
