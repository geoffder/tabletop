export enum MachineState {
    // Each player in turn builds a homeworld: two stars and a Large ship.
    SettingUp = 'SettingUp',
    // The start of a turn: one action, a sacrifice, a catastrophe or a pass.
    TakingTurn = 'TakingTurn',
    // A sacrifice's actions, one at a time; catastrophes may come between them.
    SacrificeActions = 'SacrificeActions',
    // The turn's actions are used; catastrophes may still be declared before it ends.
    FinishingTurn = 'FinishingTurn',
    EndOfGame = 'EndOfGame'
}
