import { cellName, PALACE_BONUS, tokenSize } from '@tabletop/mexica'
import type { Step, TurnEntry } from './historyEntries.js'

export type Segment = { kind: 'text'; text: string } | { kind: 'player'; playerId: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const player = (playerId: string): Segment => ({ kind: 'player', playerId })

const LEVEL_NAMES = ['', 'one-level', 'two-level', 'three-level', 'four-level']

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function turnSegments(entry: TurnEntry, brief = false): Segment[] {
    if (entry.steps.length === 0) return [text(entry.ended ? ' ended the turn' : ' is thinking')]
    const steps = brief ? [entry.steps.at(-1)].filter((step) => step !== undefined) : entry.steps
    const parts = steps.map((step) => stepSegments(step, brief))
    const more = brief && entry.steps.length > 1 ? [text(` (${entry.steps.length} actions)`)] : []
    return [
        text(' '),
        ...parts.flatMap((part, index) => (index === 0 ? part : [text(', '), ...part])),
        ...more
    ]
}

function stepSegments(step: Step, brief: boolean): Segment[] {
    switch (step.kind) {
        case 'start':
            return [text(`started at ${cellName(step.cell)}`)]
        case 'move':
            return [
                text(
                    `${step.teleport ? 'teleported' : 'moved'} to ${cellName(step.to)}${brief ? '' : ` (${step.cost} AP)`}`
                )
            ]
        case 'canal':
            return [text(`dug a canal at ${step.cells.map(cellName).join('–')}`)]
        case 'bridge':
            return [text(`built a bridge at ${cellName(step.cell)}`)]
        case 'moveBridge':
            return [text(`moved a bridge from ${cellName(step.from)} to ${cellName(step.to)}`)]
        case 'temple':
            return [text(`built a ${LEVEL_NAMES[step.level]} temple at ${cellName(step.cell)}`)]
        case 'token':
            return [text('took an action token')]
        case 'found':
            return [
                text(
                    `founded a ${tokenSize(step.tokenId)}-space district at ${cellName(step.cell)} (+${step.points})`
                ),
                ...(brief
                    ? []
                    : step.visitors.flatMap(({ playerId, points }) => [
                          text('; '),
                          player(playerId),
                          text(` +${points}`)
                      ]))
            ]
    }
}

export function palaceText(count: number): string {
    return `${count === 1 ? 'a Pilli Mexica' : `${count} Pilli Mexica`} in the palace, +${PALACE_BONUS} each`
}

const COUNTS = ['', 'a', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

// The districts the Emperor withdrew, by size and how many of each: "two 4-space districts",
// "an 8-space district and a 10-space district", and what that means for founding them.
export function withdrawnText(sizes: readonly number[]): string {
    const counts = new Map<number, number>()
    for (const size of [...sizes].sort((a, b) => a - b)) {
        counts.set(size, (counts.get(size) ?? 0) + 1)
    }
    const groups = [...counts].map(([size, count]) => {
        const many = count > 1
        const number = many
            ? (COUNTS[count] ?? String(count))
            : /^(8|11|18)$/.test(String(size))
              ? 'an'
              : 'a'
        return `${number} ${size}-space ${many ? 'districts' : 'district'}`
    })
    const listed =
        groups.length === 1
            ? groups[0]
            : `${groups.slice(0, -1).join(', ')} and ${groups[groups.length - 1]}`
    const fate =
        sizes.length === 1
            ? 'it can no longer be founded'
            : sizes.length === 2
              ? 'neither can be founded'
              : 'none can be founded'
    return `The Emperor withdrew ${listed}: ${fate}`
}
