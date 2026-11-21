<script lang="ts">
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import { pilliSpot } from '$lib/board/pilliSpot.js'
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
    import { BANK_WIDTH, SIDES, surfaceOf, waterworks } from '$lib/board/waterworks.js'
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
    import { PLAN, WATERS } from '$lib/board/plan.js'
    import { PINCH_SHEET, pinchBox, pinchesOf, pinchFrame } from '$lib/board/pinches.js'
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

    const animator = new BoardAnimator(session, () => view)
    const drawn = $derived(animator.drawn)
    const decks = $derived(new Set(drawn.bridges.map((bridge) => bridge.cell)))

    // Everything standing on the board, far rows first so nearer pieces stand in front. A
    // walking Pilli Mexica is drawn in the order of the square it is crossing into.
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
        const order = { bridge: 0, temple: 1, pilli: 2, bridgeFront: 3 }
        const drawnAt = (piece: Raised) =>
            piece.kind === 'pilli'
                ? (animator.walking.get(piece.playerId) ?? piece.cell)
                : piece.cell
        return pieces.sort(
            (a, b) =>
                view.centre(drawnAt(a)).y - view.centre(drawnAt(b)).y ||
                order[a.kind] - order[b.kind]
        )
    })
    const keyOf = (piece: Raised) =>
        piece.kind === 'pilli' ? `pilli-${piece.playerId}` : `${piece.kind}-${piece.cell}`

    // Neighbouring canal cells overlap a little, or their clipped edges leave a seam.
    const CLIP_OVERLAP = 0.5

    // Banks, quays, jetties and the island's shore for the canals dug so far.
    const works = $derived(
        waterworks(
            LAND_CELLS,
            drawn.canals,
            new Set(animator.floods.flatMap((flood) => flood.cells))
        )
    )
    const pinches = $derived(pinchesOf(drawn.canals))
    const BANK = BANK_WIDTH
    // How much of the brick under the water is hidden by it.
    const WATER_OVER_BANK = 0.82

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
        viewBox="{frame.x} {frame.y} {frame.width} {frame.height}"
        width={frame.width}
        height={frame.height}
        role="group"
        aria-label="The island of Tenochtitlan"
        {@attach animator.attach}
    >
        <defs>
            <clipPath id="mx-canal-clip">
                {#each [...drawn.canals] as cell (cell)}
                    <rect
                        x={columnOf(cell) * CELL - CLIP_OVERLAP}
                        y={rowOf(cell) * CELL - CLIP_OVERLAP}
                        width={CELL + CLIP_OVERLAP * 2}
                        height={CELL + CLIP_OVERLAP * 2}
                    ></rect>
                {/each}
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
                <path d={works.surface}></path>
            </clipPath>
            <clipPath id="mx-mouth-surface">
                <path d={works.mouthSurface}></path>
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
                    dy="4.2"
                    text-anchor={label.anchor}>{label.text}</text
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
                {@const box = view.cellBox(cell)}
                {@const tile = {
                    x: box.x + 4,
                    y: box.y + 4 * view.tilt + raised - centre.y,
                    width: box.width - 8,
                    height: box.height - 8 * view.tilt
                }}
                <rect {...tile} rx="2" class="mark-band" {@attach animator.mark()}></rect>
                <rect {...tile} rx="2" class="mark" {@attach animator.mark()}></rect>
                {#if session.moveCosts && move !== undefined && session.tool === undefined}
                    <!-- What the move costs, in a badge at the square's far right corner. -->
                    <circle
                        cx={tile.x + tile.width - 1}
                        cy={tile.y + 1}
                        r="6.5"
                        class="cost-badge"
                        {@attach animator.mark()}
                    ></circle>
                    <text
                        x={tile.x + tile.width - 1}
                        y={tile.y + 1}
                        dy="3.4"
                        text-anchor="middle"
                        class="cost-number"
                        {@attach animator.mark()}>{move.cost}</text
                    >
                {/if}
            {/if}
        {/each}
        {#each chosen as cell (cell)}
            {@const box = view.cellBox(cell)}
            {@const lift = view.lift(palaceRise(cell))}
            <rect
                x={box.x + 3}
                y={box.y + 3 * view.tilt - lift}
                width={box.width - 6}
                height={box.height - 6 * view.tilt}
                rx="2"
                class="mark-band"
                {@attach animator.mark()}
            ></rect>
            <rect
                x={box.x + 3}
                y={box.y + 3 * view.tilt - lift}
                width={box.width - 6}
                height={box.height - 6 * view.tilt}
                rx="2"
                class="chosen"
                {@attach animator.mark()}
            ></rect>
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
                        <image
                            href={LOOK_URLS[bridgeLook(axis, view.flat, across ? 'back' : 'whole')]}
                            {...bridgeBounds(axis, view.tilt)}
                            preserveAspectRatio="none"
                        ></image>
                    </g>
                </g>
            {:else if piece.kind === 'bridgeFront'}
                <g transform="translate({centre.x} {centre.y})" class="piece">
                    <g {@attach animator.piece(`bridge-${piece.cell}`, 'front')}>
                        <image
                            href={LOOK_URLS[bridgeLook(Axis.EastWest, view.flat, 'front')]}
                            {...bridgeBounds(Axis.EastWest, view.tilt)}
                            preserveAspectRatio="none"
                        ></image>
                    </g>
                </g>
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
            <text
                class="cost"
                {@attach animator.mark()}
                x={centre.x}
                y={centre.y - CELL * 0.42}
                dy="4.2"
                text-anchor="middle">{move?.cost} AP</text
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
        font-size: 9.5px;
        font-weight: 800;
        fill: #fff;
        pointer-events: none;
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
