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

// The districts the Emperor withdrew, and what that means for founding them: one size as "two
// 4-space districts", mixed sizes counted first, "four districts, of 3, 4, 4 and 8 spaces".
export function withdrawnText(sizes: readonly number[]): string {
    const sorted = [...sizes].sort((a, b) => a - b)
    const many = sorted.length > 1
    const howMany = many ? (COUNTS[sorted.length] ?? String(sorted.length)) : ''
    const listed = sorted.every((size) => size === sorted[0])
        ? many
            ? `${howMany} ${sorted[0]}-space districts`
            : `${[8, 11, 18].includes(sorted[0]) ? 'an' : 'a'} ${sorted[0]}-space district`
        : `${howMany} districts, of ${sorted.slice(0, -1).join(', ')} and ${sorted.at(-1)} spaces`
    const fate = !many
        ? 'it can no longer be founded'
        : sorted.length === 2
          ? 'neither can be founded'
          : 'none can be founded'
    return `The Emperor withdrew ${listed}: ${fate}`
}
