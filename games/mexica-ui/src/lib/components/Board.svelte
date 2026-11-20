<script lang="ts">
    import {
        type Axis,
        type Cell,
        cellAt,
        cellName,
        columnOf,
        isLand,
        LAND_CELLS,
        type Level,
        rowOf,
        tokenSize,
        placePoints
    } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BRIDGE_RISE, CELL, type PlanStep } from '$lib/board/view.js'
    import type { Point } from '@tabletop/common'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { SHORE_ZONE, shoreDepth } from '$lib/board/surfaceTexture.js'
    import {
        CANAL_LOOK,
        LAKE_LOOK,
        PAVING_LOOK,
        SHORE_LOOK,
        type SlopeCorner,
        slopeCornerLook,
        slopeLook,
        type SlopeSide,
        SLOPE_WIDTH,
        templeLook
    } from '$lib/board/looks.js'
    import { DESIGN, templeBounds } from '$lib/board/templeShape.js'
    import { templeMark } from '$lib/board/templeMarks.js'
    import TempleMarks from './TempleMarks.svelte'
    import { PLAN } from '$lib/board/plan.js'
    import { bridgePaths, octagon } from '$lib/board/shapes.js'
    import { LOOK_OUTLINES } from '$lib/board/lookOutlines.js'
    import { pilliBounds, pilliLook, pilliShineLook, shineOver } from '$lib/board/pilliShape.js'

    const session = getGameSession()
    const view = $derived(session.view)

    const game = $derived(session.gameState)
    const layout = $derived(game.layout())

    type Raised =
        | { kind: 'temple'; cell: Cell; level: Level; playerId?: string }
        | { kind: 'pilli'; cell: Cell; playerId: string; onBridge: boolean }
        | { kind: 'bridge'; cell: Cell; axis: Axis }

    // Everything standing on the board, far rows first so nearer pieces stand in front.
    const raised: Raised[] = $derived.by(() => {
        const pieces: Raised[] = [
            ...game.bridges.map((bridge) => ({
                kind: 'bridge' as const,
                cell: bridge.cell,
                axis: bridge.axis
            })),
            ...game.temples.map((temple) => ({
                kind: 'temple' as const,
                cell: temple.cell,
                level: temple.level,
                playerId: temple.playerId
            })),
            ...game.players
                .filter((player) => player.pilli !== undefined)
                .map((player) => ({
                    kind: 'pilli' as const,
                    cell: player.pilli ?? 0,
                    playerId: player.playerId,
                    onBridge: layout.bridges.has(player.pilli ?? -1)
                }))
        ]
        const order = { bridge: 0, temple: 1, pilli: 2 }
        return pieces.sort(
            (a, b) => view.centre(a.cell).y - view.centre(b.cell).y || order[a.kind] - order[b.kind]
        )
    })

    // Neighbouring canal cells overlap a little, or their clipped edges leave a seam.
    const CLIP_OVERLAP = 0.5

    const isCanalAt = (cell: Cell, step: PlanStep) => {
        const next = cellAt(columnOf(cell) + step.column, rowOf(cell) + step.row)
        return next !== undefined && layout.canals.has(next)
    }

    const isLakeAt = (cell: Cell, step: PlanStep) => {
        const next = cellAt(columnOf(cell) + step.column, rowOf(cell) + step.row)
        return next === undefined || !isLand(next)
    }

    // A kerb of tezontle along every edge where the paving meets a canal, in plan.
    const KERB = { width: 2.6, line: 0.7 }
    const PLAN_SIDES: readonly PlanStep[] = [
        { column: 0, row: -1 },
        { column: 1, row: 0 },
        { column: 0, row: 1 },
        { column: -1, row: 0 }
    ]
    const kerbs = $derived.by(() =>
        LAND_CELLS.filter((cell) => !layout.canals.has(cell)).flatMap((cell) =>
            PLAN_SIDES.filter((step) => isCanalAt(cell, step)).map((step) => {
                const left = columnOf(cell) * CELL
                const top = rowOf(cell) * CELL
                const across = step.column !== 0
                const far = step.column > 0 || step.row > 0
                const offset = (width: number) => (far ? CELL - width : 0)
                const strip = (width: number) =>
                    across
                        ? { x: left + offset(width), y: top, width, height: CELL }
                        : { x: left, y: top + offset(width), width: CELL, height: width }
                return {
                    key: `${cell}-${step.column}-${step.row}`,
                    stone: strip(KERB.width),
                    edge: strip(KERB.line)
                }
            })
        )
    )

    // A canal's banks slope down from the kerb to the water, faced with tezontle brick, on every
    // side where it meets land; where two banks meet in a corner they are mitred, and where a
    // canal turns round a corner of land its bank curves round it.
    const TALUD = SLOPE_WIDTH
    const SIDE_OF: Record<SlopeSide, PlanStep> = {
        n: { column: 0, row: -1 },
        e: { column: 1, row: 0 },
        s: { column: 0, row: 1 },
        w: { column: -1, row: 0 }
    }
    // Each side's ends, clockwise, and the sides it meets at them.
    const ENDS: Record<SlopeSide, [SlopeSide, SlopeSide]> = {
        n: ['w', 'e'],
        e: ['n', 's'],
        s: ['e', 'w'],
        w: ['s', 'n']
    }
    const SLOPE_SIDES: readonly SlopeSide[] = ['n', 'e', 's', 'w']
    // Each corner of a cell and the two sides it lies between.
    const SLOPE_CORNERS: readonly [SlopeCorner, SlopeSide, SlopeSide][] = [
        ['ne', 'n', 'e'],
        ['nw', 'n', 'w'],
        ['se', 's', 'e'],
        ['sw', 's', 'w']
    ]
    const isBankAt = (cell: Cell, step: PlanStep) => {
        const next = cellAt(columnOf(cell) + step.column, rowOf(cell) + step.row)
        return next !== undefined && isLand(next) && !layout.canals.has(next)
    }
    // How far a bank laps over the cut edge of a shore beside it.
    const OVERLAP = 5
    const offset = (from: Point, toward: Point, by: number): Point => ({
        x: from.x + toward.x * by,
        y: from.y + toward.y * by
    })
    const shape = (points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(' ')
    const taluds = $derived.by(() =>
        [...layout.canals].flatMap((cell) => {
            const x0 = columnOf(cell) * CELL
            const y0 = rowOf(cell) * CELL
            const corners = {
                nw: { x: x0, y: y0 },
                ne: { x: x0 + CELL, y: y0 },
                se: { x: x0 + CELL, y: y0 + CELL },
                sw: { x: x0, y: y0 + CELL }
            }
            const edges: Record<SlopeSide, [Point, Point]> = {
                n: [corners.nw, corners.ne],
                e: [corners.ne, corners.se],
                s: [corners.se, corners.sw],
                w: [corners.sw, corners.nw]
            }
            const banked = (side: SlopeSide) => isBankAt(cell, SIDE_OF[side])
            return SLOPE_SIDES.filter(banked).flatMap((side) => {
                const [a, b] = edges[side]
                const step = SIDE_OF[side]
                const inward = { x: -step.column, y: -step.row }
                const along = { x: (b.x - a.x) / CELL, y: (b.y - a.y) / CELL }
                const [before, after] = ENDS[side]
                const pullA = banked(before) ? TALUD : 0
                const pullB = banked(after) ? TALUD : 0
                // Where the canal opens into the lake past an end and the land beside it meets
                // the lake there too, the bank runs on out along the edge of that land's shore,
                // as far as the shore reaches.
                const opensTo = (end: SlopeSide, corner: Point) => {
                    const past = SIDE_OF[end]
                    const beyond = { column: past.column + step.column, row: past.row + step.row }
                    if (!isLakeAt(cell, past) || !isLakeAt(cell, beyond)) return 0
                    return shoreDepth(corner.x + past.column * 3, corner.y + past.row * 3) + 2
                }
                const outA = opensTo(before, a)
                const outB = opensTo(after, b)
                const startA = { x: a.x - along.x * outA, y: a.y - along.y * outA }
                const endB = { x: b.x + along.x * outB, y: b.y + along.y * outB }
                const innerA = {
                    x: startA.x + inward.x * TALUD + along.x * pullA,
                    y: startA.y + inward.y * TALUD + along.y * pullA
                }
                const innerB = {
                    x: endB.x + inward.x * TALUD - along.x * pullB,
                    y: endB.y + inward.y * TALUD - along.y * pullB
                }
                // Beyond the cell the bank also covers the straight edge where that land's shore
                // is cut off at the canal's mouth.
                const over = (from: Point, to: Point) =>
                    shape([from, to, offset(to, inward, -OVERLAP), offset(from, inward, -OVERLAP)])
                return [
                    { key: `${cell}-${side}`, side, points: shape([startA, endB, innerB, innerA]) },
                    ...(outA > 0
                        ? [{ key: `${cell}-${side}-a`, side, points: over(startA, a) }]
                        : []),
                    ...(outB > 0 ? [{ key: `${cell}-${side}-b`, side, points: over(b, endB) }] : [])
                ]
            })
        })
    )

    // Where the coast turns an inside corner, the shores of the land on either side of the corner
    // meet on the diagonal out from it. When a canal opens into the lake at such a corner, the
    // shore of the land across the corner ends on that diagonal at the canal, and a bank runs
    // along it as far as the shore reaches, its bricks turned to the diagonal.
    const shoreEnds = $derived.by(() =>
        [...layout.canals].flatMap((cell) =>
            SLOPE_SIDES.filter((side) => isLakeAt(cell, SIDE_OF[side])).flatMap((side) => {
                const step = SIDE_OF[side]
                const x0 = columnOf(cell) * CELL
                const y0 = rowOf(cell) * CELL
                return ENDS[side]
                    .filter((end) => {
                        const past = SIDE_OF[end]
                        const across = {
                            column: past.column + step.column,
                            row: past.row + step.row
                        }
                        return isBankAt(cell, across)
                    })
                    .map((end) => {
                        const past = SIDE_OF[end]
                        const corner = {
                            x: x0 + (step.column > 0 || past.column > 0 ? CELL : 0),
                            y: y0 + (step.row > 0 || past.row > 0 ? CELL : 0)
                        }
                        // Out along the diagonal into the lake, and across it towards the canal.
                        const out = {
                            x: (step.column - past.column) / Math.SQRT2,
                            y: (step.row - past.row) / Math.SQRT2
                        }
                        const toward = {
                            x: (-step.column - past.column) / Math.SQRT2,
                            y: (-step.row - past.row) / Math.SQRT2
                        }
                        const reach =
                            Math.SQRT2 *
                            (shoreDepth(corner.x + out.x * 4, corner.y + out.y * 4) + 2)
                        const tip = offset(corner, out, reach)
                        // Turn the bricks of a bank sloping down the page to slope this way.
                        const turn = Math.round((Math.atan2(-toward.x, toward.y) * 180) / Math.PI)
                        return {
                            key: `${cell}-${side}-${end}`,
                            side: `diagonal-${turn}`,
                            points: shape([
                                offset(corner, toward, -OVERLAP),
                                offset(tip, toward, -OVERLAP),
                                offset(tip, toward, TALUD),
                                offset(corner, toward, TALUD)
                            ])
                        }
                    })
            })
        )
    )
    const DIAGONAL_TURNS = [45, -45, 135, -135]

    // A curve of bank in the corner of a canal's cell wherever the canal runs on past both sides
    // of that corner but the cell across the corner is land, its corner jutting into the canal.
    const curves = $derived.by(() =>
        [...layout.canals].flatMap((cell) =>
            SLOPE_CORNERS.filter(([, up, beside]) => {
                const across = { column: SIDE_OF[beside].column, row: SIDE_OF[up].row }
                return (
                    isCanalAt(cell, SIDE_OF[up]) &&
                    isCanalAt(cell, SIDE_OF[beside]) &&
                    isBankAt(cell, across)
                )
            }).map(([corner, up, beside]) => {
                const east = beside === 'e'
                const south = up === 's'
                return {
                    key: `${cell}-${corner}`,
                    corner,
                    box: {
                        x: columnOf(cell) * CELL + (east ? CELL - TALUD : 0),
                        y: rowOf(cell) * CELL + (south ? CELL - TALUD : 0),
                        width: TALUD,
                        height: TALUD
                    }
                }
            })
        )
    )

    // The island as drawn: every square of land, and beyond each square that is not a canal the
    // stones and rocks of its shore on the sides it meets the lake, round its corners where it
    // meets the lake on both sides, and up to the diagonal where the coast turns an inside corner
    // and another square's shore takes over. A canal's square has none, so its mouth opens onto
    // the lake.
    const isLandAt = (cell: Cell, column: number, row: number) => {
        const next = cellAt(columnOf(cell) + column, rowOf(cell) + row)
        return next !== undefined && isLand(next)
    }
    const landZones = $derived.by(() =>
        LAND_CELLS.flatMap((cell) => {
            const x0 = columnOf(cell) * CELL
            const y0 = rowOf(cell) * CELL
            const square = shape([
                { x: x0, y: y0 },
                { x: x0 + CELL, y: y0 },
                { x: x0 + CELL, y: y0 + CELL },
                { x: x0, y: y0 + CELL }
            ])
            if (layout.canals.has(cell)) return [{ key: `${cell}`, points: square }]
            const reach = SHORE_ZONE
            const corners = {
                nw: { x: x0, y: y0 },
                ne: { x: x0 + CELL, y: y0 },
                se: { x: x0 + CELL, y: y0 + CELL },
                sw: { x: x0, y: y0 + CELL }
            }
            const edges: Record<SlopeSide, [Point, Point]> = {
                n: [corners.nw, corners.ne],
                e: [corners.ne, corners.se],
                s: [corners.se, corners.sw],
                w: [corners.sw, corners.nw]
            }
            const strips = SLOPE_SIDES.filter((side) => isLakeAt(cell, SIDE_OF[side])).flatMap(
                (side) => {
                    const out = SIDE_OF[side]
                    const outward = { x: out.column, y: out.row }
                    const [a, b] = edges[side]
                    const [before, after] = ENDS[side]
                    const farEnd = (corner: Point, end: SlopeSide) => {
                        const p = SIDE_OF[end]
                        const far = offset(corner, outward, reach)
                        const inside = isLandAt(cell, p.column + out.column, p.row + out.row)
                        return inside ? offset(far, { x: -p.column, y: -p.row }, reach) : far
                    }
                    const strip = [a, b, farEnd(b, after), farEnd(a, before)]
                    // Round the corner beyond an end where the lake lies on both sides.
                    const round = [before, after]
                        .filter((end) => isLakeAt(cell, SIDE_OF[end]))
                        .map((end) => {
                            const p = SIDE_OF[end]
                            const corner = end === before ? a : b
                            const side2 = { x: p.column, y: p.row }
                            return [
                                corner,
                                offset(corner, side2, reach),
                                offset(offset(corner, side2, reach), outward, reach),
                                offset(corner, outward, reach)
                            ]
                        })
                    return [strip, ...round]
                }
            )
            return [
                { key: `${cell}`, points: square },
                ...strips.map((strip, index) => ({ key: `${cell}-${index}`, points: shape(strip) }))
            ]
        })
    )

    const playerFill = (playerId?: string) =>
        playerId === undefined ? 'var(--mx-neutral)' : session.playerFill(playerId)

    // What a tap on each cell would do now.
    const choosable: ReadonlySet<Cell> = $derived.by(() => {
        if (session.canChooseStart) return session.startCells
        if (session.tool !== undefined) return session.targets
        return new Set(session.moves.keys())
    })

    const chosen = $derived(
        [session.chosenCell, session.chosenDestination].filter((cell) => cell !== undefined)
    )

    let hovered: Cell | undefined = $state()

    function onKey(event: KeyboardEvent, cell: Cell) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void session.chooseCell(cell)
        }
    }

    // A tap on anything that cannot be chosen lets go of what was picked up; Undo lets go from
    // the keyboard.
    function onTap(event: MouseEvent) {
        if (
            event.target instanceof Element &&
            event.target.closest('[role="button"]:not([aria-disabled="true"])')
        ) {
            return
        }
        session.letGo()
    }

    // The Emperor's commands, in the lake at the bottom right as on the printed board.
    const display = $derived(game.display)
    const DISPLAY = { left: 14.9, top: 10.8, slot: 1.42, columns: 4, rows: 2 }
    const displayBox = $derived(
        view.planBox(
            DISPLAY.left,
            DISPLAY.top,
            DISPLAY.left + DISPLAY.slot * DISPLAY.columns,
            DISPLAY.top + DISPLAY.slot * DISPLAY.rows
        )
    )
    const SLOT = DISPLAY.slot * CELL
    function slotCentre(index: number) {
        return view.at(
            DISPLAY.left + DISPLAY.slot * ((index % DISPLAY.columns) + 0.5),
            DISPLAY.top + DISPLAY.slot * (Math.floor(index / DISPLAY.columns) + 0.5)
        )
    }

    const landCells = LAND_CELLS
</script>

<div class="tap-off" role="presentation" onclick={onTap}>
    <svg
        class="mx-board"
        viewBox={view.viewBox}
        width={view.frame.width}
        height={view.frame.height}
        role="group"
        aria-label="The island of Tenochtitlan"
    >
        <defs>
            <clipPath id="mx-canal-clip">
                {#each [...layout.canals] as cell (cell)}
                    <rect
                        x={columnOf(cell) * CELL - CLIP_OVERLAP}
                        y={rowOf(cell) * CELL - CLIP_OVERLAP}
                        width={CELL + CLIP_OVERLAP * 2}
                        height={CELL + CLIP_OVERLAP * 2}
                    ></rect>
                {/each}
            </clipPath>
            <clipPath id="mx-land-clip">
                {#each landZones as zone (zone.key)}
                    <polygon points={zone.points}></polygon>
                {/each}
            </clipPath>
            <radialGradient id="mx-piece-shadow">
                <stop offset="0.55" stop-color="#2a1a08" stop-opacity="0.32"></stop>
                <stop offset="1" stop-color="#2a1a08" stop-opacity="0"></stop>
            </radialGradient>
            {#each DIAGONAL_TURNS as turn (turn)}
                <pattern
                    id="mx-slope-diagonal-{turn}"
                    patternUnits="userSpaceOnUse"
                    width={CELL}
                    height={TALUD}
                    patternTransform="rotate({turn})"
                >
                    <image
                        href={LOOK_URLS[slopeLook('n')]}
                        width={CELL}
                        height={TALUD}
                        preserveAspectRatio="none"
                    ></image>
                </pattern>
            {/each}
            {#each SLOPE_SIDES as side (side)}
                {@const runs = side === 'n' || side === 's'}
                <pattern
                    id="mx-slope-{side}"
                    patternUnits="userSpaceOnUse"
                    width={runs ? CELL : TALUD}
                    height={runs ? TALUD : CELL}
                >
                    <image
                        href={LOOK_URLS[slopeLook(side)]}
                        width={runs ? CELL : TALUD}
                        height={runs ? TALUD : CELL}
                        preserveAspectRatio="none"
                    ></image>
                </pattern>
            {/each}
        </defs>

        <g transform={view.planTransform}>
            <image href={LOOK_URLS[LAKE_LOOK]} {...PLAN} preserveAspectRatio="none" class="surface"
            ></image>
            <g clip-path="url(#mx-land-clip)">
                <image
                    href={LOOK_URLS[SHORE_LOOK]}
                    {...PLAN}
                    preserveAspectRatio="none"
                    class="surface"
                ></image>
                <image
                    href={LOOK_URLS[PAVING_LOOK]}
                    {...PLAN}
                    preserveAspectRatio="none"
                    class="surface"
                ></image>
            </g>
            <image
                href={LOOK_URLS[CANAL_LOOK]}
                {...PLAN}
                preserveAspectRatio="none"
                clip-path="url(#mx-canal-clip)"
                class="surface"
            ></image>
            {#each [...taluds, ...shoreEnds] as talud (talud.key)}
                <polygon points={talud.points} fill="url(#mx-slope-{talud.side})" class="surface"
                ></polygon>
            {/each}
            {#each curves as curve (curve.key)}
                <image
                    href={LOOK_URLS[slopeCornerLook(curve.corner)]}
                    {...curve.box}
                    preserveAspectRatio="none"
                    class="surface"
                ></image>
            {/each}
            {#each kerbs as kerb (kerb.key)}
                <rect {...kerb.stone} class="surface kerb"></rect>
                <rect {...kerb.edge} class="surface kerb-edge"></rect>
            {/each}
        </g>
        {#if session.showCoordinates}
            {#each view.labels as label (label.key)}
                <text class="label" x={label.at.x} y={label.at.y} dy="4.2" text-anchor="middle"
                    >{label.text}</text
                >
            {/each}
        {/if}

        {#each game.districts as district (district.tokenId)}
            {@const centre = view.centre(district.cell)}
            {@const size = tokenSize(district.tokenId)}
            <polygon points={octagon(view, centre, CELL * 0.4)} class="token-side"></polygon>
            <polygon points={octagon(view, centre, CELL * 0.4, 3)} class="token"></polygon>
            <text class="token-size" x={centre.x} y={centre.y - 3} dy="4.6" text-anchor="middle"
                >{size}</text
            >
        {/each}

        <!-- Ground marks: where the chosen tool or the Pilli Mexica can go. -->
        {#each [...choosable] as cell (cell)}
            {@const centre = view.centre(cell)}
            {@const move = session.moves.get(cell)}
            {#if !move?.teleport}
                <ellipse
                    cx={centre.x}
                    cy={centre.y}
                    rx={CELL * 0.16}
                    ry={CELL * 0.16 * view.tilt}
                    class="mark-band"
                ></ellipse>
                <ellipse
                    cx={centre.x}
                    cy={centre.y}
                    rx={CELL * 0.16}
                    ry={CELL * 0.16 * view.tilt}
                    class="mark"
                ></ellipse>
            {/if}
        {/each}
        {#each chosen as cell (cell)}
            {@const rect = view.cellBox(cell)}
            <rect
                x={rect.x + 2}
                y={rect.y + 2}
                width={rect.width - 4}
                height={rect.height - 4}
                rx="3"
                class="chosen"
            ></rect>
        {/each}

        {#each raised as piece (`${piece.kind}-${piece.cell}`)}
            {@const centre = view.centre(piece.cell)}
            {#if piece.kind === 'bridge'}
                {@const paths = bridgePaths(view, centre, view.screenAxis(piece.axis))}
                {#if paths.far}<path d={paths.far} class="bridge-far"></path>{/if}
                <path d={paths.top} class="bridge-top"></path>
                {#if paths.near}<path d={paths.near} class="bridge-near"></path>{/if}
                {#if paths.body}<path d={paths.body} class="bridge"></path>{/if}
            {:else if piece.kind === 'temple'}
                {@const mark = templeMark(piece.level, view.tilt)}
                <g transform="translate({centre.x} {centre.y})" class="piece">
                    <ellipse
                        cx="2"
                        cy="2"
                        rx={CELL * 0.5}
                        ry={CELL * 0.5 * view.tilt}
                        fill="url(#mx-piece-shadow)"
                    ></ellipse>
                    <image
                        href={LOOK_URLS[templeLook(piece.level, view.flat)]}
                        {...templeBounds(piece.level, view.tilt)}
                        preserveAspectRatio="none"
                    ></image>
                    <TempleMarks
                        {mark}
                        stair={DESIGN.stair}
                        fill={piece.playerId === undefined ? undefined : playerFill(piece.playerId)}
                    />
                </g>
            {:else}
                {@const lift = piece.onBridge ? view.lift(BRIDGE_RISE) : 0}
                {@const look = pilliLook(view.flat)}
                <g
                    transform="translate({centre.x} {centre.y + CELL * 0.1 * view.tilt - lift})"
                    class="piece"
                >
                    <ellipse
                        cx="1"
                        cy="1"
                        rx={CELL * 0.26}
                        ry={CELL * 0.26 * view.tilt}
                        fill="url(#mx-piece-shadow)"
                    ></ellipse>
                    <path
                        d={LOOK_OUTLINES[look]}
                        fill={playerFill(piece.playerId)}
                        fill-rule="evenodd"
                    ></path>
                    <image
                        href={LOOK_URLS[look]}
                        {...pilliBounds(view.tilt)}
                        preserveAspectRatio="none"
                    ></image>
                    <image
                        href={LOOK_URLS[pilliShineLook(view.flat)]}
                        {...pilliBounds(view.tilt)}
                        preserveAspectRatio="none"
                        opacity={shineOver(playerFill(piece.playerId))}
                    ></image>
                </g>
            {/if}
        {/each}

        <!-- The Emperor's commands: the districts still to be founded. -->
        <g class="display">
            <rect
                x={displayBox.x - 4}
                y={displayBox.y - 4}
                width={displayBox.width + 8}
                height={displayBox.height + 8}
                rx="8"
                class="display-frame"
            ></rect>
            {#each display as tokenId, index (tokenId)}
                {@const centre = slotCentre(index)}
                {@const [, second, third] = placePoints(tokenSize(tokenId))}
                <polygon points={octagon(view, centre, SLOT * 0.4)} class="token-side"></polygon>
                <polygon points={octagon(view, centre, SLOT * 0.4, 3)} class="token"></polygon>
                <text class="token-size" x={centre.x} y={centre.y - 6} dy="4.6" text-anchor="middle"
                    >{tokenSize(tokenId)}</text
                >
                <text
                    class="token-points"
                    x={centre.x}
                    y={centre.y + 6}
                    dy="2.8"
                    text-anchor="middle">{second} · {third}</text
                >
            {/each}
        </g>

        <!-- Hit areas over every cell, nearest last. -->
        {#each landCells as cell (cell)}
            {@const rect = view.cellBox(cell)}
            {@const active = choosable.has(cell)}
            <rect
                {...rect}
                class="hit"
                class:active
                role="button"
                tabindex={active ? 0 : -1}
                aria-disabled={!active}
                aria-label={cellName(cell)}
                onclick={() => void session.chooseCell(cell)}
                onkeydown={(event) => onKey(event, cell)}
                onpointerenter={(event) => {
                    if (event.pointerType !== 'touch') hovered = cell
                }}
                onpointerleave={() => (hovered = undefined)}
            ></rect>
        {/each}
        {#each [...layout.bridges.keys()] as cell (cell)}
            {@const rect = view.cellBox(cell)}
            {@const active = choosable.has(cell)}
            {#if active}
                <rect
                    {...rect}
                    class="hit active"
                    role="button"
                    tabindex="0"
                    aria-label={`Bridge at ${cellName(cell)}`}
                    onclick={() => void session.chooseCell(cell)}
                    onkeydown={(event) => onKey(event, cell)}
                ></rect>
            {/if}
        {/each}
        {#if session.tool === 'bridge' || session.tool === 'moveBridge'}
            {#each [...layout.canals] as cell (cell)}
                {@const rect = view.cellBox(cell)}
                {#if choosable.has(cell) && !layout.bridges.has(cell)}
                    <rect
                        {...rect}
                        class="hit active"
                        role="button"
                        tabindex="0"
                        aria-label={`Canal at ${cellName(cell)}`}
                        onclick={() => void session.chooseCell(cell)}
                        onkeydown={(event) => onKey(event, cell)}
                    ></rect>
                {/if}
            {/each}
        {/if}
        {#if hovered !== undefined && session.moves.get(hovered)}
            {@const move = session.moves.get(hovered)}
            {@const centre = view.centre(hovered)}
            <text class="cost" x={centre.x} y={centre.y - CELL * 0.42} dy="4.2" text-anchor="middle"
                >{move?.cost} AP</text
            >
        {/if}
    </svg>
</div>

<style>
    .tap-off {
        display: contents;
    }

    .mx-board {
        display: block;
    }

    .kerb {
        fill: #a88676;
    }

    .kerb-edge {
        fill: #6b5245;
    }

    .surface,
    .piece {
        pointer-events: none;
    }

    .label {
        font-size: 12px;
        fill: var(--mx-table-ink);
        letter-spacing: 0.5px;
        pointer-events: none;
    }

    .token-side {
        fill: var(--mx-token-side);
    }

    .token {
        fill: var(--mx-token);
        stroke: var(--mx-token-side);
        stroke-width: 0.8;
    }

    .token-size {
        font-size: 13px;
        font-weight: 700;
        fill: var(--mx-token-ink);
        pointer-events: none;
    }

    .token-points {
        font-size: 8px;
        fill: var(--mx-token-ink);
        pointer-events: none;
    }

    .display-frame {
        fill: rgb(0 0 0 / 0.12);
        stroke: rgb(255 255 255 / 0.35);
        stroke-width: 1;
    }

    .bridge {
        fill: var(--mx-bridge);
        stroke: var(--mx-bridge-ink);
        stroke-width: 0.8;
    }

    .bridge-far {
        fill: var(--mx-bridge-shade);
        stroke: var(--mx-bridge-ink);
        stroke-width: 0.8;
    }

    .bridge-near {
        fill: var(--mx-bridge-light);
        stroke: var(--mx-bridge-ink);
        stroke-width: 0.8;
    }

    .bridge-top {
        fill: var(--mx-bridge-top);
        stroke: var(--mx-bridge-ink);
        stroke-width: 0.8;
    }

    .mark-band {
        fill: none;
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 4;
        pointer-events: none;
    }

    .mark {
        fill: none;
        stroke: var(--mx-mark);
        stroke-width: 2;
        pointer-events: none;
    }

    .chosen {
        fill: none;
        stroke: var(--mx-mark);
        stroke-width: 2.5;
        pointer-events: none;
    }

    .hit {
        fill: transparent;
        outline: none;
    }

    .hit.active {
        cursor: pointer;
    }

    .hit.active:focus-visible {
        stroke: var(--mx-mark);
        stroke-width: 2;
    }

    .cost {
        font-size: 12px;
        font-weight: 700;
        fill: #fff;
        stroke: #000;
        stroke-width: 3;
        paint-order: stroke;
        pointer-events: none;
    }
</style>
