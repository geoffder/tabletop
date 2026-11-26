import { ActionType } from '../definition/actions.js'

export const POWER_ACTION_TYPES = [
    ActionType.Build,
    ActionType.Move,
    ActionType.Discover,
    ActionType.Capture,
    ActionType.Trade
] as const
