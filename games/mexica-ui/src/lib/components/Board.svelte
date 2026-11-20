<script lang="ts">
    import {
        BOARD_HEIGHT,
        BOARD_WIDTH,
        type Cell,
        cellAt,
        cellName,
        columnOf,
        isPalace,
        isStart,
        LAND_CELLS,
        type Level,
        PALACE_CENTRE,
        rowOf,
        tokenSize,
        placePoints
    } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CELL, TILTED } from '$lib/board/view.js'
    import {
        bridgePaths,
        octagon,
        PILLI_PATH,
        PILLI_SCALE,
        PLUME_PATH,
        roofDots,
        templeTiers
    } from '$lib/board/shapes.js'

    const session = getGameSession()
    const view = TILTED

    // Room for labels on the left and top, and for the tallest pieces on the far row.
    const LEFT = 26
    const TOP = 30
    const RIGHT = 10
    const BOTTOM = 34
    const frame = {
        x: -LEFT,
        y: -TOP,
        width: view.width + LEFT + RIGHT,
        height: view.depth + TOP + BOTTOM
    }
    const viewBox = `${frame.x} ${frame.y} ${frame.width} ${frame.height}`

    const game = $derived(session.gameState)
    const layout = $derived(game.layout())

    type Raised =
        | { kind: 'temple'; cell: Cell; level: Level; playerId?: string }
        | { kind: 'pilli'; cell: Cell; playerId: string; onBridge: boolean }
        | { kind: 'bridge'; cell: Cell; axis: import('@tabletop/mexica').Axis }

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
        return pieces.sort((a, b) => rowOf(a.cell) - rowOf(b.cell) || order[a.kind] - order[b.kind])
    })

    const canalTiles = $derived(game.canals)

    function tileRect(cells: readonly Cell[]) {
        const columns = cells.map(columnOf)
        const rows = cells.map(rowOf)
        const inset = 0.05
        const left = Math.min(...columns) + inset
        const top = Math.min(...rows) + inset
        const right = Math.max(...columns) + 1 - inset
        const bottom = Math.max(...rows) + 1 - inset
        const a = view.at(left, top)
        const b = view.at(right, bottom)
        return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }
    }

    function cellRect(cell: Cell) {
        const corner = view.corner(cell)
        return { x: corner.x, y: corner.y, width: CELL, height: view.cellDepth }
    }

    const playerFill = (playerId?: string) =>
        playerId === undefined
            ? 'var(--mx-neutral)'
            : session.colors.getPlayerBgColorValue(playerId)

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
    const DISPLAY_ORIGIN = view.at(14.9, 10.8)
    const SLOT = 1.42 * CELL
    function slotCentre(index: number) {
        const column = index % 4
        const row = Math.floor(index / 4)
        return {
            x: DISPLAY_ORIGIN.x + SLOT * (column + 0.5),
            y: DISPLAY_ORIGIN.y + SLOT * view.tilt * (row + 0.5)
        }
    }

    const columns = Array.from({ length: BOARD_WIDTH }, (_, column) => column)
    const rows = Array.from({ length: BOARD_HEIGHT }, (_, row) => row)
    const landCells = LAND_CELLS
</script>

<div class="tap-off" role="presentation" onclick={onTap}>
    <svg
        class="mx-board"
        {viewBox}
        width={frame.width}
        height={frame.height}
        role="group"
        aria-label="The island of Tenochtitlan"
    >
        <rect x={0} y={0} width={view.width} height={view.depth} class="lake" rx="6"></rect>

        {#each columns as column (column)}
            <text class="label" x={view.at(column + 0.5, 0).x} y={-10} dy="4.2" text-anchor="middle"
                >{String.fromCharCode(65 + column)}</text
            >
        {/each}
        {#each rows as row (row)}
            <text
                class="label"
                x={-LEFT / 2}
                y={view.at(0, row + 0.5).y}
                dy="4.2"
                text-anchor="middle">{row + 1}</text
            >
        {/each}

        {#each landCells as cell (cell)}
            {@const rect = cellRect(cell)}
            <rect {...rect} class="land" class:palace={isPalace(cell)} class:start={isStart(cell)}
            ></rect>
        {/each}
        {#if PALACE_CENTRE !== undefined}
            {@const centre = view.centre(PALACE_CENTRE)}
            <ellipse
                cx={centre.x}
                cy={centre.y}
                rx={CELL * 0.3}
                ry={CELL * 0.3 * view.tilt}
                class="emblem"
            ></ellipse>
        {/if}

        {#each canalTiles as tile, index (index)}
            {@const rect = tileRect(tile.cells)}
            <rect {...rect} rx="3" class="canal"></rect>
            <rect
                x={rect.x}
                y={rect.y + rect.height - 2}
                width={rect.width}
                height="2"
                class="canal-edge"
            ></rect>
        {/each}

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
            {@const rect = cellRect(cell)}
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
                {@const paths = bridgePaths(view, centre, piece.axis)}
                {#if paths.far}<path d={paths.far} class="bridge-far"></path>{/if}
                <path d={paths.top} class="bridge-top"></path>
                {#if paths.near}<path d={paths.near} class="bridge-near"></path>{/if}
                {#if paths.body}<path d={paths.body} class="bridge"></path>{/if}
            {:else if piece.kind === 'temple'}
                {@const fill = playerFill(piece.playerId)}
                <ellipse
                    cx={centre.x}
                    cy={centre.y + 1}
                    rx={CELL * 0.46}
                    ry={CELL * 0.46 * view.tilt}
                    class="shadow"
                ></ellipse>
                {#each templeTiers(view, centre, piece.level) as tier, index (index)}
                    <rect {...tier.front} style:fill class="tier-front"></rect>
                    <rect {...tier.top} style:fill class="tier-top"></rect>
                {/each}
                {#each roofDots(view, centre, piece.level) as dot, index (index)}
                    <ellipse
                        cx={dot.x}
                        cy={dot.y}
                        rx={CELL * 0.035}
                        ry={CELL * 0.035 * view.tilt}
                        class="roof-dot"
                    ></ellipse>
                {/each}
            {:else}
                {@const lift = piece.onBridge ? view.lift(0.16) : 0}
                <ellipse
                    cx={centre.x}
                    cy={centre.y + 1 - lift}
                    rx={CELL * 0.26}
                    ry={CELL * 0.26 * view.tilt}
                    class="shadow"
                ></ellipse>
                <g
                    transform="translate({centre.x} {centre.y +
                        CELL * 0.1 * view.tilt -
                        lift}) scale({PILLI_SCALE})"
                >
                    <path d={PLUME_PATH} class="plume"></path>
                    <path d={PILLI_PATH} style:fill={playerFill(piece.playerId)} class="pilli"
                    ></path>
                </g>
            {/if}
        {/each}

        <!-- The Emperor's commands: the districts still to be founded. -->
        <g class="display">
            <rect
                x={DISPLAY_ORIGIN.x - 4}
                y={DISPLAY_ORIGIN.y - 4}
                width={SLOT * 4 + 8}
                height={SLOT * 2 * view.tilt + 8}
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
            {@const rect = cellRect(cell)}
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
            {@const rect = cellRect(cell)}
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
                {@const rect = cellRect(cell)}
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

    .lake {
        fill: var(--mx-lake);
    }

    .label {
        font-size: 12px;
        fill: var(--mx-table-ink);
        letter-spacing: 0.5px;
        pointer-events: none;
    }

    .land {
        fill: var(--mx-land);
        stroke: var(--mx-grid);
        stroke-width: 0.8;
    }

    .land.palace {
        fill: var(--mx-palace);
    }

    .land.start {
        fill: var(--mx-palace-start);
    }

    .emblem {
        fill: none;
        stroke: var(--mx-palace-ink);
        stroke-width: 1.5;
    }

    .canal {
        fill: var(--mx-canal);
        stroke: var(--mx-canal-ink);
        stroke-width: 0.8;
    }

    .canal-edge {
        fill: var(--mx-canal-ink);
        opacity: 0.5;
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

    .shadow {
        fill: rgb(30 20 10 / 0.22);
    }

    .tier-front {
        stroke: rgb(0 0 0 / 0.55);
        stroke-width: 0.8;
        filter: brightness(0.78);
    }

    .tier-top {
        stroke: rgb(0 0 0 / 0.55);
        stroke-width: 0.8;
    }

    .roof-dot {
        fill: rgb(0 0 0 / 0.55);
    }

    .bridge {
        fill: var(--mx-bridge);
        stroke: var(--mx-bridge-ink);
        stroke-width: 0.8;
    }

    .bridge-far {
        fill: var(--mx-bridge);
        stroke: var(--mx-bridge-ink);
        stroke-width: 0.8;
        filter: brightness(0.8);
    }

    .bridge-near {
        fill: var(--mx-bridge-top);
        stroke: var(--mx-bridge-ink);
        stroke-width: 0.8;
        filter: brightness(1.12);
    }

    .bridge-top {
        fill: var(--mx-bridge-top);
        stroke: var(--mx-bridge-ink);
        stroke-width: 0.8;
    }

    .pilli {
        stroke: #1b1510;
        stroke-width: 1.4;
        stroke-linejoin: round;
    }

    .plume {
        fill: var(--mx-plume);
        stroke: #1b1510;
        stroke-width: 1.2;
        stroke-linejoin: round;
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
