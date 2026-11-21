import { reportGameProgress, type GameProgress } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { MachineState } from './states.js'
import { WebOfPowerRuntime } from './runtime.js'
import { createGame, execute, legalActions, startGame } from './tests/playthrough.js'

function progressThroughGame(players: string[], seed: number) {
    const game = createGame({}, players)
    let state = startGame(game)
    const reports: GameProgress[] = [reportGameProgress(WebOfPowerRuntime, state)!]
    let value = seed + 1
    while (state.machineState !== MachineState.EndOfGame) {
        const actions = legalActions(game, state)
        value = (value * 1103515245 + 12345) % 2147483648
        state = execute(game, state, actions[value % actions.length]).updatedState
        const report = reportGameProgress(WebOfPowerRuntime, state)
        expect(report).toBeDefined()
        reports.push(report!)
    }
    return reports
}

describe('Game Progress', () => {
    it('starts at nothing played, with the first deck all left', () => {
        const [start] = progressThroughGame(['anna', 'barbara', 'chris', 'dan'], 1)
        expect(start).toEqual({ fraction: 0, label: 'First pass · 36 cards left' })
    })

    it.each([
        [['anna', 'barbara', 'chris'], 3],
        [['anna', 'barbara', 'chris', 'dan'], 7],
        [['anna', 'barbara', 'chris', 'dan', 'eve'], 11]
    ])('runs through both passes to the last round without going back (%j)', (players, seed) => {
        const reports = progressThroughGame(players, seed)
        for (let i = 1; i < reports.length; i++) {
            expect(reports[i].fraction).toBeGreaterThanOrEqual(reports[i - 1].fraction)
        }
        const passes = [...new Set(reports.map((report) => report.label.split(' · ')[0]))]
        expect(passes).toEqual(['First pass', 'Second pass', 'Last round'])
        expect(reports.filter((report) => report.final).map((report) => report.label)).toEqual(
            reports.filter((report) => report.label === 'Last round').map(() => 'Last round')
        )
        const secondStart = reports.find((report) => report.label.startsWith('Second pass'))!
        expect(secondStart.fraction).toBeCloseTo(0.475, 1)
        expect(reports.at(-1)).toEqual({ fraction: 0.95, label: 'Last round', final: true })
    })
})
