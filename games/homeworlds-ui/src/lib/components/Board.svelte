<script lang="ts">
    import { pieceSize, type PieceKind, PyramidColor } from '@tabletop/homeworlds'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { towerKey } from '$lib/model/session.svelte.js'
    import { onTable } from '$lib/board/view.js'
    import { starName } from '$lib/board/starNames.js'
    import { drawPyramid, PYRAMID_BASE, slantHeight } from '$lib/board/pyramid.js'
    import { type SystemPlacement, TURN_TOKEN_RADIUS } from '$lib/board/layout.js'
    import Pyramid from './Pyramid.svelte'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import { drawOrder, type DrawnPiece } from '$lib/board/pieces.js'
    import TurnToken from './TurnToken.svelte'
    import PowerMenu from './PowerMenu.svelte'

    // Bright enough to read on the dark table.
    const PLASTIC_INK: Record<PyramidColor, string> = {
        [PyramidColor.Red]: '#ff4a3d',
        [PyramidColor.Yellow]: '#ffd52a',
        [PyramidColor.Green]: '#36d45e',
        [PyramidColor.Blue]: '#6f78ff'
    }

    const SIZE_NAME = ['', 'Small', 'Medium', 'Large']

    const session = getGameSession()
    const animator = new BoardAnimator(session)
    const view = $derived(session.view)
    const layout = $derived(animator.layout)

    // Still pieces far first; pieces in flight over everything, so they pass over what they cross.
    const pieces: DrawnPiece[] = $derived.by(() => {
        const all = [...animator.pieces.values()]
        return [
            ...drawOrder(all.filter((drawn) => !animator.flying.has(drawn.piece))),
            ...drawOrder(all.filter((drawn) => animator.flying.has(drawn.piece)))
        ]
    })

    function at(x: number, y: number): string {
        const point = onTable(view, x, y)
        return `translate(${point.x} ${point.y})`
    }

    // Systems joined by a wormhole: no star of one the size of a star of the other.
    const lanes = $derived.by(() => {
        const sizes = (system: SystemPlacement) =>
            new Set(system.stars.map((star) => pieceSize(star.piece)))
        const result: { key: string; from: SystemPlacement; to: SystemPlacement }[] = []
        layout.systems.forEach((from, index) => {
            for (const to of layout.systems.slice(index + 1)) {
                const theirs = sizes(to)
                if ([...sizes(from)].every((size) => !theirs.has(size))) {
                    result.push({ key: `${from.id}-${to.id}`, from, to })
                }
            }
        })
        return result
    })

    const selectedSystem = $derived(
        session.selectedShip === undefined
            ? undefined
            : layout.systems.find((system) =>
                  system.ships.some((ship) => ship.piece === session.selectedShip)
              )
    )

    function laneState(from: SystemPlacement, to: SystemPlacement): 'open' | 'quiet' {
        const source = selectedSystem?.id
        if (source === undefined || session.moveTargets.size === 0) return 'quiet'
        return (from.id === source && session.moveTargets.has(to.id)) ||
            (to.id === source && session.moveTargets.has(from.id))
            ? 'open'
            : 'quiet'
    }

    function lanePath(from: SystemPlacement, to: SystemPlacement): string {
        const a = onTable(view, from.x, from.y)
        const b = onTable(view, to.x, to.y)
        // A gentle bow, so lanes between the same rows do not lie on top of one another.
        const bend = (b.x - a.x) * 0.12
        const mid = { x: (a.x + b.x) / 2 - (b.y - a.y) * 0.08, y: (a.y + b.y) / 2 + bend * 0.2 }
        return `M${a.x} ${a.y} Q${mid.x} ${mid.y} ${b.x} ${b.y}`
    }

    const shipsById = $derived(
        new Map(layout.systems.flatMap((system) => system.ships.map((ship) => [ship.piece, ship])))
    )

    const selectable = $derived(session.shipPowers)

    // The ring on the table round a lying ship, long along its heading.
    function shipRing(piece: number): string | undefined {
        const ship = shipsById.get(piece)
        if (!ship) return undefined
        const size = pieceSize(piece)
        const long = slantHeight(size) / 2 + 6
        const wide = PYRAMID_BASE[size] / 2 + 6
        const along = { x: Math.sin(ship.heading), y: Math.cos(ship.heading) }
        return Array.from({ length: 28 }, (_, step) => {
            const turn = (step / 28) * Math.PI * 2
            const a = Math.cos(turn) * long
            const b = Math.sin(turn) * wide
            const point = onTable(
                view,
                ship.x + a * along.x + b * along.y,
                ship.y + a * along.y - b * along.x
            )
            return `${point.x},${point.y}`
        }).join(' ')
    }

    function towerRing(kind: PieceKind) {
        const tower = layout.towers.find(
            (candidate) => candidate.color === kind.color && candidate.size === kind.size
        )
        if (!tower) return undefined
        const half = PYRAMID_BASE[tower.size] / 2 + 8
        return { x: tower.x, y: tower.y, rx: half, ry: half * view.tilt }
    }

    function starHalf(system: SystemPlacement): number {
        return Math.max(0, ...system.stars.map((star) => PYRAMID_BASE[pieceSize(star.piece)])) / 2
    }

    // A move target is marked round its star; the tap area is the whole system.
    function systemRing(system: SystemPlacement) {
        const half = starHalf(system) + 12
        return { x: system.x, y: system.y, rx: half, ry: half * view.tilt }
    }

    function outlinePoints(system: SystemPlacement): string {
        return system.outline
            .map((point) => onTable(view, point.x, point.y))
            .map((point) => `${point.x},${point.y}`)
            .join(' ')
    }

    // A system's name stands on the table just in front of its ring.
    function labelSpot(system: SystemPlacement) {
        const points = system.outline.map((point) => onTable(view, point.x, point.y))
        const nearest = points.reduce((best, point) => (point.y > best.y ? point : best))
        return { x: nearest.x, y: nearest.y + 15 }
    }

    function systemName(system: SystemPlacement): string {
        if (system.homeworldOf === undefined) return starName(system.id)
        return system.homeworldOf === session.myPlayer?.id
            ? 'Your homeworld'
            : `${session.getPlayerName(system.homeworldOf)}'s homeworld`
    }

    const catastrophes = $derived(
        session.overpopulations.flatMap((over) => {
            const system = layout.systems.find((candidate) => candidate.id === over.systemId)
            return system ? [{ ...over, system }] : []
        })
    )

    const tokenSpot = $derived(layout.tokenSpots[animator.tokenSide])

    const uid = $props.id()

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    // A tap on anything that cannot be chosen lets go of the chosen ship; Undo does the same from
    // the keyboard.
    function tapOff(event: MouseEvent) {
        if (
            event.target instanceof Element &&
            event.target.closest('[role="button"]:not([aria-disabled="true"])')
        ) {
            return
        }
        session.letGo()
    }

    const BANK_SPECKS = Array.from({ length: 70 }, (_, index) => ({
        u: ((index * 7919) % 997) / 997,
        v: ((index * 104729) % 991) / 991,
        r: 0.5 + ((index * 31) % 5) * 0.22
    }))

    const bankCorners = $derived.by(() => {
        const { x, y, width, depth } = layout.bank
        return [
            onTable(view, x, y),
            onTable(view, x + width, y),
            onTable(view, x + width, y + depth),
            onTable(view, x, y + depth)
        ]
    })
</script>

{#snippet token()}
    <g
        class="token"
        class:live={session.canEndTurn}
        transform={at(tokenSpot.x, tokenSpot.y)}
        role="button"
        aria-disabled={!session.canEndTurn}
        tabindex={session.canEndTurn ? 0 : -1}
        aria-label={session.canEndTurn ? 'End your turn' : 'Turn token'}
        onclick={() => session.endTurn()}
        onkeydown={(event) => onKey(event, () => session.endTurn())}
    >
        <g {@attach animator.tokenNode}>
            {#if session.canEndTurn}
                <ellipse
                    class="mark target"
                    rx={TURN_TOKEN_RADIUS + 8}
                    ry={(TURN_TOKEN_RADIUS + 8) * view.tilt}
                ></ellipse>
            {/if}
            <TurnToken
                radius={TURN_TOKEN_RADIUS}
                {view}
                facingFar={animator.tokenFacing === 'far'}
                uid="{uid}-token"
            />
        </g>
    </g>
{/snippet}

<div class="tap-off" role="presentation" onclick={tapOff}>
    <svg
        {@attach animator.attach}
        class="hw-board"
        class:updating={session.updatingVisibleState}
        viewBox="{layout.frame.x} {layout.frame.y} {layout.frame.width} {layout.frame.height}"
        width={layout.frame.width}
        height={layout.frame.height}
        role="group"
        aria-label="Homeworlds star map"
    >
        <defs>
            <radialGradient id="{uid}-glow">
                <stop offset="0" stop-color="#2a3170" stop-opacity="0.55"></stop>
                <stop offset="1" stop-color="#2a3170" stop-opacity="0"></stop>
            </radialGradient>
        </defs>

        <!-- The Bank's board: black, flecked with stars, a little thickness at its near edge. -->
        <g class="bank-board">
            <polygon
                points={bankCorners
                    .map((corner) => `${corner.x},${corner.y + 5 * view.rise}`)
                    .join(' ')}
                fill="#030304"
            ></polygon>
            <polygon
                points={bankCorners.map((corner) => `${corner.x},${corner.y}`).join(' ')}
                fill="#0d0d12"
                stroke="#2a2a33"
                stroke-width="1"
            ></polygon>
            {#each BANK_SPECKS as speck, index (index)}
                {@const point = onTable(
                    view,
                    layout.bank.x + speck.u * layout.bank.width,
                    layout.bank.y + speck.v * layout.bank.depth
                )}
                <ellipse
                    cx={point.x}
                    cy={point.y}
                    rx={speck.r}
                    ry={speck.r * view.tilt}
                    fill="#e9e6f5"
                    fill-opacity="0.75"
                ></ellipse>
            {/each}
        </g>

        <!-- Each system ringed on the table, its name in front. -->
        <g class="systems">
            {#each layout.systems as system (system.id)}
                <polygon
                    class="ring"
                    class:home={system.homeworldOf !== undefined}
                    class:open={session.moveTargets.has(system.id)}
                    points={outlinePoints(system)}
                ></polygon>
                {@const label = labelSpot(system)}
                <text
                    class="label"
                    x={label.x}
                    y={label.y}
                    dy="4.2"
                    text-anchor="middle"
                    font-size="12">{systemName(system)}</text
                >
            {/each}
        </g>

        <!-- Wormholes between connected systems, brightest where the chosen ship can go. -->
        <g class="lanes">
            {#each lanes as lane (lane.key)}
                <path d={lanePath(lane.from, lane.to)} class="lane {laneState(lane.from, lane.to)}"
                ></path>
            {/each}
        </g>

        <!-- Shadows on the table, under every piece. -->
        <g class="shadows">
            {#each pieces as drawn (drawn.piece)}
                <g transform={at(drawn.x, drawn.y)}>
                    <polygon
                        {@attach animator.part(drawn.piece, 'shadow')}
                        points={drawPyramid(view, drawn.color, drawn.size, drawn.pose).shadow}
                        fill="#000"
                        fill-opacity={drawn.role === 'bank' ? 0.25 : 0.32}
                    ></polygon>
                </g>
            {/each}
        </g>

        <!-- Marks on the table round the pieces that can be chosen. -->
        <g class="marks">
            {#each layout.systems as system (system.id)}
                {#if session.moveTargets.has(system.id)}
                    {@const ring = systemRing(system)}
                    <ellipse
                        class="mark target"
                        cx={onTable(view, ring.x, ring.y).x}
                        cy={onTable(view, ring.x, ring.y).y}
                        rx={ring.rx}
                        ry={ring.ry}
                    ></ellipse>
                {/if}
            {/each}
            {#each [...selectable.keys()] as piece (piece)}
                {@const ring = shipRing(piece)}
                {#if ring}
                    <polygon
                        class="mark ship"
                        class:chosen={session.selectedShip === piece}
                        class:faded={session.selectedShip !== undefined &&
                            session.selectedShip !== piece}
                        points={ring}
                    ></polygon>
                {/if}
            {/each}
            {#each [...session.captureTargets] as piece (piece)}
                {@const ring = shipRing(piece)}
                {#if ring}
                    <polygon class="mark capture" points={ring}></polygon>
                {/if}
            {/each}
            {#each [...session.towerTargets.keys()] as key (key)}
                {@const tower = layout.towers.find((candidate) => towerKey(candidate) === key)}
                {#if tower}
                    {@const ring = towerRing(tower)}
                    {#if ring}
                        {@const centre = onTable(view, ring.x, ring.y)}
                        <ellipse
                            class="mark target"
                            cx={centre.x}
                            cy={centre.y}
                            rx={ring.rx}
                            ry={ring.ry}
                        ></ellipse>
                    {/if}
                {/if}
            {/each}
        </g>

        <!-- The turn token, on the side of the player whose turn it is. -->
        {#if !animator.tokenFlying}
            {@render token()}
        {/if}

        <!-- The pieces. -->
        {#each pieces as drawn (drawn.piece)}
            <g transform={at(drawn.x, drawn.y)}>
                <g {@attach animator.part(drawn.piece, 'body')}>
                    <Pyramid color={drawn.color} size={drawn.size} pose={drawn.pose} {view} />
                </g>
            </g>
        {/each}

        <!-- Carried across to the other side, the token passes over everything. -->
        {#if animator.tokenFlying}
            {@render token()}
        {/if}

        <!-- Hit areas over the pieces, nearest last so it takes the overlap. -->
        <g class="hits">
            {#each layout.systems as system (system.id)}
                {#if session.moveTargets.has(system.id)}
                    <polygon
                        class="hit"
                        points={outlinePoints(system)}
                        role="button"
                        tabindex="0"
                        aria-label="Move to system {system.id}"
                        onclick={() => session.moveTo(system.id)}
                        onkeydown={(event) => onKey(event, () => session.moveTo(system.id))}
                    ></polygon>
                {/if}
            {/each}
            {#each pieces as drawn (drawn.piece)}
                {#if drawn.role === 'ship' && (selectable.has(drawn.piece) || session.captureTargets.has(drawn.piece))}
                    {@const capture = session.captureTargets.has(drawn.piece)}
                    <g transform={at(drawn.x, drawn.y)}>
                        <polygon
                            class="hit"
                            points={drawPyramid(view, drawn.color, drawn.size, drawn.pose).outline}
                            role="button"
                            tabindex="0"
                            aria-label="{capture ? 'Capture' : 'Ship'} {SIZE_NAME[
                                drawn.size
                            ]} {drawn.color}{drawn.ownerId === session.nearId ? '' : ' enemy'}"
                            onclick={() =>
                                capture
                                    ? session.capture(drawn.piece)
                                    : session.selectShip(drawn.piece)}
                            onkeydown={(event) =>
                                onKey(event, () =>
                                    capture
                                        ? session.capture(drawn.piece)
                                        : session.selectShip(drawn.piece)
                                )}
                        ></polygon>
                    </g>
                {/if}
            {/each}
            {#each layout.towers as tower (towerKey(tower))}
                {#if session.towerTargets.has(towerKey(tower))}
                    {@const centre = onTable(view, tower.x, tower.y)}
                    <rect
                        class="hit"
                        x={centre.x - PYRAMID_BASE[tower.size] / 2 - 8}
                        y={centre.y - 150 * view.rise - 10}
                        width={PYRAMID_BASE[tower.size] + 16}
                        height={150 * view.rise + 30}
                        role="button"
                        tabindex="0"
                        aria-label="Bank {SIZE_NAME[tower.size]} {tower.color}"
                        onclick={() => session.tapTower(tower)}
                        onkeydown={(event) => onKey(event, () => session.tapTower(tower))}
                    ></rect>
                {/if}
            {/each}
        </g>

        <!-- Overpopulated systems the player may blow up. -->
        {#each catastrophes as over (`${over.systemId}-${over.color}`)}
            {@const index = catastrophes
                .filter((other) => other.systemId === over.systemId)
                .indexOf(over)}
            {@const centre = onTable(
                view,
                over.system.x - starHalf(over.system) - 22,
                over.system.y
            )}
            <g
                class="catastrophe"
                transform="translate({centre.x} {centre.y - 30 * view.rise - index * 32})"
                role="button"
                tabindex="0"
                aria-label="Blow up {over.color} in system {over.systemId}"
                onclick={() => session.declareCatastrophe(over.systemId, over.color)}
                onkeydown={(event) =>
                    onKey(event, () => session.declareCatastrophe(over.systemId, over.color))}
            >
                <circle r="14" fill="#101018" stroke={PLASTIC_INK[over.color]} stroke-width="3"
                ></circle>
                <path
                    d="M0 -9 L2.6 -3 L9 -3.5 L4 1 L6.5 7.5 L0 4 L-6.5 7.5 L-4 1 L-9 -3.5 L-2.6 -3 Z"
                    fill={PLASTIC_INK[over.color]}
                ></path>
            </g>
        {/each}

        {#if session.selectedShip !== undefined}
            {@const ship = shipsById.get(session.selectedShip)}
            {#if ship}
                {@const centre = onTable(view, ship.x, ship.y)}
                <circle id="hw-ship-anchor" cx={centre.x} cy={centre.y - 20} r="1" fill="none"
                ></circle>
            {/if}
        {/if}
    </svg>
</div>

{#if session.selectedShip !== undefined && session.selectedPower === undefined}
    <PowerMenu />
{/if}

<style>
    .tap-off {
        display: contents;
    }

    .hw-board {
        overflow: visible;
    }

    .ring {
        fill: rgb(120 140 255 / 0.05);
        stroke: rgb(170 185 255 / 0.32);
        stroke-width: 1.2;
        transition: stroke 0.2s;
    }

    .ring.home {
        stroke: rgb(236 230 211 / 0.5);
        stroke-width: 1.6;
    }

    .ring.open {
        stroke: var(--hw-mark);
    }

    .label {
        fill: var(--hw-table-ink);
        fill-opacity: 0.8;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        font-weight: 600;
        pointer-events: none;
    }

    .lane {
        fill: none;
        stroke-linecap: round;
        transition:
            stroke 0.2s,
            stroke-opacity 0.2s;
    }

    .lane.quiet {
        stroke: #8fa6ff;
        stroke-opacity: 0.16;
        stroke-width: 2;
        stroke-dasharray: 2 6;
    }

    .lane.open {
        stroke: var(--hw-mark);
        stroke-opacity: 0.85;
        stroke-width: 3;
    }

    .updating .mark {
        opacity: 0;
    }

    .mark {
        fill: none;
        stroke-width: 2.4;
        transition: opacity 0.2s;
    }

    .mark.target {
        stroke: var(--hw-mark);
        stroke-dasharray: 7 5;
        paint-order: stroke;
    }

    .mark.ship {
        stroke: var(--hw-mark);
        stroke-opacity: 0.75;
    }

    .mark.ship.chosen {
        stroke-width: 3.4;
        stroke-opacity: 1;
    }

    .mark.capture {
        stroke: #ff5a4a;
        stroke-dasharray: 6 4;
    }

    .faded {
        opacity: 0.4;
    }

    .hit {
        fill: transparent;
        cursor: pointer;
        outline: none;
    }

    .hit:focus-visible {
        stroke: var(--hw-mark);
        stroke-width: 2;
    }

    .token.live,
    .catastrophe {
        cursor: pointer;
        outline: none;
    }
</style>
