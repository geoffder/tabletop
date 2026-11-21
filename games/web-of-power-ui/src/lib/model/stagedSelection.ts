import {
    clearStagedSelectionAtOrAfter,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { CardColor } from '@tabletop/web-of-power'

export type WebOfPowerSelectionValues = {
    card: CardColor
    joker: CardColor
}

export type WebOfPowerSelection = StagedSelectionState<WebOfPowerSelectionValues>

export const WebOfPowerStageOrder = [
    'card',
    'joker'
] as const satisfies readonly (keyof WebOfPowerSelectionValues)[]

type MissingStages = Exclude<keyof WebOfPowerSelectionValues, (typeof WebOfPowerStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setWebOfPowerSelection<TStage extends keyof WebOfPowerSelectionValues>(
    selection: WebOfPowerSelection,
    stage: TStage,
    value: WebOfPowerSelectionValues[TStage] | undefined
): WebOfPowerSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<WebOfPowerSelectionValues, TStage>(
              selection,
              WebOfPowerStageOrder,
              stage
          )
        : setStagedSelectionValue<WebOfPowerSelectionValues, TStage>(
              selection,
              WebOfPowerStageOrder,
              stage,
              value,
              'manual'
          )
}
