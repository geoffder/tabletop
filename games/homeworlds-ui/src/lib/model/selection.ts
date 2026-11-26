import {
    getStagedSelectionValue,
    pushStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { PieceKind, PyramidColor } from '@tabletop/homeworlds'

// What a chosen ship may do: travel (yellow), build (green), trade (blue), capture (red) or be
// sacrificed.
export enum ShipPower {
    Travel = 'travel',
    Build = 'build',
    Trade = 'trade',
    Capture = 'capture',
    Sacrifice = 'sacrifice'
}

// A turn's choice: a ship of one's own, then what it does; the target commits the action.
export type TurnSelectionValues = {
    ship: number
    power: ShipPower
}

export type TurnSelection = StagedSelectionState<TurnSelectionValues>

export const TurnStageOrder = [
    'ship',
    'power'
] as const satisfies readonly (keyof TurnSelectionValues)[]
type MissingTurnStages = Exclude<keyof TurnSelectionValues, (typeof TurnStageOrder)[number]>
const turnStageCoverage: MissingTurnStages extends never ? true : never = true
void turnStageCoverage

export function chosenShip(selection: TurnSelection): number | undefined {
    return getStagedSelectionValue<TurnSelectionValues, 'ship'>(selection, 'ship')
}

export function chosenPower(selection: TurnSelection): ShipPower | undefined {
    return getStagedSelectionValue<TurnSelectionValues, 'power'>(selection, 'power')
}

export function withShip(selection: TurnSelection, ship: number): TurnSelection {
    return setStagedSelectionValue(selection, TurnStageOrder, 'ship', ship, 'manual')
}

export function withPower(
    selection: TurnSelection,
    power: ShipPower,
    source: StagedSelectionSource
): TurnSelection {
    return setStagedSelectionValue(selection, TurnStageOrder, 'power', power, source)
}

// A homeworld built from the Bank: each star tapped in turn, then the Large ship's colour.
export type HomeworldSelectionValues = {
    stars: PieceKind[]
    shipColor: PyramidColor
}

export type HomeworldSelection = StagedSelectionState<HomeworldSelectionValues>

export const HomeworldStageOrder = [
    'stars',
    'shipColor'
] as const satisfies readonly (keyof HomeworldSelectionValues)[]
type MissingHomeworldStages = Exclude<
    keyof HomeworldSelectionValues,
    (typeof HomeworldStageOrder)[number]
>
const homeworldStageCoverage: MissingHomeworldStages extends never ? true : never = true
void homeworldStageCoverage

export function chosenStars(selection: HomeworldSelection): PieceKind[] {
    return getStagedSelectionValue<HomeworldSelectionValues, 'stars'>(selection, 'stars') ?? []
}

export function chosenShipColor(selection: HomeworldSelection): PyramidColor | undefined {
    return getStagedSelectionValue<HomeworldSelectionValues, 'shipColor'>(selection, 'shipColor')
}

// Each star is its own press, so Undo takes back the latest.
export function withStar(selection: HomeworldSelection, star: PieceKind): HomeworldSelection {
    return pushStagedSelectionValue(selection, HomeworldStageOrder, 'stars', [
        ...chosenStars(selection),
        star
    ])
}

export function withShipColor(
    selection: HomeworldSelection,
    color: PyramidColor
): HomeworldSelection {
    return setStagedSelectionValue(selection, HomeworldStageOrder, 'shipColor', color, 'manual')
}
