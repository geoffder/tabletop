import {
    Axis,
    bridgeEnds,
    type Cell,
    DIRECTIONS,
    Direction,
    isLand,
    isLake,
    isPalace,
    LAND_CELLS,
    neighbour,
    neighbours
} from './board.js'
import type { Bridge, District, Temple } from './pieces.js'

// What stands where, gathered once for the rule queries of one position.
export class Layout {
    readonly canals = new Set<Cell>()
    readonly bridges = new Map<Cell, Bridge>()
    readonly temples = new Map<Cell, Temple>()
    readonly tokens = new Map<Cell, number>()
    readonly pillis = new Map<Cell, string>()
    private districtList?: Cell[][]
    private districtIndex?: Map<Cell, number>

    constructor(pieces: {
        canals: readonly { cells: readonly Cell[] }[]
        bridges: readonly Bridge[]
        temples: readonly Temple[]
        districts: readonly District[]
        pillis: readonly { playerId: string; cell?: Cell }[]
    }) {
        for (const canal of pieces.canals) for (const cell of canal.cells) this.canals.add(cell)
        for (const bridge of pieces.bridges) this.bridges.set(bridge.cell, bridge)
        for (const temple of pieces.temples) this.temples.set(temple.cell, temple)
        for (const district of pieces.districts) this.tokens.set(district.cell, district.tokenId)
        for (const { playerId, cell } of pieces.pillis) {
            if (cell !== undefined) this.pillis.set(cell, playerId)
        }
    }

    isWater(cell: Cell): boolean {
        return isLake(cell) || this.canals.has(cell)
    }

    // Land not dug into a canal, palace included.
    isGround(cell: Cell): boolean {
        return isLand(cell) && !this.canals.has(cell)
    }

    // Ground with nothing on it: no temple, district token or Pilli Mexica.
    isEmptyGround(cell: Cell): boolean {
        return (
            this.isGround(cell) &&
            !this.temples.has(cell) &&
            !this.tokens.has(cell) &&
            !this.pillis.has(cell)
        )
    }

    // Empty ground off the palace, where a temple or token may go.
    isBuildable(cell: Cell): boolean {
        return this.isEmptyGround(cell) && !isPalace(cell)
    }

    // A cell a bridge's ramp rests on.
    holdsBridge(cell: Cell): boolean {
        return DIRECTIONS.some((direction) => {
            const next = neighbour(cell, direction)
            if (next === undefined) return false
            const bridge = this.bridges.get(next)
            return bridge !== undefined && bridgeEnds(bridge.cell, bridge.axis).includes(cell)
        })
    }

    bridgeFits(cell: Cell, axis: Axis): boolean {
        if (!this.canals.has(cell) || this.bridges.has(cell)) return false
        return bridgeEnds(cell, axis).every((end) => end !== undefined && this.isGround(end))
    }

    // Districts are the pieces of ground the water divides; touching at a corner does not join.
    districts(): Cell[][] {
        if (this.districtList === undefined) {
            const list: Cell[][] = []
            const index = new Map<Cell, number>()
            for (const start of LAND_CELLS) {
                if (!this.isGround(start) || index.has(start)) continue
                const cells = [start]
                index.set(start, list.length)
                for (let i = 0; i < cells.length; i++) {
                    for (const next of neighbours(cells[i])) {
                        if (this.isGround(next) && !index.has(next)) {
                            index.set(next, list.length)
                            cells.push(next)
                        }
                    }
                }
                list.push(cells.sort((a, b) => a - b))
            }
            this.districtList = list
            this.districtIndex = index
        }
        return this.districtList
    }

    districtOf(cell: Cell): Cell[] | undefined {
        const districts = this.districts()
        const index = this.districtIndex?.get(cell)
        return index === undefined ? undefined : districts[index]
    }

    tokenIn(district: readonly Cell[]): number | undefined {
        for (const cell of district) {
            const token = this.tokens.get(cell)
            if (token !== undefined) return token
        }
        return undefined
    }

    isFounded(cell: Cell): boolean {
        const district = this.districtOf(cell)
        return district !== undefined && this.tokenIn(district) !== undefined
    }

    // Bridges a boat from this bridge reaches next, through canals and the lake, without passing
    // under another bridge.
    boatHops(from: Cell): Cell[] {
        const hops = new Set<Cell>()
        const seen = new Set<Cell>([from])
        const queue = [from]
        let lakeReached = false
        const visit = (cell: Cell) => {
            if (seen.has(cell)) return
            seen.add(cell)
            if (this.bridges.has(cell)) hops.add(cell)
            else queue.push(cell)
        }
        while (queue.length > 0) {
            const cell = queue.shift()
            if (cell === undefined) break
            for (const direction of DIRECTIONS) {
                const next = neighbour(cell, direction)
                if (next === undefined || isLake(next)) {
                    if (!lakeReached) {
                        lakeReached = true
                        for (const shore of this.canalsOnLake()) visit(shore)
                    }
                } else if (this.canals.has(next)) {
                    visit(next)
                }
            }
        }
        return [...hops]
    }

    private canalsOnLake(): Cell[] {
        return [...this.canals].filter((cell) =>
            DIRECTIONS.some((direction) => {
                const next = neighbour(cell, direction)
                return next === undefined || isLake(next)
            })
        )
    }

    // Where a Pilli Mexica can go for one action point: a step onto free ground or onto a free
    // bridge from its ends, a step off a bridge, or a boat ride to the next bridge.
    steps(from: Cell): { cell: Cell; byBoat: boolean }[] {
        const steps: { cell: Cell; byBoat: boolean }[] = []
        const bridge = this.bridges.get(from)
        if (bridge !== undefined) {
            for (const end of bridgeEnds(bridge.cell, bridge.axis)) {
                if (end !== undefined && this.isEmptyGround(end)) {
                    steps.push({ cell: end, byBoat: false })
                }
            }
            for (const hop of this.boatHops(from)) steps.push({ cell: hop, byBoat: true })
            return steps
        }
        for (const direction of DIRECTIONS) {
            const next = neighbour(from, direction)
            if (next === undefined) continue
            if (this.isEmptyGround(next)) {
                steps.push({ cell: next, byBoat: false })
                continue
            }
            const across = this.bridges.get(next)
            if (
                across !== undefined &&
                !this.pillis.has(next) &&
                axisOf(direction) === across.axis
            ) {
                steps.push({ cell: next, byBoat: false })
            }
        }
        return steps
    }
}

function axisOf(direction: Direction): Axis {
    return direction === Direction.North || direction === Direction.South
        ? Axis.NorthSouth
        : Axis.EastWest
}
