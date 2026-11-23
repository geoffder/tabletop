import {
    clearStagedSelectionAtOrAfter,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    type Cell,
    isBuildBridge,
    isBuildTemple,
    isDigCanal,
    isFoundDistrict,
    isMoveBridge,
    type Level
} from '@tabletop/mexica'

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

// The canal tool picked again after a dig: Undo passes it by and takes back the dig.
export function keptCanal(): MexicaSelection {
    return setStagedSelectionValue<MexicaSelectionValues, 'tool'>(
        {},
        MexicaStageOrder,
        'tool',
        'canal',
        'auto'
    )
}

// The tool an action was taken with, picked again once it is undone; none for a move of the
// Pilli Mexica, which needs no tool, or an action without a board choice.
export function toolOf(action: GameAction): Tool | undefined {
    if (isDigCanal(action)) return 'canal'
    if (isBuildBridge(action)) return 'bridge'
    if (isMoveBridge(action)) return 'moveBridge'
    if (isBuildTemple(action)) return action.level
    if (isFoundDistrict(action)) return 'found'
    return undefined
}
