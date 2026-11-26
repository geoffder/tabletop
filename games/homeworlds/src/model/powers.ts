import { type PieceKind, PyramidColor } from './pieces.js'

export enum Power {
    Build = 'build',
    Move = 'move',
    Discover = 'discover',
    Capture = 'capture',
    Trade = 'trade'
}

export const POWER_COLOR: Record<Power, PyramidColor> = {
    [Power.Build]: PyramidColor.Green,
    [Power.Move]: PyramidColor.Yellow,
    [Power.Discover]: PyramidColor.Yellow,
    [Power.Capture]: PyramidColor.Red,
    [Power.Trade]: PyramidColor.Blue
}

// One use of a colour's power: a ship is named by its piece.
export type PowerUse =
    | { power: Power.Build; systemId: number; color: PyramidColor }
    | { power: Power.Move; ship: number; systemId: number }
    | { power: Power.Discover; ship: number; star: PieceKind }
    | { power: Power.Capture; ship: number }
    | { power: Power.Trade; ship: number; color: PyramidColor }
