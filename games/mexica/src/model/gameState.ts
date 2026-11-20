import {
    assert,
    assertExists,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import {
    areAdjacent,
    Axis,
    type Cell,
    isCell,
    isLand,
    isPalace,
    isStart,
    LAND_CELLS
} from './board.js'
import { Layout } from './layout.js'
import { type Route, routesFrom } from './movement.js'
import {
    ACTION_TOKEN_COUNT,
    BASE_AP,
    Bridge,
    BRIDGE_COUNT,
    CanalTile,
    District,
    DistrictTokenSchema,
    DOUBLE_CANAL_COUNT,
    LEVELS,
    type Level,
    PALACE_BONUS,
    PERIODS,
    placePoints,
    SINGLE_CANAL_COUNT,
    Temple,
    templesAllowed,
    TELEPORT_COST,
    TOKENS_TAKEN_PER_TURN,
    tokenSize
} from './pieces.js'
import { HydratedMexicaPlayerState, MexicaPlayerState } from './playerState.js'
import { type DistrictScore, NEUTRAL, rankAwards } from './scoring.js'

export type MexicaGameState = Type.Static<typeof MexicaGameState>
export const MexicaGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(MexicaPlayerState),
    machineState: Type.Enum(MachineState),
    canals: Type.Array(CanalTile, { maxItems: SINGLE_CANAL_COUNT + DOUBLE_CANAL_COUNT }),
    bridges: Type.Array(Bridge, { maxItems: BRIDGE_COUNT }),
    temples: Type.Array(Temple),
    districts: Type.Array(District),
    // The Emperor's commands: tokens still to be founded this period, smallest first.
    display: Type.Array(DistrictTokenSchema),
    // The tokens set aside for the second period.
    reserve: Type.Array(DistrictTokenSchema),
    period: Type.Integer({ minimum: 1, maximum: PERIODS }),
    // The turn holder's own action points still unspent this turn.
    apLeft: Type.Integer({ minimum: 0, maximum: BASE_AP }),
    tokensTaken: Type.Integer({ minimum: 0, maximum: TOKENS_TAKEN_PER_TURN }),
    acted: Type.Boolean(),
    // Turns in a row ended without doing anything; a full round of them ends the period.
    idleTurns: Type.Integer({ minimum: 0 })
})

export const MexicaGameStateValidator = Compile(MexicaGameState)

export interface Move extends Route {
    teleport: boolean
}

export class HydratedMexicaGameState
    extends HydratableGameState<typeof MexicaGameState, HydratedMexicaPlayerState>
    implements MexicaGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedMexicaPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare canals: CanalTile[]
    declare bridges: Bridge[]
    declare temples: Temple[]
    declare districts: District[]
    declare display: number[]
    declare reserve: number[]
    declare period: number
    declare apLeft: number
    declare tokensTaken: number
    declare acted: boolean
    declare idleTurns: number

    constructor(data: MexicaGameState) {
        super(data, MexicaGameStateValidator)
        this.players = data.players.map((player) => new HydratedMexicaPlayerState(player))
    }

    layout(): Layout {
        return new Layout({
            canals: this.canals,
            bridges: this.bridges,
            temples: this.temples,
            districts: this.districts,
            pillis: this.players.map((player) => ({
                playerId: player.playerId,
                cell: player.pilli
            }))
        })
    }

    pilliOf(playerId: string): Cell {
        const cell = this.getPlayerState(playerId).pilli
        assertExists(cell, `Player ${playerId} has not placed their Pilli Mexica`)
        return cell
    }

    // Action points

    apAvailable(playerId: string): number {
        return this.apLeft + this.getPlayerState(playerId).actionTokens
    }

    // Spends the turn's own points first, then action tokens, which go back to the supply.
    pay(playerId: string, cost: number) {
        assert(cost <= this.apAvailable(playerId), `Player ${playerId} cannot pay ${cost}`)
        const fromTurn = Math.min(cost, this.apLeft)
        this.apLeft -= fromTurn
        this.getPlayerState(playerId).actionTokens -= cost - fromTurn
        this.acted = true
    }

    tokenSupply(): number {
        return (
            ACTION_TOKEN_COUNT - this.players.reduce((sum, player) => sum + player.actionTokens, 0)
        )
    }

    // A token is bought with the turn's own points, at most two a turn.
    canTakeToken(): boolean {
        return (
            this.apLeft >= 1 && this.tokensTaken < TOKENS_TAKEN_PER_TURN && this.tokenSupply() > 0
        )
    }

    takeToken(playerId: string) {
        this.apLeft -= 1
        this.tokensTaken += 1
        this.getPlayerState(playerId).actionTokens += 1
        this.acted = true
    }

    startTurn() {
        this.apLeft = BASE_AP
        this.tokensTaken = 0
        this.acted = false
    }

    // Canals

    singleCanalsLeft(): number {
        return SINGLE_CANAL_COUNT - this.canals.filter((canal) => canal.cells.length === 1).length
    }

    doubleCanalsLeft(): number {
        return DOUBLE_CANAL_COUNT - this.canals.filter((canal) => canal.cells.length === 2).length
    }

    canalTilesLeft(): number {
        return this.singleCanalsLeft() + this.doubleCanalsLeft()
    }

    // A canal goes on empty land off the palace, never against a bridge's ramp nor into a founded
    // district.
    canDigAt(cell: number, layout: Layout = this.layout()): boolean {
        return (
            isLand(cell) &&
            !isPalace(cell) &&
            layout.isEmptyGround(cell) &&
            !layout.holdsBridge(cell) &&
            !layout.isFounded(cell)
        )
    }

    canDig(cells: readonly number[]): boolean {
        const layout = this.layout()
        if (!cells.every((cell) => this.canDigAt(cell, layout))) return false
        if (cells.length === 1) return this.singleCanalsLeft() > 0
        return cells.length === 2 && areAdjacent(cells[0], cells[1]) && this.doubleCanalsLeft() > 0
    }

    dig(cells: readonly Cell[]) {
        this.canals.push({ cells: [...cells] })
    }

    // Bridges

    bridgesLeft(): number {
        return BRIDGE_COUNT - this.bridges.length
    }

    canBuildBridge(cell: number, axis: Axis): boolean {
        return isCell(cell) && this.bridgesLeft() > 0 && this.layout().bridgeFits(cell, axis)
    }

    buildBridge(cell: Cell, axis: Axis) {
        this.bridges.push({ cell, axis })
    }

    // Only once every bridge is built, and only a bridge nobody stands on.
    canMoveBridge(bridgeId: number, cell: number, axis: Axis): boolean {
        const bridge = this.bridges.at(bridgeId)
        if (bridge === undefined || this.bridgesLeft() > 0 || !isCell(cell)) return false
        const layout = this.layout()
        return !layout.pillis.has(bridge.cell) && layout.bridgeFits(cell, axis)
    }

    moveBridge(bridgeId: number, cell: Cell, axis: Axis) {
        this.bridges[bridgeId] = { cell, axis }
    }

    // Temples

    templesLeft(playerId: string, level: Level): number {
        const built = this.temples.filter(
            (temple) => temple.playerId === playerId && temple.level === level
        ).length
        return templesAllowed(this.period, level) - built
    }

    allTemplesBuilt(playerId: string): boolean {
        return LEVELS.every((level) => this.templesLeft(playerId, level) === 0)
    }

    // The Pilli Mexica's district, or undefined while it stands on a bridge.
    pilliDistrict(playerId: string, layout: Layout = this.layout()): Cell[] | undefined {
        const cell = this.pilliOf(playerId)
        return layout.bridges.has(cell) ? undefined : layout.districtOf(cell)
    }

    canBuildTemple(playerId: string, cell: number, level: Level): boolean {
        if (this.templesLeft(playerId, level) <= 0) return false
        const layout = this.layout()
        const district = this.pilliDistrict(playerId, layout)
        return district !== undefined && layout.isBuildable(cell) && district.includes(cell)
    }

    buildTemple(playerId: string, cell: Cell, level: Level) {
        this.temples.push({ cell, level, playerId })
    }

    // Founding

    // The token the Pilli Mexica's district would take: one on display matching its size.
    foundingToken(playerId: string, layout: Layout = this.layout()): number | undefined {
        const district = this.pilliDistrict(playerId, layout)
        if (district === undefined || layout.tokenIn(district) !== undefined) return undefined
        return this.display.find((tokenId) => tokenSize(tokenId) === district.length)
    }

    canFound(playerId: string, cell: number): boolean {
        const layout = this.layout()
        if (this.foundingToken(playerId, layout) === undefined) return false
        const district = this.pilliDistrict(playerId, layout)
        return district !== undefined && district.includes(cell) && layout.isBuildable(cell)
    }

    // The founder scores the token's second value, every other player with a Pilli Mexica in the
    // district its third.
    found(playerId: string, cell: Cell): { tokenId: number; visitors: string[] } {
        const layout = this.layout()
        const tokenId = this.foundingToken(playerId, layout)
        const district = this.pilliDistrict(playerId, layout)
        assertExists(tokenId, 'A token must match the district')
        assertExists(district, 'The founder stands in the district')
        this.display = this.display.filter((id) => id !== tokenId)
        this.districts.push({ tokenId, cell })
        const [, second, third] = placePoints(tokenSize(tokenId))
        this.getPlayerState(playerId).score += second
        const visitors = this.players
            .filter(
                (player) =>
                    player.playerId !== playerId &&
                    player.pilli !== undefined &&
                    district.includes(player.pilli)
            )
            .map((player) => player.playerId)
        for (const visitor of visitors) this.getPlayerState(visitor).score += third
        return { tokenId, visitors }
    }

    // Movement

    // Every cell the Pilli Mexica could stop on, by the cheapest way: on foot and by boat, or the
    // 5-point teleport to any free ground or bridge.
    moves(playerId: string, layout: Layout = this.layout()): Map<Cell, Move> {
        const from = this.pilliOf(playerId)
        const moves = new Map<Cell, Move>()
        for (const [cell, route] of routesFrom(layout, from)) {
            moves.set(cell, { ...route, teleport: false })
        }
        const free = [
            ...LAND_CELLS.filter((cell) => layout.isEmptyGround(cell)),
            ...[...layout.bridges.keys()].filter((cell) => !layout.pillis.has(cell))
        ]
        for (const cell of free) {
            const walked = moves.get(cell)
            if (walked === undefined || walked.cost > TELEPORT_COST) {
                moves.set(cell, { cost: TELEPORT_COST, path: [from, cell], teleport: true })
            }
        }
        return moves
    }

    moveTo(playerId: string, cell: number): Move | undefined {
        const move = this.moves(playerId).get(cell)
        return move !== undefined && move.cost <= this.apAvailable(playerId) ? move : undefined
    }

    placePilli(playerId: string, cell: Cell) {
        this.getPlayerState(playerId).pilli = cell
    }

    // Whether the Pilli Mexica is free: it has a step to take and can still reach the island's
    // largest district on foot or by boat. The first round forbids shutting one in or cutting one
    // off, so that it would need a bridge or the teleport to get out.
    isFree(playerId: string): boolean {
        const layout = this.layout()
        const from = this.pilliOf(playerId)
        const routes = routesFrom(layout, from)
        if (![...routes.values()].some((route) => route.cost === 1)) return false
        const largest = Math.max(...layout.districts().map((district) => district.length))
        return [from, ...routes.keys()].some((cell) => layout.districtOf(cell)?.length === largest)
    }

    // The first round of play, after each player has placed their Pilli Mexica: every player's
    // first turn.
    isFirstRound(): boolean {
        const turn = this.turnManager.currentTurn()
        assertExists(turn, 'A player must have the turn')
        return this.period === 1 && this.turnManager.turnCount(turn.playerId) <= 1
    }

    // In the first round, no action may shut in or cut off another player's Pilli Mexica.
    leavesEveryoneFree(
        playerId: string,
        change: (state: HydratedMexicaGameState) => void
    ): boolean {
        if (!this.isFirstRound()) return true
        const others = this.players
            .map((player) => player.playerId)
            .filter((other) => other !== playerId && this.isFree(other))
        const after = new HydratedMexicaGameState(structuredClone(this.dehydrate()))
        change(after)
        return others.every((other) => after.isFree(other))
    }

    // Starting spaces

    canStartOn(cell: number): boolean {
        return (
            isCell(cell) && isStart(cell) && this.players.every((player) => player.pilli !== cell)
        )
    }

    // Period end

    periodComplete(): boolean {
        return (
            this.display.length === 0 &&
            this.players.some((player) => this.allTemplesBuilt(player.playerId))
        )
    }

    // A token on display that no district can take any more: none is its size with room for the
    // token and a Pilli Mexica, and none larger could still be cut down to it.
    impossibleTokens(): number[] {
        const layout = this.layout()
        const open = layout.districts().filter((district) => layout.tokenIn(district) === undefined)
        const room = (district: readonly Cell[]) =>
            district.filter((cell) => !layout.temples.has(cell))
        const canalsLeft = this.canalTilesLeft() > 0
        return this.display.filter((tokenId) => {
            const size = tokenSize(tokenId)
            const exact = open.some((district) => {
                const free = room(district)
                return (
                    district.length === size &&
                    free.length >= 2 &&
                    free.some((cell) => !isPalace(cell))
                )
            })
            const cuttable =
                canalsLeft &&
                open.some((district) => district.length > size && room(district).length >= 3)
            return !exact && !cuttable
        })
    }

    removeTokens(tokenIds: readonly number[]) {
        this.display = this.display.filter((id) => !tokenIds.includes(id))
    }

    // Scoring

    // Founded districts score every period, unfounded ones only at the end: their first place
    // scores one point per space.
    scoreDistricts(): DistrictScore[] {
        const layout = this.layout()
        const scores: DistrictScore[] = []
        for (const district of layout.districts()) {
            const tokenId = layout.tokenIn(district)
            if (tokenId === undefined && this.period < PERIODS) continue
            const levels = new Map<string, number>()
            for (const cell of district) {
                const temple = layout.temples.get(cell)
                if (temple === undefined) continue
                const owner = temple.playerId ?? NEUTRAL
                levels.set(owner, (levels.get(owner) ?? 0) + temple.level)
            }
            const size = tokenId === undefined ? district.length : tokenSize(tokenId)
            const awards = rankAwards(levels, placePoints(size))
            if (awards.length === 0) continue
            for (const award of awards) this.getPlayerState(award.playerId).score += award.points
            scores.push({
                ...(tokenId === undefined ? {} : { tokenId }),
                cell: district[0],
                size: district.length,
                awards
            })
        }
        return scores
    }

    scorePalace(): string[] {
        const present = this.players
            .filter((player) => player.pilli !== undefined && isStart(player.pilli))
            .map((player) => player.playerId)
        for (const playerId of present) this.getPlayerState(playerId).score += PALACE_BONUS
        return present
    }

    startSecondPeriod() {
        this.period = PERIODS
        this.display = [...this.reserve]
        this.reserve = []
        this.idleTurns = 0
    }

    // Most prestige wins; a tie goes to whoever holds the most action tokens, and a tie in that is
    // shared.
    declareResult() {
        const best = Math.max(...this.players.map((player) => player.score))
        const leaders = this.players.filter((player) => player.score === best)
        const most = Math.max(...leaders.map((player) => player.actionTokens))
        this.winningPlayerIds = leaders
            .filter((player) => player.actionTokens === most)
            .map((player) => player.playerId)
        this.result = this.winningPlayerIds.length > 1 ? GameResult.Draw : GameResult.Win
        this.activePlayerIds = []
    }
}
