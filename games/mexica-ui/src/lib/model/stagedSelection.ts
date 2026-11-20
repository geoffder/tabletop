import {
    clearStagedSelectionAtOrAfter,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { Cell, Level } from '@tabletop/mexica'

// What the player picked up: a temple of a level, a canal tile, a bridge, the founding token, or
// a built bridge to move.
export type Tool = Level | 'canal' | 'bridge' | 'found' | 'moveBridge'

// The tool, then the first space chosen for it: a canal's first cell, a bridge's canal cell or
// the bridge to move; then where a moved bridge goes, while its direction is chosen.
export type MexicaSelectionValues = {
    tool: Tool
    cell: Cell
    destination: Cell
}

export type MexicaSelection = StagedSelectionState<MexicaSelectionValues>

export const MexicaStageOrder = [
    'tool',
    'cell',
    'destination'
] as const satisfies readonly (keyof MexicaSelectionValues)[]

type MissingStages = Exclude<keyof MexicaSelectionValues, (typeof MexicaStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setMexicaSelection<TStage extends keyof MexicaSelectionValues>(
    selection: MexicaSelection,
    stage: TStage,
    value: MexicaSelectionValues[TStage] | undefined
): MexicaSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<MexicaSelectionValues, TStage>(
              selection,
              MexicaStageOrder,
              stage
          )
        : setStagedSelectionValue<MexicaSelectionValues, TStage>(
              selection,
              MexicaStageOrder,
              stage,
              value,
              'manual'
          )
}
