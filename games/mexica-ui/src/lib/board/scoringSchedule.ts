import {
    type Cell,
    columnOf,
    type DistrictScore,
    type HydratedMexicaGameState,
    rowOf
} from '@tabletop/mexica'

// A period's end scores its districts one after another, smallest first, so the board and the
// players' cards can keep time: each district's awards show `step` apart, all starting within
// `within`, and each rises over `duration` while the cards count its points in `count`. The
// palace bonus comes a step after the last district.
export const SCORING = { step: 0.55, within: 5, duration: 1.2, count: 0.4, rise: -12 }

// A district scored, the square it shows over (its token, or an unfounded district's middle
// square) and when it shows.
export type ScheduledDistrict = { score: DistrictScore; anchor: Cell; at: number }

export type ScoringSchedule = {
    districts: ScheduledDistrict[]
    // When the palace bonus shows, and when the last award has finished rising.
    palaceAt: number
    end: number
}

export function scoringSchedule(
    from: HydratedMexicaGameState,
    scores: readonly DistrictScore[]
): ScoringSchedule {
    const all = from.layout().districts()
    const anchored = scores.map((score) => {
        const founded = from.districts.find((district) => district.tokenId === score.tokenId)
        const cells = all.find((district) => district.includes(score.cell)) ?? [score.cell]
        const middle = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
        const row = middle(cells.map(rowOf))
        const column = middle(cells.map(columnOf))
        const distance = (cell: Cell) => Math.hypot(rowOf(cell) - row, columnOf(cell) - column)
        const anchor = founded?.cell ?? [...cells].sort((a, b) => distance(a) - distance(b))[0]
        return { score, anchor }
    })
    anchored.sort(
        (a, b) =>
            a.score.size - b.score.size ||
            rowOf(a.anchor) - rowOf(b.anchor) ||
            columnOf(a.anchor) - columnOf(b.anchor)
    )
    const step = Math.min(SCORING.step, SCORING.within / Math.max(anchored.length, 1))
    const districts = anchored.map((district, index) => ({ ...district, at: index * step }))
    const palaceAt = districts.length * step
    return { districts, palaceAt, end: palaceAt + SCORING.duration }
}
