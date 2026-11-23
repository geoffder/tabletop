<script lang="ts">
    import {
        BoardAnimator,
        BREAK_SIDES,
        type BreakSide
    } from '$lib/animators/boardAnimator.svelte.js'
    import { pilliSpot } from '$lib/board/pilliSpot.js'
    import { palaceBounds, palaceLook, palaceRise } from '$lib/board/palaceShape.js'
    import {
        Axis,
        type Cell,
        BOARD_HEIGHT,
        BOARD_WIDTH,
        cellAt,
        cellName,
        columnOf,
        isLand,
        LAND_CELLS,
        type Level,
        PALACE_CENTRE,
        rowOf,
        tokenSize,
        placePoints
    } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        BRIDGE_RISE,
        CELL,
        LABEL_SIZE,
        LABEL_WEIGHT,
        LAKE_MARGIN,
        type Box,
        type PlanStep
    } from '$lib/board/view.js'
    import type { Point } from '@tabletop/common'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import {
        BANK_WIDTH,
        SIDES,
        canalSurface,
        lastWaterworks,
        surfaceOf,
        type Waterworks
    } from '$lib/board/waterworks.js'
    import { polygonsPath, rectsPath, roundedRectsPath } from '$lib/board/mergedPaths.js'
    import {
        bridgeLook,
        CANAL_LOOK,
        LAKE_LOOK,
        PAVING_LOOK,
        PINCH_LOOK,
        SHORE_LOOK,
        slopeCornerLook,
        slopeCoveLook,
        slopeLook,
        templeLook
    } from '$lib/board/looks.js'
    import { DESIGN, templeBounds } from '$lib/board/templeShape.js'
    import { templeMark } from '$lib/board/templeMarks.js'
    import TempleMarks from './TempleMarks.svelte'
    import CommonSupply from './CommonSupply.svelte'
    import MaskIcon from './MaskIcon.svelte'
    import { PLAN, WATERS } from '$lib/board/plan.js'
    import { PINCH_SHEET, pinchBox, pinchesOf, pinchFrame } from '$lib/board/pinches.js'
    import {
        TOKEN,
        TOKEN_INK,
        TOKEN_ON_BOARD,
        TOKEN_ON_DISPLAY,
        DISPLAY_SLOT,
        tokenBounds,
        tokenFaceLift,
        tokenLook
    } from '$lib/board/tokenShape.js'
    import { BRIDGE, bridgeBounds } from '$lib/board/bridgeShape.js'
    import { LOOK_OUTLINES } from '$lib/board/lookOutlines.js'
    import {
        pilliBounds,
        pilliLook,
        pilliPaint,
        pilliShineLook,
        shineOver
    } from '$lib/board/pilliShape.js'

    // The space the board is fitted into, in screen pixels; the overlaid controls take a strip
    // of it at the foot.
    let { space }: { space?: { width: number; height: number } } = $props()

    const session = getGameSession()
    const view = $derived(session.view)
    const CONTROLS = 46
    const frame = $derived(view.frameWithControls(space, CONTROLS))

    const game = $derived(session.gameState)
    const layout = $derived(game.layout())

    type Raised =
        | { kind: 'temple'; cell: Cell; level: Level; playerId?: string }
        | { kind: 'pilli'; cell: Cell; playerId: string; onBridge: boolean }
        | { kind: 'bridge'; cell: Cell; axis: Axis }
        | { kind: 'bridgeFront'; cell: Cell }
        | { kind: 'mark'; cell: Cell; chosen: boolean }

    const animator = new BoardAnimator(
        session,
        () => view,
        (index) => slotCentre(index)
    )
    const drawn = $derived(animator.drawn)
    const decks = $derived(new Set(drawn.bridges.map((bridge) => bridge.cell)))

    // Everything standing on the board, far rows first so nearer pieces stand in front. A
    // walking Pilli Mexica is drawn in the order of the square it is crossing into; one riding
    // over another standing there goes behind it until past the square's middle.
    const raised: Raised[] = $derived.by(() => {
        const pieces: Raised[] = [
            ...drawn.bridges.map((bridge) => ({
                kind: 'bridge' as const,
                cell: bridge.cell,
                axis: bridge.axis
            })),
            ...drawn.temples.map((temple) => ({
                kind: 'temple' as const,
                cell: temple.cell,
                level: temple.level,
                playerId: temple.playerId
            })),
            ...drawn.pillis.map((pilli) => ({
                kind: 'pilli' as const,
                cell: pilli.cell,
                playerId: pilli.playerId,
                onBridge: decks.has(pilli.cell)
            }))
        ]
        // A bridge running across the screen has its near curb and rail drawn after any Pilli
        // Mexica standing on it.
        for (const bridge of drawn.bridges) {
            if (view.screenAxis(bridge.axis) === Axis.EastWest) {
                pieces.push({ kind: 'bridgeFront', cell: bridge.cell })
            }
        }
        // A choice on a bridge lies over the whole bridge, its near rail too, so it shows whole.
        for (const cell of choosable) {
            if (decks.has(cell)) pieces.push({ kind: 'mark', cell, chosen: false })
        }
        for (const cell of chosen) {
            if (decks.has(cell)) pieces.push({ kind: 'mark', cell, chosen: true })
        }
        const order = { bridge: 0, temple: 1, pilli: 2, bridgeFront: 3, mark: 4 }
        const drawnAt = (piece: Raised) =>
            piece.kind === 'pilli'
                ? (animator.walking.get(piece.playerId) ?? piece.cell)
                : piece.cell
        const walkingRank = (piece: Raised) =>
            piece.kind !== 'pilli' || !animator.walking.has(piece.playerId)
                ? 0
                : animator.ahead.has(piece.playerId)
                  ? 1
                  : -1
        return pieces.sort(
            (a, b) =>
                view.centre(drawnAt(a)).y - view.centre(drawnAt(b)).y ||
                order[a.kind] - order[b.kind] ||
                walkingRank(a) - walkingRank(b)
        )
    })
    const keyOf = (piece: Raised) =>
        piece.kind === 'pilli'
            ? `pilli-${piece.playerId}`
            : piece.kind === 'mark'
              ? `mark-${piece.chosen}-${piece.cell}`
              : `${piece.kind}-${piece.cell}`
    // How high a square's marks stand: on a bridge's deck, or on the palace.
    const markLift = (cell: Cell) => view.lift(decks.has(cell) ? BRIDGE_RISE : palaceRise(cell))

    // Neighbouring canal cells overlap a little, or their clipped edges leave a seam.
    const CLIP_OVERLAP = 0.5

    // The clips and kerbs as one path each: hundreds of small shapes, all still. Kept with the
    // works they come from, which come back for canals drawn before (an undone dig).
    const outlineCache = new WeakMap<Waterworks, ReturnType<typeof drawOutlines>>()
    function outlinesOf(works: Waterworks, canals: ReadonlySet<Cell>) {
        const found = outlineCache.get(works)
        if (found !== undefined) return found
        const drawnOutlines = drawOutlines(works, canals)
        outlineCache.set(works, drawnOutlines)
        return drawnOutlines
    }
    function drawOutlines(works: Waterworks, canals: ReadonlySet<Cell>) {
        return {
            canalClip: rectsPath(
                [...canals].map((cell) => ({
                    x: columnOf(cell) * CELL - CLIP_OVERLAP,
                    y: rowOf(cell) * CELL - CLIP_OVERLAP,
                    width: CELL + CLIP_OVERLAP * 2,
                    height: CELL + CLIP_OVERLAP * 2
                }))
            ),
            landClip: polygonsPath(works.zones.map((zone) => zone.points)),
            kerbStones: rectsPath(works.kerbs.map((kerb) => kerb.stone)),
            kerbEdges: rectsPath(works.kerbs.map((kerb) => kerb.edge)),
            joinStones: polygonsPath(works.joins.map((join) => join.stone)),
            joinEdges: polygonsPath(works.joins.map((join) => join.edge))
        }
    }

    // Banks, quays, jetties and the island's shore for the canals dug so far.
    const works = $derived(lastWaterworks(LAND_CELLS, drawn.canals))
    const surface = $derived(
        canalSurface(works, new Set(animator.floods.flatMap((flood) => flood.cells)))
    )
    const pinches = $derived(pinchesOf(drawn.canals))
    const outlines = $derived(outlinesOf(works, drawn.canals))
    const BANK = BANK_WIDTH
    // How much of the brick under the water is hidden by it.
    const WATER_OVER_BANK = 0.82

    const playerFill = (playerId?: string) =>
        playerId === undefined ? 'var(--mx-neutral)' : session.playerFill(playerId)

    // What a tap on each cell would do now.
    const choosable: ReadonlySet<Cell> = $derived.by(() => {
        if (session.canChooseStart) return session.startCells
        if (session.tool !== undefined) return session.targets
        return new Set(session.moves.keys())
    })

    // The canal's first square, which a second tap digs alone or lets go of.
    const retaps = $derived(session.tool === 'canal' ? session.chosenCell : undefined)

    // The bridge picked up to move, held a little above its canal instead of marked.
    const heldBridge = $derived(
        session.tool === 'moveBridge' &&
            session.chosenCell !== undefined &&
            layout.bridges.has(session.chosenCell)
            ? session.chosenCell
            : undefined
    )

    const chosen = $derived(
        [session.chosenCell, session.chosenDestination].filter(
            (cell): cell is Cell => cell !== undefined && cell !== heldBridge
        )
    )

    // The canal's chosen first square and the neighbours that finish a double with it.
    const canalStart = $derived.by(() => {
        const first = session.tool === 'canal' ? session.chosenCell : undefined
        if (first === undefined) return undefined
        return {
            cell: first,
            doubles: [...session.targets].filter((cell) => cell !== first)
        }
    })

    // From a canal's first square, an arrow across the border to each neighbour that finishes a
    // double, as GIPF's push arrows, starting and ending this far from the squares' middles.
    const ARROW_CLEAR = 9
    const ARROW_WING = 5.5

    // Plan points on the ground, whose y the tilt shortens on screen.
    function canalArrow(from: Cell, to: Cell): string {
        const tilt = view.tilt
        const a = view.centre(from)
        const b = view.centre(to)
        const [ax, ay, bx, by] = [a.x, a.y / tilt, b.x, b.y / tilt]
        const length = Math.hypot(bx - ax, by - ay)
        const ux = (bx - ax) / length
        const uy = (by - ay) / length
        const clear = ARROW_CLEAR
        const at = (x: number, y: number) => `${x} ${y * tilt}`
        const [tx, ty] = [bx - ux * clear, by - uy * clear]
        const [sx, sy] = [ax + ux * clear, ay + uy * clear]
        const w = ARROW_WING
        return `M ${at(sx, sy)} L ${at(tx, ty)} M ${at(tx - ux * w - uy * w, ty - uy * w + ux * w)} L ${at(tx, ty)} L ${at(tx - ux * w + uy * w, ty - uy * w - ux * w)}`
    }

    // A point on a canal square, `along` the way a bridge would run and `across` it, in board
    // units from its middle.
    function onSpan(cell: Cell, axis: Axis, along: number, across: number) {
        const ew = axis === Axis.EastWest
        const dc = (ew ? along : across) / CELL
        const dr = (ew ? across : along) / CELL
        const p = view.at(columnOf(cell) + 0.5 + dc, rowOf(cell) + 0.5 + dr)
        return `${p.x} ${p.y - markLift(cell)}`
    }

    // Where a bridge would stand on a canal square, spanning it from bank to bank.
    function spanOutline(cell: Cell, axis: Axis): string {
        const reach = BRIDGE.reach
        const half = BRIDGE.half * 0.75
        return `M ${onSpan(cell, axis, -reach, -half)} L ${onSpan(cell, axis, reach, -half)} L ${onSpan(cell, axis, reach, half)} L ${onSpan(cell, axis, -reach, half)} Z`
    }

    // A 5-point teleport's dot, in board units, and the opacities of its dark edge and its fill:
    // it reaches every free square, so it stays quieter than a walk's spot.
    const TELEPORT_DOT = { radius: 2.4, edge: 0.35, fill: 0.85 }

    // A founding's squares, marked in the calpulli token's shape, `radius` to its corners.
    const FOUNDING_MARK = 18

    // The edge of the district a temple can go in, along the sides of its squares that face out.
    const districtEdge = $derived.by(() => {
        const cells = session.templeDistrict
        const inside = new Set(cells.map((cell) => `${columnOf(cell)},${rowOf(cell)}`))
        const has = (c: number, r: number) => inside.has(`${c},${r}`)
        const at = (c: number, r: number) => {
            const p = view.at(c, r)
            return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`
        }
        const sides: string[] = []
        for (const cell of cells) {
            const [c, r] = [columnOf(cell), rowOf(cell)]
            if (!has(c, r - 1)) sides.push(`M ${at(c, r)} L ${at(c + 1, r)}`)
            if (!has(c, r + 1)) sides.push(`M ${at(c, r + 1)} L ${at(c + 1, r + 1)}`)
            if (!has(c - 1, r)) sides.push(`M ${at(c, r)} L ${at(c, r + 1)}`)
            if (!has(c + 1, r)) sides.push(`M ${at(c + 1, r)} L ${at(c + 1, r + 1)}`)
        }
        return sides.join(' ')
    })

    // An octagon `r` to its corners round the origin, lying on the ground, flat sides square to
    // the board, as a calpulli token lies.
    function octagonPath(r: number): string {
        const points = Array.from({ length: 8 }, (_, k) => {
            const angle = Math.PI / 8 + (k * Math.PI) / 4
            return `${(r * Math.cos(angle)).toFixed(2)} ${(r * Math.sin(angle) * view.tilt).toFixed(2)}`
        })
        return `M${points.join('L')}Z`
    }

    // A walk's spot, in board units.
    const WALK_SPOT = 6

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

    // The Emperor's commands, in the lake at the top right, as far from its top edge on screen
    // as from its right edge, however tilted.
    const display = $derived(drawn.display)
    // How far the trays keep from the lake's right edge, in plan columns.
    const TRAY_RIGHT = 0.37
    const DISPLAY = {
        left: BOARD_WIDTH + LAKE_MARGIN / CELL - TRAY_RIGHT - DISPLAY_SLOT * 4,
        slot: DISPLAY_SLOT,
        columns: 4,
        rows: 2
    }
    const displayTop = $derived(-LAKE_MARGIN / CELL + TRAY_RIGHT / view.tilt)
    const displayBox = $derived(
        view.planBox(
            DISPLAY.left,
            displayTop,
            DISPLAY.left + DISPLAY.slot * DISPLAY.columns,
            displayTop + DISPLAY.slot * DISPLAY.rows
        )
    )
    // An octagon round a token on the display, on the ground, flat sides square to the board.
    const foundingRing = $derived.by(() => {
        const r = (TOKEN_ON_DISPLAY + 4) / Math.cos(Math.PI / 8)
        const points = Array.from({ length: 8 }, (_, k) => {
            const angle = Math.PI / 8 + (k * Math.PI) / 4
            return `${r * Math.cos(angle)} ${r * Math.sin(angle) * view.tilt}`
        })
        return `M${points.join('L')}Z`
    })
    function slotCentre(index: number) {
        return view.at(
            DISPLAY.left + DISPLAY.slot * ((index % DISPLAY.columns) + 0.5),
            displayTop + DISPLAY.slot * (Math.floor(index / DISPLAY.columns) + 0.5)
        )
    }

    // The pieces everyone draws on, in the lake at the bottom right, as far from its bottom
    // edge on screen as from its right edge. Each piece's slot fits the piece, as a share of
    // `slot`, so the frame keeps off the land.
    const SUPPLY = { scale: 1.4, slots: [0.72, 1.1, 0.95, 0.95] }
    const SUPPLY_SLOT = 1.42 * SUPPLY.scale
    const supply = $derived.by(() => {
        const spans = SUPPLY.slots.map((share) => share * SUPPLY_SLOT)
        const width = spans.reduce((sum, span) => sum + span, 0)
        const left = BOARD_WIDTH + LAKE_MARGIN / CELL - TRAY_RIGHT - width
        const top = BOARD_HEIGHT + LAKE_MARGIN / CELL - TRAY_RIGHT / view.tilt - SUPPLY_SLOT
        let start = left
        const centres = spans.map((span) => {
            const centre = view.at(start + span / 2, top + SUPPLY_SLOT / 2)
            start += span
            return centre
        })
        return { frame: view.planBox(left, top, left + width, top + SUPPLY_SLOT), centres }
    })

    // The crack a ruled-out token breaks along, top to bottom through its middle, and the side of
    // it either half keeps.
    const CRACK = [
        [3, -60],
        [2, -34],
        [-3, -22],
        [4, -11],
        [-2, -1],
        [3, 8],
        [-4, 18],
        [1, 30],
        [1, 60]
    ]
    function crackSide(side: BreakSide): string {
        const edge = side === 'left' ? -60 : 60
        return `M${edge} -60${CRACK.map(([x, y]) => `L${x} ${y}`).join('')}L${edge} 60Z`
    }

    // A district's award at a period's end, in board units.
    const CHIP = { width: 34, height: 22, text: 17 }

    // The "+N" a founding's points rise as, in board units.
    const GAIN_SIZE = 22

    const landCells = LAND_CELLS
    const palace = $derived(view.centre(PALACE_CENTRE))

    // A square's mark, inset from its edges, at the height of its top.
    function markTile(cell: Cell): Box {
        const box = view.cellBox(cell)
        return {
            x: box.x + 4,
            y: box.y + 4 * view.tilt - markLift(cell),
            width: box.width - 8,
            height: box.height - 8 * view.tilt
        }
    }

    // A canal's or a temple's squares are many: on the ground their washes are one path, so the
    // marks that come back after each dig or Undo are one element rather than one per square.
    // Squares on a bridge's deck keep their own, drawn with the bridge.
    const washed: ReadonlySet<Cell> = $derived(
        session.tool === 'canal' || typeof session.tool === 'number'
            ? new Set(
                  [...choosable].filter(
                      (cell) => !decks.has(cell) && session.spanAxes(cell).length === 0
                  )
              )
            : new Set()
    )
    const washPath = $derived(roundedRectsPath([...washed].map(markTile), 2))
</script>

<!-- Where the chosen tool or the Pilli Mexica can go, at the height of the square's top. -->
{#snippet choiceMark(cell: Cell)}
    {@const move = session.moves.get(cell)}
    {#if !move?.teleport}
        {@const tile = markTile(cell)}
        {@const axes = session.spanAxes(cell)}
        {#if axes.length > 0}
            {#each axes as axis (axis)}
                {#each ['under', 'over'] as layer (layer)}
                    <path d={spanOutline(cell, axis)} class="span {layer}" {@attach animator.mark()}
                    ></path>
                {/each}
            {/each}
        {:else if session.tool === 'found'}
            {@const c = view.centre(cell)}
            <g transform="translate({c.x} {c.y - markLift(cell)})">
                {#each ['under', 'over'] as layer (layer)}
                    <path
                        d={octagonPath(FOUNDING_MARK)}
                        class="walk {layer}"
                        {@attach animator.mark()}
                    ></path>
                {/each}
            </g>
        {:else if (move !== undefined && session.tool === undefined) || session.canChooseStart}
            <!-- Walks are many and reach onto bridges, where a wash would not show: a spot. -->
            {@const cx = tile.x + tile.width / 2}
            {@const cy = tile.y + tile.height / 2}
            {#each ['under', 'over'] as layer (layer)}
                <ellipse
                    {cx}
                    {cy}
                    rx={WALK_SPOT}
                    ry={WALK_SPOT * view.tilt}
                    class="walk {layer}"
                    {@attach animator.mark()}
                ></ellipse>
            {/each}
            {#if session.moveCosts && move !== undefined}
                <!-- What the move costs, in a badge on the spot's ring at its upper right. -->
                {@const bx = cx + WALK_SPOT * Math.SQRT1_2}
                {@const by = cy - WALK_SPOT * view.tilt * Math.SQRT1_2}
                <circle cx={bx} cy={by} r="5.2" class="cost-badge" {@attach animator.mark()}
                ></circle>
                <text
                    x={bx}
                    y={by}
                    dy="2.9"
                    text-anchor="middle"
                    class="cost-number"
                    {@attach animator.mark()}>{move.cost}</text
                >
            {/if}
        {:else if session.tool === 'moveBridge' && layout.bridges.has(cell)}
            {@const bridge = layout.bridges.get(cell)}
            {#if bridge !== undefined}
                {#each ['under', 'over'] as layer (layer)}
                    <path
                        d={spanOutline(cell, bridge.axis)}
                        class="span {layer}"
                        {@attach animator.mark()}
                    ></path>
                {/each}
            {/if}
        {:else if session.tool === 'canal' || typeof session.tool === 'number'}
            <!-- A canal's or a temple's squares are many: a wash alone, so the board stays
                 readable. -->
            <rect {...tile} rx="2" class="wash" {@attach animator.mark()}></rect>
        {:else}
            <rect {...tile} rx="2" class="mark-band" {@attach animator.mark()}></rect>
            <rect {...tile} rx="2" class="mark" {@attach animator.mark()}></rect>
        {/if}
    {:else}
        {@const c = view.centre(cell)}
        <!-- Its edge painted first and the fill over it, as an edge and a fill drawn apart would
             be, in one element: the dots are many. -->
        <ellipse
            cx={c.x}
            cy={c.y - markLift(cell)}
            rx={TELEPORT_DOT.radius}
            ry={TELEPORT_DOT.radius * view.tilt}
            class="teleport"
            stroke-opacity={TELEPORT_DOT.edge}
            fill-opacity={TELEPORT_DOT.fill}
            {@attach animator.mark()}
        ></ellipse>
    {/if}
{/snippet}

<!-- A square already chosen. -->
{#snippet chosenMark(cell: Cell)}
    {@const box = view.cellBox(cell)}
    {@const bridge = layout.bridges.get(cell)}
    {@const axes = bridge !== undefined ? [bridge.axis] : session.axisChoices}
    {#if session.tool === 'bridge' || session.tool === 'moveBridge'}
        {#each axes as axis (axis)}
            {#each ['under', 'over'] as layer (layer)}
                <path
                    d={spanOutline(cell, axis)}
                    class="span chosen-span {layer}"
                    {@attach animator.mark()}
                ></path>
            {/each}
        {/each}
    {:else}
        {@const tile = {
            x: box.x + 3,
            y: box.y + 3 * view.tilt - markLift(cell),
            width: box.width - 6,
            height: box.height - 6 * view.tilt
        }}
        <rect {...tile} rx="2" class="mark-band" {@attach animator.mark()}></rect>
        <rect {...tile} rx="2" class="chosen" {@attach animator.mark()}></rect>
    {/if}
{/snippet}

<!-- A calpulli token, `radius` to its corners: its size, and below it the points for second
     and third place. -->
{#snippet calpulli(centre: Point, tokenId: number, radius: number)}
    {@const [, second, third] = placePoints(tokenSize(tokenId))}
    {@const face = -tokenFaceLift(view.tilt)}
    <g transform="translate({centre.x} {centre.y}) scale({radius / TOKEN.radius})" class="surface">
        <ellipse
            cx="3"
            cy="3"
            rx={TOKEN.radius * 1.25}
            ry={TOKEN.radius * 1.25 * view.tilt}
            fill="url(#mx-piece-shadow)"
        ></ellipse>
        <image
            href={LOOK_URLS[tokenLook(view.flat)]}
            {...tokenBounds(view.tilt)}
            preserveAspectRatio="none"
        ></image>
        <text
            class="token-size"
            y={face - 6.6 * view.tilt}
            dy="5.6"
            text-anchor="middle"
            fill={TOKEN_INK}>{tokenSize(tokenId)}</text
        >
        <text
            class="token-points"
            y={face + 7.6 * view.tilt}
            dy="3.5"
            text-anchor="middle"
            fill={TOKEN_INK}>{second} · {third}</text
        >
    </g>
{/snippet}

<div class="tap-off" role="presentation" onclick={onTap}>
    <svg
        class="mx-board"
        viewBox="{frame.x} {frame.y} {frame.width} {frame.height}"
        width={frame.width}
        height={frame.height}
        role="group"
        aria-label="The island of Tenochtitlan"
        {@attach animator.attach}
    >
        <defs>
            <!-- Either side of the jagged crack a ruled-out token breaks along, round its middle. -->
            {#each BREAK_SIDES as side (side)}
                <clipPath id="mx-crack-{side}" clipPathUnits="userSpaceOnUse">
                    <path d={crackSide(side)}></path>
                </clipPath>
            {/each}
            <clipPath id="mx-canal-clip">
                <path d={outlines.canalClip}></path>
            </clipPath>
            <!-- The bare earth at the bottom of a canal being dug: darker the deeper it lies
                 towards the middle, and speckled with grit. -->
            <radialGradient id="mx-canal-earth">
                <stop offset="0" stop-color="#2f2318"></stop>
                <stop offset="0.7" stop-color="#46341f"></stop>
                <stop offset="1" stop-color="#5a4429"></stop>
            </radialGradient>
            <pattern id="mx-canal-grit" patternUnits="userSpaceOnUse" width="9" height="7">
                <circle cx="1.5" cy="1.2" r="0.55" fill="#6f5638" opacity="0.7"></circle>
                <circle cx="6.2" cy="2.4" r="0.4" fill="#1d150d" opacity="0.6"></circle>
                <circle cx="3.8" cy="5.1" r="0.5" fill="#76603f" opacity="0.5"></circle>
                <circle cx="7.9" cy="6.1" r="0.35" fill="#1d150d" opacity="0.5"></circle>
            </pattern>
            {#each animator.floods as flood (flood.key)}
                <!-- Blurred and cut back to a hard edge, discs of water that meet run together. -->
                <filter
                    id="mx-goo-{flood.key}"
                    filterUnits="userSpaceOnUse"
                    x={flood.box.x - 8}
                    y={flood.box.y - 8}
                    width={flood.box.width + 16}
                    height={flood.box.height + 16}
                    color-interpolation-filters="sRGB"
                >
                    <feGaussianBlur stdDeviation="3"></feGaussianBlur>
                    <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10"
                    ></feColorMatrix>
                </filter>
                <!-- The paving over a canal being dug, eaten away by discs that run together. -->
                <mask
                    id="mx-dig-{flood.key}"
                    maskUnits="userSpaceOnUse"
                    x={flood.box.x}
                    y={flood.box.y}
                    width={flood.box.width}
                    height={flood.box.height}
                >
                    <rect {...flood.box} fill="white"></rect>
                    <g filter="url(#mx-goo-{flood.key})">
                        {#each flood.springs as spring, index (index)}
                            <circle
                                cx={spring.x}
                                cy={spring.y}
                                r="0"
                                fill="black"
                                {@attach animator.spring(flood.key, 'build', index)}
                            ></circle>
                        {/each}
                    </g>
                </mask>
                <!-- The earth at the bottom of a canal being dug, eaten away by discs that run
                     together as the water runs in. The water is the canal's own, drawn beneath. -->
                <mask
                    id="mx-fill-{flood.key}"
                    maskUnits="userSpaceOnUse"
                    x={flood.box.x - 8}
                    y={flood.box.y - 8}
                    width={flood.box.width + 16}
                    height={flood.box.height + 16}
                >
                    <rect
                        x={flood.box.x - 8}
                        y={flood.box.y - 8}
                        width={flood.box.width + 16}
                        height={flood.box.height + 16}
                        fill="white"
                    ></rect>
                    <g filter="url(#mx-goo-{flood.key})">
                        {#each flood.springs as spring, index (index)}
                            <circle
                                cx={spring.x}
                                cy={spring.y}
                                r="0"
                                fill="black"
                                {@attach animator.spring(flood.key, 'water', index)}
                            ></circle>
                        {/each}
                    </g>
                </mask>
                <!-- The water standing up its banks, coming in with the water. -->
                <mask
                    id="mx-wet-{flood.key}"
                    maskUnits="userSpaceOnUse"
                    x={flood.box.x - 8}
                    y={flood.box.y - 8}
                    width={flood.box.width + 16}
                    height={flood.box.height + 16}
                >
                    <g filter="url(#mx-goo-{flood.key})">
                        {#each flood.springs as spring, index (index)}
                            <circle
                                cx={spring.x}
                                cy={spring.y}
                                r="0"
                                fill="white"
                                {@attach animator.spring(flood.key, 'wet', index)}
                            ></circle>
                        {/each}
                    </g>
                </mask>
                <clipPath id="mx-wet-clip-{flood.key}">
                    <path d={surfaceOf(drawn.canals, flood.cells)}></path>
                </clipPath>
            {/each}
            <clipPath id="mx-water-surface">
                <path d={surface}></path>
            </clipPath>
            <clipPath id="mx-mouth-surface">
                <path d={works.mouthSurface}></path>
            </clipPath>
            <clipPath id="mx-land-clip">
                <path d={outlines.landClip}></path>
            </clipPath>
            <radialGradient id="mx-piece-shadow">
                <stop offset="0.55" stop-color="#2a1a08" stop-opacity="0.32"></stop>
                <stop offset="1" stop-color="#2a1a08" stop-opacity="0"></stop>
            </radialGradient>
            {#each SIDES as side (side)}
                {@const runs = side === 'n' || side === 's'}
                <pattern
                    id="mx-slope-{side}"
                    patternUnits="userSpaceOnUse"
                    width={runs ? CELL : BANK}
                    height={runs ? BANK : CELL}
                >
                    <image
                        href={LOOK_URLS[slopeLook(side)]}
                        width={runs ? CELL : BANK}
                        height={runs ? BANK : CELL}
                        preserveAspectRatio="none"
                    ></image>
                </pattern>
            {/each}
        </defs>

        <g transform={view.planTransform}>
            <image
                href={LOOK_URLS[LAKE_LOOK]}
                {...WATERS}
                preserveAspectRatio="none"
                class="surface"
            ></image>
            <g clip-path="url(#mx-land-clip)">
                <image
                    href={LOOK_URLS[SHORE_LOOK]}
                    {...WATERS}
                    preserveAspectRatio="none"
                    class="surface"
                ></image>
                <image
                    href={LOOK_URLS[PAVING_LOOK]}
                    {...WATERS}
                    preserveAspectRatio="none"
                    class="surface"
                ></image>
            </g>
            <!-- Where two districts touch only at a corner of the coast, the coast drawn back
                 from it, so the lake comes in between them. -->
            {#each pinches as corner (corner.key)}
                {@const frame = pinchFrame(corner)}
                <svg
                    {...pinchBox(corner)}
                    viewBox="{frame.x} {frame.y} {frame.width} {frame.height}"
                    preserveAspectRatio="none"
                    class="surface"
                >
                    <image href={LOOK_URLS[PINCH_LOOK]} {...PINCH_SHEET} preserveAspectRatio="none"
                    ></image>
                </svg>
            {/each}
            <image
                href={LOOK_URLS[CANAL_LOOK]}
                {...PLAN}
                preserveAspectRatio="none"
                clip-path="url(#mx-canal-clip)"
                class="surface"
            ></image>

            {#each works.banks as bank (bank.key)}
                <polygon points={bank.points} fill="url(#mx-slope-{bank.slope})" class="surface"
                ></polygon>
            {/each}
            {#each works.curves as curve (curve.key)}
                <image
                    href={LOOK_URLS[
                        curve.bend === 'inside'
                            ? slopeCoveLook(curve.corner)
                            : slopeCornerLook(curve.corner)
                    ]}
                    x={curve.x}
                    y={curve.y}
                    width={curve.size}
                    height={curve.size}
                    preserveAspectRatio="none"
                    class="surface"
                ></image>
            {/each}
            <path d={outlines.kerbStones} class="surface kerb"></path>
            <path d={outlines.kerbEdges} class="surface kerb-edge"></path>
            <path d={outlines.joinStones} class="surface kerb"></path>
            <path d={outlines.joinEdges} class="surface kerb-edge"></path>
            <!-- The water standing up the banks, over their feet: under a canal being dug's earth,
                 so it shows as the water runs in. -->
            <image
                href={LOOK_URLS[CANAL_LOOK]}
                {...PLAN}
                preserveAspectRatio="none"
                clip-path="url(#mx-water-surface)"
                opacity={WATER_OVER_BANK}
                class="surface"
            ></image>
            <image
                href={LOOK_URLS[LAKE_LOOK]}
                {...WATERS}
                preserveAspectRatio="none"
                clip-path="url(#mx-mouth-surface)"
                opacity={WATER_OVER_BANK}
                class="surface"
            ></image>
            <!-- The earth at the bottom of a canal being dug, which the water runs in over. -->
            {#each animator.floods as flood (flood.key)}
                <g mask="url(#mx-fill-{flood.key})" class="surface">
                    <path d={flood.footPath} fill="url(#mx-canal-earth)"></path>
                    <path d={flood.footPath} fill="url(#mx-canal-grit)"></path>
                </g>
                <image
                    href={LOOK_URLS[CANAL_LOOK]}
                    {...PLAN}
                    preserveAspectRatio="none"
                    clip-path="url(#mx-wet-clip-{flood.key})"
                    mask="url(#mx-wet-{flood.key})"
                    opacity={WATER_OVER_BANK}
                    class="surface"
                ></image>
            {/each}
            <!-- Rocks sliding over the brick where a shore is cut short, standing out of the
                 water. -->
            {#each works.spills as spill (spill.key)}
                <image
                    href={LOOK_URLS[spill.look]}
                    {...spill.box}
                    preserveAspectRatio="none"
                    class="surface"
                ></image>
            {/each}
            <!-- The paving over a canal being dug, which runs away to show it. -->
            {#each animator.floods as flood (flood.key)}
                <image
                    href={LOOK_URLS[PAVING_LOOK]}
                    {...WATERS}
                    preserveAspectRatio="none"
                    mask="url(#mx-dig-{flood.key})"
                    class="surface"
                    {@attach animator.floodPaving(flood.key)}
                ></image>
            {/each}
        </g>
        <g transform="translate({palace.x} {palace.y})" class="surface">
            <image
                href={LOOK_URLS[palaceLook(view.flat)]}
                {...palaceBounds(view.tilt)}
                preserveAspectRatio="none"
            ></image>
        </g>

        {#if session.showCoordinates}
            {#each view.labels as label (label.key)}
                <text
                    class="label"
                    x={label.at.x}
                    y={label.at.y}
                    dy={LABEL_SIZE * 0.35}
                    font-size={LABEL_SIZE}
                    font-weight={LABEL_WEIGHT}
                    text-anchor={label.anchor}>{label.text}</text
                >
            {/each}
        {/if}

        {#each drawn.districts as district (district.tokenId)}
            {@const at = view.centre(district.cell)}
            <g transform="translate({at.x} {at.y})">
                <g {@attach animator.piece(`token-${district.tokenId}`, 'body')}>
                    {@render calpulli({ x: 0, y: 0 }, district.tokenId, TOKEN_ON_BOARD)}
                </g>
            </g>
        {/each}

        <!-- Ground marks: where the chosen tool or the Pilli Mexica can go. -->
        {#if washPath !== ''}
            <path d={washPath} class="wash" {@attach animator.mark()}></path>
        {/if}
        {#each [...choosable].filter((cell) => !decks.has(cell) && !washed.has(cell)) as cell (cell)}
            {@render choiceMark(cell)}
        {/each}
        {#each chosen.filter((cell) => !decks.has(cell) && canalStart?.cell !== cell) as cell (cell)}
            {@render chosenMark(cell)}
        {/each}
        {#if districtEdge !== ''}
            <g class="district-edge" {@attach animator.mark()}>
                <path d={districtEdge} class="under"></path>
                <path d={districtEdge} class="over"></path>
            </g>
        {/if}
        {#if canalStart !== undefined}
            <g class="canal-arrows" {@attach animator.mark()}>
                {#each ['under', 'over'] as layer (layer)}
                    {#each canalStart.doubles as cell (cell)}
                        <path d={canalArrow(canalStart.cell, cell)} class="arrow {layer}"></path>
                    {/each}
                {/each}
            </g>
        {/if}

        <!-- Canoes the Pilli Mexica ride from bridge to bridge, under the bridges they pass. -->
        {#each animator.boats as boat (boat)}
            <g {@attach animator.boat(boat)} class="surface canoe"></g>
        {/each}

        {#each raised as piece (keyOf(piece))}
            {@const centre = view.centre(piece.cell)}
            {#if piece.kind === 'bridge'}
                {@const axis = view.screenAxis(piece.axis)}
                {@const across = axis === Axis.EastWest}
                <g transform="translate({centre.x} {centre.y})" class="piece">
                    <g {@attach animator.piece(`bridge-${piece.cell}`, 'shadow')}>
                        <ellipse
                            cx="2"
                            cy="2"
                            rx={across ? BRIDGE.reach : BRIDGE.half + 3}
                            ry={(across ? BRIDGE.half + 3 : BRIDGE.reach) * view.tilt}
                            fill="url(#mx-piece-shadow)"
                        ></ellipse>
                    </g>
                    <g {@attach animator.piece(`bridge-${piece.cell}`, 'body')}>
                        <g class="holdable" class:held={heldBridge === piece.cell}>
                            <image
                                href={LOOK_URLS[
                                    bridgeLook(axis, view.flat, across ? 'back' : 'whole')
                                ]}
                                {...bridgeBounds(axis, view.tilt)}
                                preserveAspectRatio="none"
                            ></image>
                        </g>
                    </g>
                </g>
            {:else if piece.kind === 'bridgeFront'}
                <g transform="translate({centre.x} {centre.y})" class="piece">
                    <g {@attach animator.piece(`bridge-${piece.cell}`, 'front')}>
                        <g class="holdable" class:held={heldBridge === piece.cell}>
                            <image
                                href={LOOK_URLS[bridgeLook(Axis.EastWest, view.flat, 'front')]}
                                {...bridgeBounds(Axis.EastWest, view.tilt)}
                                preserveAspectRatio="none"
                            ></image>
                        </g>
                    </g>
                </g>
            {:else if piece.kind === 'mark'}
                {#if piece.chosen}
                    {@render chosenMark(piece.cell)}
                {:else}
                    {@render choiceMark(piece.cell)}
                {/if}
            {:else if piece.kind === 'temple'}
                {@const mark = templeMark(piece.level, view.tilt)}
                <g transform="translate({centre.x} {centre.y})" class="piece">
                    <g {@attach animator.piece(`temple-${piece.cell}`, 'shadow')}>
                        <ellipse
                            cx="2"
                            cy="2"
                            rx={CELL * 0.5}
                            ry={CELL * 0.5 * view.tilt}
                            fill="url(#mx-piece-shadow)"
                        ></ellipse>
                    </g>
                    <g {@attach animator.piece(`temple-${piece.cell}`, 'body')}>
                        <!-- Traced in black so it stands off the paving: the stroke lies
                             under the stone, so only its outer half shows. -->
                        <path d={mark.path} class="temple-trace"></path>
                        <image
                            href={LOOK_URLS[templeLook(piece.level, view.flat)]}
                            {...templeBounds(piece.level, view.tilt)}
                            preserveAspectRatio="none"
                        ></image>
                        <TempleMarks
                            {mark}
                            stair={DESIGN.stair}
                            fill={piece.playerId === undefined
                                ? undefined
                                : playerFill(piece.playerId)}
                        />
                    </g>
                </g>
            {:else}
                {@const spot = pilliSpot(view, piece.cell, decks)}
                {@const look = pilliLook(view.flat)}
                {@const key = `pilli-${piece.playerId}`}
                <g transform="translate({spot.x} {spot.y})" class="piece">
                    <g {@attach animator.piece(key, 'whole')}>
                        <g {@attach animator.piece(key, 'shadow')}>
                            <ellipse
                                cx="1"
                                cy="1"
                                rx={CELL * 0.22}
                                ry={CELL * 0.22 * view.tilt}
                                fill="url(#mx-piece-shadow)"
                            ></ellipse>
                        </g>
                        <g {@attach animator.piece(key, 'body')}>
                            <path
                                d={LOOK_OUTLINES[look]}
                                fill={pilliPaint(playerFill(piece.playerId))}
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
                        <g
                            {@attach animator.canoeFront(`boat-${piece.playerId}`)}
                            class="canoe"
                            style:visibility="hidden"
                        ></g>
                        <clipPath id="mx-aboard-{piece.playerId}" clipPathUnits="userSpaceOnUse">
                            <path {@attach animator.aboardClip(`boat-${piece.playerId}`)}></path>
                        </clipPath>
                    </g>
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
                {@const at = slotCentre(index)}
                {#if tokenId === session.foundingToken}
                    <!-- The token the district can take: a choice like a square's, which picks
                         up the founding, or lets go of it. -->
                    <g
                        transform="translate({at.x} {at.y})"
                        role="button"
                        tabindex="0"
                        aria-label="Found the district with this token"
                        class="founding"
                        onclick={() => session.pickTool('found')}
                        onkeydown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                session.pickTool('found')
                            }
                        }}
                    >
                        <path d={foundingRing} class="mark-band" {@attach animator.mark()}></path>
                        <path
                            d={foundingRing}
                            class={session.tool === 'found' ? 'chosen' : 'mark'}
                            {@attach animator.mark()}
                        ></path>
                        <path d={foundingRing} class="founding-hit"></path>
                    </g>
                {/if}
                <g transform="translate({at.x} {at.y})">
                    {#if animator.breaking.includes(tokenId)}
                        <!-- Ruled out: the token in two halves along a crack, drifting apart. -->
                        {#each BREAK_SIDES as side (side)}
                            <g {@attach animator.half(tokenId, side)}>
                                <g clip-path="url(#mx-crack-{side})">
                                    {@render calpulli({ x: 0, y: 0 }, tokenId, TOKEN_ON_DISPLAY)}
                                </g>
                            </g>
                        {/each}
                    {:else}
                        <g {@attach animator.piece(`display-${tokenId}`, 'body')}>
                            {@render calpulli({ x: 0, y: 0 }, tokenId, TOKEN_ON_DISPLAY)}
                        </g>
                    {/if}
                </g>
            {/each}
        </g>

        <CommonSupply
            frame={supply.frame}
            centres={supply.centres}
            size={SUPPLY_SLOT * CELL * 0.7}
            badge={SUPPLY.scale}
        />

        <!-- Tokens on their way between the display and the board, over everything. -->
        {#each animator.flights as district (district.tokenId)}
            {@const at = view.centre(district.cell)}
            <g transform="translate({at.x} {at.y})">
                <g {@attach animator.piece(`flight-${district.tokenId}`, 'body')}>
                    {@render calpulli({ x: 0, y: 0 }, district.tokenId, TOKEN_ON_BOARD)}
                </g>
            </g>
        {/each}

        <!-- A period's end: each district's awards as chips in the players' colours. -->
        {#each animator.scorings as scoring (scoring.key)}
            <g transform="translate({scoring.x} {scoring.y})" class="surface">
                <g {@attach animator.scoring(scoring.key)} opacity="0">
                    {#each scoring.awards as award, index (award.playerId)}
                        {@const x = (index - (scoring.awards.length - 1) / 2) * (CHIP.width + 3)}
                        <rect
                            x={x - CHIP.width / 2}
                            y={-CHIP.height / 2}
                            width={CHIP.width}
                            height={CHIP.height}
                            rx={CHIP.height / 2}
                            fill={session.playerFill(award.playerId)}
                            class="chip"
                        ></rect>
                        <text
                            {x}
                            dy={CHIP.text * 0.35}
                            font-size={CHIP.text}
                            fill={session.playerInk(award.playerId)}
                            class="chip-points">+{award.points}</text
                        >
                    {/each}
                </g>
            </g>
        {/each}

        <!-- Points a founding earned, rising over the scoring players' Pilli Mexica. -->
        {#each animator.gains as gain (gain.playerId)}
            <g transform="translate({gain.x} {gain.y})" class="surface">
                <g {@attach animator.gain(gain.playerId)} opacity="0">
                    <text class="gain" dy={GAIN_SIZE * 0.35} font-size={GAIN_SIZE}
                        >+{gain.points}</text
                    >
                </g>
            </g>
        {/each}

        <!-- Hit areas over every cell, nearest last. -->
        {#each landCells as cell (cell)}
            {@const rect = view.cellBox(cell)}
            {@const active = choosable.has(cell) || retaps === cell}
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
                    onpointerenter={(event) => {
                        if (event.pointerType !== 'touch') hovered = cell
                    }}
                    onpointerleave={() => (hovered = undefined)}
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
        <!-- With Move costs on, the badges already say it. -->
        {#if hovered !== undefined && session.moves.get(hovered) && !session.moveCosts}
            {@const move = session.moves.get(hovered)}
            {@const centre = view.centre(hovered)}
            {@const cost = move?.cost ?? 0}
            {@const x = centre.x}
            {@const y = centre.y - markLift(hovered) - CELL * 0.42}
            <!-- An ivory pill holding an action point's mask and the cost. -->
            <g class="hover-cost" {@attach animator.mark()}>
                <rect x={x - 15} y={y - 8.5} width="30" height="17" rx="8.5" class="pill-rim"
                ></rect>
                <rect x={x - 15} y={y - 8.5} width="30" height="17" rx="8.5" class="pill"></rect>
                <g transform="translate({x - 13.5} {y - 7})">
                    <MaskIcon size={14} />
                </g>
                <text x={x + 7} {y} dy="3.8" text-anchor="middle" class="pill-cost">{cost}</text>
            </g>
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

    /* The animator draws a canoe's faces, each edged in its own fill. */
    .canoe :global(path) {
        stroke-width: 0.3;
        stroke-linejoin: round;
    }

    .label {
        fill: var(--mx-table-ink);
        letter-spacing: 0.5px;
        pointer-events: none;
    }

    .token-size {
        font-size: 16px;
        font-weight: 700;
        pointer-events: none;
    }

    .token-points {
        font-size: 10px;
        font-weight: 600;
        pointer-events: none;
    }

    .chip {
        stroke: #1c1712;
        stroke-width: 1.4;
    }

    .chip-points {
        font-weight: 800;
        text-anchor: middle;
    }

    .gain {
        font-weight: 800;
        text-anchor: middle;
        fill: #fff8ec;
        stroke: #1c1712;
        stroke-width: 3.5;
        stroke-linejoin: round;
        paint-order: stroke;
    }

    .temple-trace {
        fill: none;
        stroke: #1c1712;
        stroke-width: 1.6;
        stroke-linejoin: round;
    }

    .display-frame {
        fill: rgb(0 0 0 / 0.12);
        stroke: rgb(255 255 255 / 0.35);
        stroke-width: 1;
    }

    /* A choice: its square washed in cyan and outlined over a dark band; the chosen square more
       strongly. */
    .mark-band {
        fill: none;
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 4;
        pointer-events: none;
    }

    .mark {
        fill: rgb(94 240 255 / 0.22);
        stroke: var(--mx-mark);
        stroke-width: 1.6;
        pointer-events: none;
    }

    .founding {
        cursor: pointer;
        outline: none;
    }

    .founding-hit {
        fill: transparent;
        pointer-events: all;
    }

    /* Two-tone as GIPF's push arrows: a dark band under a cyan core. */
    .canal-arrows {
        pointer-events: none;
    }

    .canal-arrows .arrow {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .canal-arrows .under {
        stroke: rgb(0 0 0 / 0.85);
        stroke-width: 4.2;
    }

    .canal-arrows .over {
        stroke: var(--mx-mark);
        stroke-width: 2.4;
    }

    .span {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
    }

    .span.under {
        stroke: rgb(0 0 0 / 0.85);
        stroke-width: 4.2;
    }

    .span.over {
        stroke: var(--mx-mark);
        stroke-width: 2.4;
    }

    .span.under {
        fill: rgb(94 240 255 / 0.22);
    }

    .walk {
        pointer-events: none;
    }

    .walk.under {
        fill: rgb(94 240 255 / 0.22);
        stroke: rgb(0 0 0 / 0.85);
        stroke-width: 3.4;
    }

    .walk.over {
        fill: none;
        stroke: var(--mx-mark);
        stroke-width: 1.7;
    }

    .teleport {
        fill: var(--mx-mark);
        stroke: #000;
        stroke-width: 2.2;
        paint-order: stroke;
        pointer-events: none;
    }

    .span.chosen-span.under {
        fill: rgb(94 240 255 / 0.42);
        stroke-width: 5;
    }

    .span.chosen-span.over {
        stroke-width: 3;
    }

    .district-edge {
        fill: none;
        stroke-linecap: round;
        pointer-events: none;
    }

    .district-edge .under {
        stroke: rgb(0 0 0 / 0.85);
        stroke-width: 4.2;
    }

    .district-edge .over {
        stroke: var(--mx-mark);
        stroke-width: 2.4;
    }

    .holdable {
        transition:
            transform 0.15s ease-out,
            opacity 0.15s ease-out;
    }

    .holdable.held {
        transform: translateY(-10px);
        opacity: 0.65;
    }

    .wash {
        fill: rgb(94 240 255 / 0.28);
        pointer-events: none;
    }

    .chosen {
        fill: rgb(94 240 255 / 0.42);
        stroke: var(--mx-mark);
        stroke-width: 2.6;
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

    .cost-badge {
        fill: #1d2a33;
        stroke: var(--mx-mark);
        stroke-width: 1.2;
        pointer-events: none;
    }

    .cost-number {
        font-size: 7.5px;
        font-weight: 800;
        fill: #fff;
        pointer-events: none;
    }

    .hover-cost {
        pointer-events: none;
    }

    .pill-rim {
        fill: none;
        stroke: rgb(0 0 0 / 0.85);
        stroke-width: 2.6;
    }

    .pill {
        fill: var(--mx-panel);
        stroke: var(--mx-mark);
        stroke-width: 1.2;
    }

    .pill-cost {
        font-size: 10.5px;
        font-weight: 800;
        fill: #1d2a33;
    }
</style>
