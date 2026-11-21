import { undoableStagedSelection } from '@tabletop/frontend-components'
import { describe, expect, it } from 'vitest'
import {
    keptCanal,
    type MexicaSelection,
    MexicaStageOrder,
    setMexicaSelection
} from './stagedSelection.js'

function undoable(start: MexicaSelection) {
    let selection = start
    const local = undoableStagedSelection(
        MexicaStageOrder,
        () => selection,
        (next) => (selection = next)
    )
    return { local, read: () => selection }
}

describe('the canal tool kept after a dig', () => {
    it('is picked', () => {
        expect(keptCanal().tool?.value).toBe('canal')
    })

    it('is passed by on Undo, which takes back the dig instead', () => {
        const { local, read } = undoable(keptCanal())
        expect(local.hasManual()).toBe(false)
        expect(local.undo()).toBe(false)
        expect(read().tool?.value).toBe('canal')
    })

    it('takes a first square that Undo lets go of alone', () => {
        const { local, read } = undoable(setMexicaSelection(keptCanal(), 'cell', 5))
        expect(local.undo()).toBe(true)
        expect(read().cell).toBeUndefined()
        expect(read().tool?.value).toBe('canal')
    })
})

describe('letting go of the canal’s first square', () => {
    it('keeps the tool', () => {
        const picked = setMexicaSelection(setMexicaSelection({}, 'tool', 'canal'), 'cell', 5)
        const next = setMexicaSelection(picked, 'cell', undefined)
        expect(next.cell).toBeUndefined()
        expect(next.tool?.value).toBe('canal')
    })
})
