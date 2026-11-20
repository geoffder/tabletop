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
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { CANAL_LOOK, LAKE_LOOK, PAVING_LOOK, templeLook } from '$lib/board/looks.js'
    import { DESIGN, templeBounds } from '$lib/board/templeShape.js'
    import { templeMark } from '$lib/board/templeMarks.js'
    import TempleMarks from './TempleMarks.svelte'
    import { PLAN } from '$lib/board/plan.js'
    import { bridgePaths, octagon } from '$lib/board/shapes.js'
    import { LOOK_OUTLINES } from '$lib/board/lookOutlines.js'
    import { pilliBounds, pilliLook } from '$lib/board/pilliShape.js'

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

    const WALL = 0.22
    // Neighbouring canal cells overlap a little, or their clipped edges leave a seam.
    const CLIP_OVERLAP = 0.5
    const WALL_SHADOW = 7

    const isWaterAt = (cell: Cell, step: PlanStep) => {
        const next = cellAt(columnOf(cell) + step.column, rowOf(cell) + step.row)
        return next === undefined || !isLand(next) || layout.canals.has(next)
    }

    // A wall drops from each stretch of land to the water just in front of it on screen, and the
    // land shades the water beyond it from the light at the upper left.
    const shore = $derived.by(() => {
        const height = view.lift(WALL)
        const ground = LAND_CELLS.filter((cell) => !layout.canals.has(cell))
        const walls = ground
            .filter((cell) => isWaterAt(cell, view.nearer))
            .map((cell) => {
                const box = view.cellBox(cell)
                const bottom = box.y + box.height
                return {
                    cell,
                    face: { x: box.x - 0.3, y: bottom, width: box.width + 0.6, height },
                    shadow: {
                        x: box.x - 0.3,
                        y: bottom + height,
                        width: box.width + 0.6,
                        height: WALL_SHADOW * view.tilt
                    }
                }
            })
        const sides = ground
            .filter((cell) => isWaterAt(cell, view.rightward))
            .map((cell) => {
                const box = view.cellBox(cell)
                return {
                    cell,
                    shadow: {
                        x: box.x + box.width,
                        y: box.y,
                        width: WALL_SHADOW,
                        height: box.height + height
                    }
                }
            })
        return { walls, sides }
    })

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
            <linearGradient id="mx-wall" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ddd3ba"></stop>
                <stop offset="0.25" stop-color="#bdb093"></stop>
                <stop offset="0.85" stop-color="#90846a"></stop>
                <stop offset="1" stop-color="#4f5a52"></stop>
            </linearGradient>
            <radialGradient id="mx-piece-shadow">
                <stop offset="0.55" stop-color="#2a1a08" stop-opacity="0.32"></stop>
                <stop offset="1" stop-color="#2a1a08" stop-opacity="0"></stop>
            </radialGradient>
            <linearGradient id="mx-side-shadow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#062c3a" stop-opacity="0.3"></stop>
                <stop offset="1" stop-color="#062c3a" stop-opacity="0"></stop>
            </linearGradient>
            <linearGradient id="mx-wall-shadow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#062c3a" stop-opacity="0.38"></stop>
                <stop offset="1" stop-color="#062c3a" stop-opacity="0"></stop>
            </linearGradient>
        </defs>

        <g transform={view.planTransform}>
            <image href={LOOK_URLS[LAKE_LOOK]} {...PLAN} preserveAspectRatio="none" class="surface"
            ></image>
            <image
                href={LOOK_URLS[PAVING_LOOK]}
                {...PLAN}
                preserveAspectRatio="none"
                class="surface"
            ></image>
            <image
                href={LOOK_URLS[CANAL_LOOK]}
                {...PLAN}
                preserveAspectRatio="none"
                clip-path="url(#mx-canal-clip)"
                class="surface"
            ></image>
        </g>
        {#each shore.sides as side (side.cell)}
            <rect {...side.shadow} fill="url(#mx-side-shadow)" class="surface"></rect>
        {/each}
        {#each shore.walls as wall (wall.cell)}
            <rect {...wall.shadow} fill="url(#mx-wall-shadow)" class="surface"></rect>
            <rect {...wall.face} fill="url(#mx-wall)" class="surface"></rect>
        {/each}

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
