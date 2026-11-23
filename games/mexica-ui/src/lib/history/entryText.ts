import { cellName, PALACE_BONUS, tokenSize } from '@tabletop/mexica'
import type { Step, TurnEntry } from './historyEntries.js'

export type Segment = { kind: 'text'; text: string } | { kind: 'player'; playerId: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const player = (playerId: string): Segment => ({ kind: 'player', playerId })

const LEVEL_NAMES = ['', 'one-level', 'two-level', 'three-level', 'four-level']

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// Actions of one kind one after another read as one: "dug three canals (F1–F2, H1–I1, J3–J4)".
export function turnSegments(entry: TurnEntry): Segment[] {
    if (entry.steps.length === 0) return [text(entry.ended ? ' ended the turn' : ' is thinking')]
    const parts = stepGroups(entry.steps).map(groupSegments)
    return [
        text(' '),
        ...parts.flatMap((part, index) => (index === 0 ? part : [text(', '), ...part]))
    ]
}

// A turn's steps with each run of one kind together. Foundings stand alone: each scores on its
// own, with its visitors.
export function stepGroups(steps: readonly Step[]): Step[][] {
    const groups: Step[][] = []
    for (const step of steps) {
        const last = groups.at(-1)
        if (last !== undefined && last[0].kind === step.kind && step.kind !== 'found') {
            last.push(step)
        } else {
            groups.push([step])
        }
    }
    return groups
}

function groupSegments(group: Step[]): Segment[] {
    const [first] = group
    if (group.length === 1) return stepSegments(first)
    const many = `${COUNTS[group.length] ?? group.length}`
    const listed = (place: (step: Step) => string) => `(${group.map(place).join(', ')})`
    switch (first.kind) {
        case 'canal':
            return [text(`dug ${many} canals ${listed(canalPlace)}`)]
        case 'bridge':
            return [text(`built ${many} bridges ${listed(cellPlace)}`)]
        case 'moveBridge':
            return [text(`moved ${many} bridges ${listed(bridgeMovePlace)}`)]
        case 'temple': {
            const levels = new Set(group.map((step) => (step.kind === 'temple' ? step.level : 0)))
            return [
                text(
                    levels.size === 1
                        ? `built ${many} ${LEVEL_NAMES[first.level]} temples ${listed(cellPlace)}`
                        : `built ${many} temples ${listed(templePlace)}`
                )
            ]
        }
        case 'token':
            return [text(`took ${many} action tokens`)]
        default:
            return group.flatMap((step, index) =>
                index === 0 ? stepSegments(step) : [text(', '), ...stepSegments(step)]
            )
    }
}

const canalPlace = (step: Step) => (step.kind === 'canal' ? step.cells.map(cellName).join('–') : '')
const cellPlace = (step: Step) => ('cell' in step ? cellName(step.cell) : '')
const bridgeMovePlace = (step: Step) =>
    step.kind === 'moveBridge' ? `${cellName(step.from)} to ${cellName(step.to)}` : ''
const templePlace = (step: Step) =>
    step.kind === 'temple' ? `${LEVEL_NAMES[step.level]} at ${cellName(step.cell)}` : ''

// One action in words.
export function stepSegments(step: Step): Segment[] {
    switch (step.kind) {
        case 'start':
            return [text(`started at ${cellName(step.cell)}`)]
        case 'move':
            return [
                text(
                    `${step.teleport ? 'teleported' : 'moved'} to ${cellName(step.to)} (${step.cost} AP)`
                )
            ]
        case 'canal':
            return [text(`dug a canal at ${canalPlace(step)}`)]
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
                ...step.visitors.flatMap(({ playerId, points }) => [
                    text('; '),
                    player(playerId),
                    text(` +${points}`)
                ])
            ]
    }
}

export function palaceText(count: number): string {
    return `${count === 1 ? 'a Pilli Mexica' : `${count} Pilli Mexica`} in the palace, +${PALACE_BONUS} each`
}

const COUNTS = ['', 'a', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

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
