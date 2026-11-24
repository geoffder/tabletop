import {
    Axis,
    bridgeEnds,
    type Cell,
    CELL_COUNT,
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

// One action's change to what stands where: canals dug, a temple or a district's token on a
// square, a Pilli Mexica on a new square, or a bridge moved.
export interface LayoutChange {
    dug?: readonly Cell[]
    temple?: Temple
    token?: District
    pilli?: { playerId: string; cell: Cell }
    bridge?: { from: Cell; to: Bridge }
}

// What stands where, gathered once for the rule queries of one position.
export class Layout {
    readonly canals = new Set<Cell>()
    readonly bridges = new Map<Cell, Bridge>()
    readonly temples = new Map<Cell, Temple>()
    readonly tokens = new Map<Cell, number>()
    readonly pillis = new Map<Cell, string>()
    private districtList?: Cell[][]
    private districtIndex?: Map<Cell, number>
    private cutSquares?: Uint8Array

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

    // The position after a change, for testing many changes to one position without copying the
    // game. Districts away from the new canals are kept rather than found again.
    after(change: LayoutChange): Layout {
        const next = new Layout({ canals: [], bridges: [], temples: [], districts: [], pillis: [] })
        for (const cell of this.canals) next.canals.add(cell)
        for (const [cell, bridge] of this.bridges) next.bridges.set(cell, bridge)
        for (const [cell, temple] of this.temples) next.temples.set(cell, temple)
        for (const [cell, token] of this.tokens) next.tokens.set(cell, token)
        for (const [cell, playerId] of this.pillis) {
            if (playerId !== change.pilli?.playerId) next.pillis.set(cell, playerId)
        }
        const dug = change.dug ?? []
        for (const cell of dug) next.canals.add(cell)
        if (change.temple !== undefined) next.temples.set(change.temple.cell, change.temple)
        if (change.token !== undefined) next.tokens.set(change.token.cell, change.token.tokenId)
        if (change.pilli !== undefined) next.pillis.set(change.pilli.cell, change.pilli.playerId)
        if (change.bridge !== undefined) {
            next.bridges.delete(change.bridge.from)
            next.bridges.set(change.bridge.to.cell, change.bridge.to)
        }

        // Only the districts the new canals cut into change. One square dug off a district that
        // does not hang together through it leaves the rest of the district whole; otherwise
        // the ground is found again in the districts dug into.
        const districts = this.districts()
        const index = this.districtIndex ?? new Map<Cell, number>()
        const cut = new Set(dug.flatMap((cell) => index.get(cell) ?? []))
        if (cut.size === 0) {
            next.districtList = districts
            next.districtIndex = index
            return next
        }
        const [at] = cut
        const district = districts[at]
        if (dug.length === 1 && district.length > 1 && !this.isCutSquare(dug[0])) {
            const list = [...districts]
            list[at] = district.filter((cell) => cell !== dug[0])
            next.districtList = list
            next.districtIndex = index
            return next
        }
        const list = districts.filter((_, at) => !cut.has(at))
        const nextIndex = new Map<Cell, number>()
        list.forEach((district, at) => {
            for (const cell of district) nextIndex.set(cell, at)
        })
        for (const at of cut) next.findDistricts(districts[at], list, nextIndex)
        next.districtList = list
        next.districtIndex = nextIndex
        return next
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
            this.findDistricts(LAND_CELLS, list, index)
            this.districtList = list
            this.districtIndex = index
        }
        return this.districtList
    }

    // Adds the districts the ground among `cells` makes to the list and the index. Ground next
    // to ground is in its district, so the search stays among `cells` when they are districts.
    private findDistricts(cells: readonly Cell[], list: Cell[][], index: Map<Cell, number>) {
        for (const start of cells) {
            if (!this.isGround(start) || index.has(start)) continue
            const district = [start]
            index.set(start, list.length)
            for (let i = 0; i < district.length; i++) {
                for (const next of neighbours(district[i])) {
                    if (this.isGround(next) && !index.has(next)) {
                        index.set(next, list.length)
                        district.push(next)
                    }
                }
            }
            list.push(district.sort((a, b) => a - b))
        }
    }

    // A dug square keeps its place in a shared index, so only ground is looked up.
    districtOf(cell: Cell): Cell[] | undefined {
        const districts = this.districts()
        const index = this.isGround(cell) ? this.districtIndex?.get(cell) : undefined
        return index === undefined ? undefined : districts[index]
    }

    // Whether digging the square alone would split its district: a cut vertex of the ground,
    // found for every square at once (Tarjan's low-link search) the first time it is asked.
    isCutSquare(cell: Cell): boolean {
        if (this.cutSquares === undefined) this.cutSquares = this.findCutSquares()
        return this.cutSquares[cell] === 1
    }

    private findCutSquares(): Uint8Array {
        const cut = new Uint8Array(CELL_COUNT)
        // The order each square is reached in, from 1, and the earliest square reachable from
        // below it in the search without passing through its parent.
        const order = new Int32Array(CELL_COUNT)
        const low = new Int32Array(CELL_COUNT)
        let count = 0
        for (const district of this.districts()) {
            const root = district[0]
            order[root] = low[root] = ++count
            let rootChildren = 0
            const stack: { cell: Cell; parent: Cell; next: number }[] = [
                { cell: root, parent: -1, next: 0 }
            ]
            while (stack.length > 0) {
                const top = stack[stack.length - 1]
                const around = neighbours(top.cell)
                if (top.next < around.length) {
                    const next = around[top.next++]
                    if (!this.isGround(next) || next === top.parent) continue
                    if (order[next] === 0) {
                        order[next] = low[next] = ++count
                        if (top.cell === root) rootChildren++
                        stack.push({ cell: next, parent: top.cell, next: 0 })
                    } else {
                        low[top.cell] = Math.min(low[top.cell], order[next])
                    }
                    continue
                }
                stack.pop()
                const parent = top.parent
                if (parent < 0) continue
                low[parent] = Math.min(low[parent], low[top.cell])
                if (parent !== root && low[top.cell] >= order[parent]) cut[parent] = 1
            }
            if (rootChildren > 1) cut[root] = 1
        }
        return cut
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
