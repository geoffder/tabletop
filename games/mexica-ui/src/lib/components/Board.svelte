<script lang="ts">
    import { palaceBounds, palaceLook, palaceRise } from '$lib/board/palaceShape.js'
    import {
        Axis,
        type Cell,
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
    import { BRIDGE_RISE, CELL, type PlanStep } from '$lib/board/view.js'
    import type { Point } from '@tabletop/common'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { BANK_WIDTH, SIDES, waterworks } from '$lib/board/waterworks.js'
    import {
        bridgeLook,
        CANAL_LOOK,
        LAKE_LOOK,
        PAVING_LOOK,
        SHORE_LOOK,
        slopeCornerLook,
        slopeCoveLook,
        slopeLook,
        templeLook
    } from '$lib/board/looks.js'
    import { DESIGN, templeBounds } from '$lib/board/templeShape.js'
    import { templeMark } from '$lib/board/templeMarks.js'
    import TempleMarks from './TempleMarks.svelte'
    import { PLAN } from '$lib/board/plan.js'
    import {
        TOKEN,
        TOKEN_INK,
        TOKEN_ON_BOARD,
        tokenBounds,
        tokenFaceLift,
        tokenLook
    } from '$lib/board/tokenShape.js'
    import { BRIDGE, bridgeBounds } from '$lib/board/bridgeShape.js'
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
        | { kind: 'bridgeFront'; cell: Cell }

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
        // A bridge running across the screen has its near curb and rail drawn after any Pilli
        // Mexica standing on it.
        for (const bridge of game.bridges) {
            if (view.screenAxis(bridge.axis) === Axis.EastWest) {
                pieces.push({ kind: 'bridgeFront', cell: bridge.cell })
            }
        }
        const order = { bridge: 0, temple: 1, pilli: 2, bridgeFront: 3 }
        return pieces.sort(
            (a, b) => view.centre(a.cell).y - view.centre(b.cell).y || order[a.kind] - order[b.kind]
        )
    })

    // Neighbouring canal cells overlap a little, or their clipped edges leave a seam.
    const CLIP_OVERLAP = 0.5

    // Banks, quays, jetties and the island's shore for the canals dug so far.
    const works = $derived(waterworks(LAND_CELLS, layout.canals))
    const BANK = BANK_WIDTH

    const playerFill = (playerId?: string) =>
        playerId === undefined ? 'var(--mx-neutral)' : session.playerFill(playerId)
    // A Pilli Mexica's paint, toned a little towards the island's earth so the
    // figures sit among the stone.
    const pilliPaint = (fill: string) => `color-mix(in srgb, ${fill} 88%, #8c7f6a)`

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
    const palace = $derived(view.centre(PALACE_CENTRE))
</script>

<!-- A calpulli token, `radius` to its corners: its size, and below it the points for second
     and third place. -->
{#snippet calpulli(centre: Point, tokenId: number, radius: number)}
    {@const [, second, third] = placePoints(tokenSize(tokenId))}
    {@const face = -tokenFaceLift(view.tilt)}
    <g transform="translate({centre.x} {centre.y}) scale({radius / TOKEN.radius})" class="surface">
        <image
            href={LOOK_URLS[tokenLook(view.flat)]}
            {...tokenBounds(view.tilt)}
            preserveAspectRatio="none"
        ></image>
        <text
            class="token-size"
            y={face - 6 * view.tilt}
            dy="5.6"
            text-anchor="middle"
            fill={TOKEN_INK}>{tokenSize(tokenId)}</text
        >
        <text
            class="token-points"
            y={face + 9 * view.tilt}
            dy="3.5"
            text-anchor="middle"
            fill={TOKEN_INK}>{second} · {third}</text
        >
    </g>
{/snippet}

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
                {#each works.zones as zone (zone.key)}
                    <polygon points={zone.points}></polygon>
                {/each}
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
            {#each works.kerbs as kerb (kerb.key)}
                <rect {...kerb.stone} class="surface kerb"></rect>
                <rect {...kerb.edge} class="surface kerb-edge"></rect>
            {/each}
            {#each works.joins as join (join.key)}
                <polygon points={join.stone} class="surface kerb"></polygon>
                <polygon points={join.edge} class="surface kerb-edge"></polygon>
            {/each}
            {#each works.spills as spill (spill.key)}
                <image
                    href={LOOK_URLS[spill.look]}
                    {...spill.box}
                    preserveAspectRatio="none"
                    class="surface"
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
                <text class="label" x={label.at.x} y={label.at.y} dy="4.2" text-anchor="middle"
                    >{label.text}</text
                >
            {/each}
        {/if}

        {#each game.districts as district (district.tokenId)}
            {@render calpulli(view.centre(district.cell), district.tokenId, TOKEN_ON_BOARD)}
        {/each}

        <!-- Ground marks: where the chosen tool or the Pilli Mexica can go. -->
        {#each [...choosable] as cell (cell)}
            {@const centre = view.centre(cell)}
            {@const move = session.moves.get(cell)}
            {@const raised = centre.y - view.lift(palaceRise(cell))}
            {#if !move?.teleport}
                <ellipse
                    cx={centre.x}
                    cy={raised}
                    rx={CELL * 0.16}
                    ry={CELL * 0.16 * view.tilt}
                    class="mark-band"
                ></ellipse>
                <ellipse
                    cx={centre.x}
                    cy={raised}
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
                {@const axis = view.screenAxis(piece.axis)}
                {@const across = axis === Axis.EastWest}
                <g transform="translate({centre.x} {centre.y})" class="piece">
                    <ellipse
                        cx="2"
                        cy="2"
                        rx={across ? BRIDGE.reach : BRIDGE.half + 3}
                        ry={(across ? BRIDGE.half + 3 : BRIDGE.reach) * view.tilt}
                        fill="url(#mx-piece-shadow)"
                    ></ellipse>
                    <image
                        href={LOOK_URLS[bridgeLook(axis, view.flat, across ? 'back' : 'whole')]}
                        {...bridgeBounds(axis, view.tilt)}
                        preserveAspectRatio="none"
                    ></image>
                </g>
            {:else if piece.kind === 'bridgeFront'}
                <g transform="translate({centre.x} {centre.y})" class="piece">
                    <image
                        href={LOOK_URLS[bridgeLook(Axis.EastWest, view.flat, 'front')]}
                        {...bridgeBounds(Axis.EastWest, view.tilt)}
                        preserveAspectRatio="none"
                    ></image>
                </g>
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
                {@const lift = view.lift(piece.onBridge ? BRIDGE_RISE : palaceRise(piece.cell))}
                {@const look = pilliLook(view.flat)}
                <g
                    transform="translate({centre.x} {centre.y +
                        (piece.onBridge ? 0 : CELL * 0.1 * view.tilt) -
                        lift})"
                    class="piece"
                >
                    <ellipse
                        cx="1"
                        cy="1"
                        rx={CELL * 0.22}
                        ry={CELL * 0.22 * view.tilt}
                        fill="url(#mx-piece-shadow)"
                    ></ellipse>
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
                {@render calpulli(slotCentre(index), tokenId, TOKEN.radius)}
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

    .display-frame {
        fill: rgb(0 0 0 / 0.12);
        stroke: rgb(255 255 255 / 0.35);
        stroke-width: 1;
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
