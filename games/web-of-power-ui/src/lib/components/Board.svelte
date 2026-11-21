<script lang="ts">
    import { fade } from 'svelte/transition'
    import {
        ALLIANCES,
        COUNTRY_NAMES,
        Country,
        PieceKind,
        ROADS,
        SPACES,
        cardColorOf,
        type Abbey
    } from '@tabletop/web-of-power'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        ALLIANCE_BOXES,
        ARMS,
        COUNTRY_PATHS,
        LAND_PATH,
        MAP_VIEW,
        ROAD_PATHS,
        SEA_ROUTES,
        SPACE_POINTS
    } from '$lib/board/mapData.js'
    import { cloisterDrawing } from '$lib/board/pieces.js'
    import { wornTag } from '$lib/board/tags.js'
    import { getPieceAnimator, getScoringAnimator } from '$lib/animators/cardAnimatorContext.js'
    import { roadInk, seaRouteInk } from '$lib/board/roadInk.js'
    import { ISLANDS, MAP_LABELS, MOUNTAINS } from '$lib/board/mapDetails.js'
    import { HOUSE_SPRITE } from '$lib/board/pieceSprites.js'
    import { EMBLEMS } from '$lib/board/armsData.js'
    import { ARMS_R, advisorSpots } from '$lib/board/advisorSpots.js'
    import coast from '$lib/images/coast.webp'
    import Piece from './Piece.svelte'
    import { PieceAnimator, advisorKey } from '$lib/animators/pieceAnimator.svelte.js'

    // Each empty space's cloister, inked by hand: every one a little different.
    // Every space's cloister, joined into one path per pen (the drawings never change), each
    // placed at its space.
    const cloisterLayers = (() => {
        const drawn = SPACES.map((space, index) =>
            cloisterDrawing(index + 1, SPACE_POINTS[space.abbey])
        )
        return {
            outline: drawn.map((drawing) => drawing.outline).join(' '),
            detail: drawn.map((drawing) => drawing.detail).join(' ')
        }
    })()

    // Each road inked by hand: rough, gone over twice, smudged.
    const roadInks = ROADS.map(([a, b], index) => roadInk(ROAD_PATHS[`${a}|${b}`], index + 1))
    // One path per layer for all the roads (four elements, not four per road); overlapping
    // smudges inside one path don't darken each other where roads meet.
    const roadLayers = {
        smudgeWide: roadInks.map((road) => road.smudge[0]).join(' '),
        smudgeNarrow: roadInks.map((road) => road.smudge[1]).join(' '),
        ink: roadInks.map((road) => road.ink[0]).join(' '),
        second: roadInks.map((road) => road.ink[1]).join(' ')
    }

    // The sea routes, inked dash-dot by hand, all in one path.
    const seaRoutes = Object.values(SEA_ROUTES)
        .map((route, index) => seaRouteInk(route, index + 1))
        .join(' ')

    // Each alliance tag a scrap of worn parchment, torn its own way.
    const tags = ALLIANCES.map((_, index) => wornTag(index + 1))
    const uid = $props.id()

    const session = getGameSession()

    // The countries the chosen cards can put a piece in now, lit on the map.
    const litCountries = $derived(new Set(session.shownTargets.map((target) => target.country)))

    // The map reaches far enough past the printed frame that houses on spaces by its edges, with
    // their shadows and choice rings, stand on it (the trace carries it out: map/trace.py).
    // Above the map, room for Whitland's house and choice ring, which stand up past its edge.
    const TOP_ROOM = 18
    const viewBox = `${MAP_VIEW.x} ${MAP_VIEW.y - TOP_ROOM} ${MAP_VIEW.width} ${MAP_VIEW.height + TOP_ROOM}`
    const countries = Object.values(Country)

    // A scoring's beats, played entry by entry over the board; each award a chip large enough to
    // read on a phone.
    const scoring = getScoringAnimator()
    const CHIP = { width: 78, height: 50, step: 86, font: 36 }

    // Places and lifts pieces as moves play; the board draws the pieces it is moving.
    const pieces = getPieceAnimator() ?? new PieceAnimator(session)

    const cloisterAt = $derived(
        new Map(pieces.cloisters.map((cloister) => [cloister.abbey, cloister.playerId]))
    )

    // Every country's advisors, in the order they arrived.
    const advisorsIn = $derived(
        new Map(
            countries.map((country) => [
                country,
                pieces.advisors.filter((advisor) => advisor.country === country)
            ])
        )
    )

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    function placeCloister(abbey: Abbey, country: Country) {
        void session.placeAt({ kind: PieceKind.Cloister, country, abbey })
    }

    function placeAdvisor(country: Country) {
        void session.placeAt({ kind: PieceKind.Advisor, country })
    }

    // A tap on anything that cannot be chosen lets go of the chosen cards; Undo lets go from the
    // keyboard.
    function onTap(event: MouseEvent) {
        if (
            event.target instanceof Element &&
            event.target.closest('[role="button"]:not([aria-disabled="true"])')
        ) {
            return
        }
        session.letGo()
    }

    // Where each country's name stands, about its coat of arms (the text's anchor on its baseline):
    // placed by /workspace/tmp/web-of-power/labels/place.js to cross as few roads, borders, houses
    // and other labels as it can, near the seal. England's sits below and right of its seal, by
    // Waverley; Schwaben's south-west of its seal, alliance box 13 moved east along its border to
    // make room (user's choice).
    const LABELS: Record<Country, { x: number; y: number; anchor: string }> = {
        [Country.England]: { x: -26, y: 86, anchor: 'start' },
        [Country.Lothringen]: { x: 2, y: -62, anchor: 'middle' },
        [Country.Franken]: { x: 0, y: -62, anchor: 'middle' },
        [Country.Bayern]: { x: 0, y: -62, anchor: 'middle' },
        [Country.Schwaben]: { x: -48, y: 98, anchor: 'middle' },
        [Country.Burgund]: { x: 28, y: -62, anchor: 'middle' },
        [Country.Frankreich]: { x: 54, y: -62, anchor: 'middle' },
        [Country.Aragon]: { x: -22, y: -64, anchor: 'middle' },
        [Country.Italien]: { x: 0, y: -70, anchor: 'middle' }
    }

    // Nearer spaces are drawn last, so a house stands in front of the one behind it.
    const spacesFromBack = [...SPACES].sort(
        (a, b) => SPACE_POINTS[a.abbey].y - SPACE_POINTS[b.abbey].y
    )

    // A mountain, as the board draws them: two peaks sketched in ink.
    const MOUNTAIN = 'M-11 1 L-6 -6 L-2 -1 L3 -8 L10 1'

    // Each advisor's spot on its seal, worked out ahead of time (board/advisorSpots.ts); drawn
    // from the back so nearer pegs stand in front.
    function standing<T>(country: Country, advisors: readonly T[]) {
        const ring = advisorSpots(country, pieces.ringSizes.get(country) ?? advisors.length)
        return advisors
            .map((advisor, index) => ({ advisor, index, spot: ring[index] }))
            .sort((a, b) => a.spot.y - b.spot.y)
    }

    const pieceColor = (playerId: string) => session.colors.getPlayerBgColorValue(playerId)
</script>

<!-- A place the chosen cards can take: a dashed ink ring over a pale halo, pulsing gently as
     Magna Grecia's targets do, so it stands out on every colour. -->
{#snippet targetRing(cx: number, cy: number, r: number)}
    <g class="target" transition:fade={{ duration: 180 }}>
        <circle {cx} {cy} {r} class="target-halo"></circle>
        <circle {cx} {cy} {r} class="target-ring"></circle>
    </g>
{/snippet}

<div class="tap-off" role="presentation" onclick={onTap}>
    <svg
        class="wop-board"
        {viewBox}
        width={MAP_VIEW.width}
        height={MAP_VIEW.height + TOP_ROOM}
        role="group"
        aria-label="Map of Europe"
        {@attach pieces.attach}
    >
        <defs>
            <!-- Parchment for the alliance tags, darker towards its worn edges. -->
            <radialGradient id="{uid}-parchment" cx="45%" cy="40%" r="75%">
                <stop offset="0%" stop-color="#fbf3dc"></stop>
                <stop offset="62%" stop-color="#f1e2bd"></stop>
                <stop offset="100%" stop-color="#d9bf8a"></stop>
            </radialGradient>
            {#each countries as country (country)}
                <clipPath id="{uid}-in-{country}"><path d={COUNTRY_PATHS[country]}></path></clipPath
                >
            {/each}
        </defs>
        <rect
            x={MAP_VIEW.x}
            y={MAP_VIEW.y}
            width={MAP_VIEW.width}
            height={MAP_VIEW.height}
            class="sea"
        ></rect>
        <path d={seaRoutes} class="sea-route"></path>
        <path d={LAND_PATH} class="land"></path>
        <path d={ISLANDS} class="land"></path>
        <!-- Under the countries, each grown a little in its edge colour: closes the slivers
             where traced outlines don't quite meet. -->
        {#each countries as country (country)}
            <path
                d={COUNTRY_PATHS[country]}
                class="country-under"
                style:fill="var(--wop-{cardColorOf(country)}-edge)"
                style:stroke="var(--wop-{cardColorOf(country)}-edge)"
            ></path>
        {/each}
        {#each countries as country (country)}
            <path
                id="wop-country-{country}"
                d={COUNTRY_PATHS[country]}
                class="country"
                style:fill="var(--wop-{cardColorOf(country)})"
            ></path>
        {/each}
        <!-- The pale rim along each coast and the glow in the water off it, pre-rendered. -->
        <image
            href={coast}
            x={MAP_VIEW.x}
            y={MAP_VIEW.y}
            width={MAP_VIEW.width}
            height={MAP_VIEW.height}
            class="coast"
        ></image>
        <!-- Where the chosen cards can go: each such country's colour deepened inside a dark ink
             outline, a pale line just within it so it stands off every colour. -->
        {#each countries as country (country)}
            {#if litCountries.has(country)}
                <!-- Lit and let go quickly, so a choice of card answers at once. -->
                <g
                    clip-path="url(#{uid}-in-{country})"
                    class="lit"
                    transition:fade={{ duration: 180 }}
                >
                    <path
                        d={COUNTRY_PATHS[country]}
                        class="lit-tint"
                        style:fill="var(--wop-{cardColorOf(country)}-lit)"
                    ></path>
                    <path d={COUNTRY_PATHS[country]} class="lit-halo"></path>
                    <path d={COUNTRY_PATHS[country]} class="lit-edge"></path>
                </g>
            {/if}
        {/each}

        <g class="mountains">
            {#each MOUNTAINS as at, index (index)}
                <path d={MOUNTAIN} transform="translate({at.x} {at.y})" class="mountain"></path>
            {/each}
        </g>
        {#each MAP_LABELS as label (label.text)}
            <text
                transform="translate({label.x} {label.y}) rotate({label.angle})"
                y="7"
                class="map-label"
                class:sea-label={label.sea}>{label.text}</text
            >
        {/each}

        <!-- The roads' smudges first, so no smudge greys another road's ink where they meet. -->
        <path d={roadLayers.smudgeWide} class="smudge-wide"></path>
        <path d={roadLayers.smudgeNarrow} class="smudge-narrow"></path>
        <path d={roadLayers.ink} class="road"></path>
        <path d={roadLayers.second} class="road second"></path>

        {#each ALLIANCES as [a, b], index (index)}
            {@const box = ALLIANCE_BOXES[index + 1]}
            <g transform="translate({box.x} {box.y})" class="alliance">
                <title>Alliance {index + 1}: {COUNTRY_NAMES[a]} and {COUNTRY_NAMES[b]}</title>
                <path d={tags[index]} transform="translate(1.3 1.7)" class="tag-shadow"></path>
                <path d={tags[index]} fill="url(#{uid}-parchment)" class="tag"></path>
                <text y="6.5">{index + 1}</text>
            </g>
        {/each}

        <!-- Each country's coat of arms, where its advisors stand. -->
        {#each countries as country (country)}
            {@const at = ARMS[country]}
            {@const advisors = advisorsIn.get(country) ?? []}
            {@const label = LABELS[country]}
            <g transform="translate({at.x} {at.y})">
                <circle r={ARMS_R} class="arms"></circle>
                <!-- The country's emblem, as on its cards, filling the seal behind the advisors. -->
                <path
                    d={EMBLEMS[country]}
                    transform="scale({(ARMS_R * 0.9) / 50})"
                    class="arms-emblem"
                ></path>
                <text x={label.x} y={label.y} text-anchor={label.anchor} class="country-name"
                    >{COUNTRY_NAMES[country]}</text
                >
                {#each standing(country, advisors) as { advisor, index, spot } (index)}
                    <g transform="translate({spot.x} {spot.y})">
                        <g {@attach pieces.peg(advisorKey(country, index))}>
                            <Piece kind="peg" fill={pieceColor(advisor.playerId)} />
                        </g>
                    </g>
                {/each}
                {#if session.advisorTargets.has(country)}
                    {@render targetRing(0, 0, ARMS_R + 5)}
                    <circle
                        r={ARMS_R + 6}
                        class="hit"
                        role="button"
                        tabindex="0"
                        aria-label="send an advisor to {COUNTRY_NAMES[country]}"
                        onclick={() => placeAdvisor(country)}
                        onkeydown={(event) => onKey(event, () => placeAdvisor(country))}
                    ></circle>
                {/if}
            </g>
        {/each}

        <!-- Every space's cloister, drawn on the board; a house stands on its own. -->
        <path d={cloisterLayers.outline} class="cloister-ink"></path>
        <path d={cloisterLayers.detail} class="cloister-ink fine"></path>
        {#each spacesFromBack as space (space.abbey)}
            {@const owner = cloisterAt.get(space.abbey)}
            {#if owner}
                {@const at = SPACE_POINTS[space.abbey]}
                <g transform="translate({at.x} {at.y})">
                    <g {@attach pieces.house(space.abbey)}>
                        <Piece kind="house" fill={pieceColor(owner)} />
                    </g>
                </g>
            {/if}
        {/each}

        <!-- A scoring's beats, each hidden until the scoring animator plays it: its countries lit,
             its alliance tag ringed, its chain's roads drawn in its player's colour, and its awards
             as chips in the players' colours. -->
        {#each scoring?.beats ?? [] as beat (beat.key)}
            {#if beat.countries.length > 0 || beat.alliance !== undefined}
                <g class="beat-light" opacity="0" {@attach scoring?.part(`light:${beat.key}`)}>
                    {#each beat.countries as country (country)}
                        <g clip-path="url(#{uid}-in-{country})">
                            <path
                                d={COUNTRY_PATHS[country]}
                                class="lit-tint"
                                style:fill="var(--wop-{cardColorOf(country)}-lit)"
                            ></path>
                            <path d={COUNTRY_PATHS[country]} class="lit-halo"></path>
                            <path d={COUNTRY_PATHS[country]} class="lit-edge"></path>
                        </g>
                    {/each}
                    {#if beat.alliance !== undefined}
                        {@const box = ALLIANCE_BOXES[beat.alliance]}
                        <circle cx={box.x} cy={box.y} r="24" class="target-halo"></circle>
                        <circle cx={box.x} cy={box.y} r="24" class="beat-ring"></circle>
                    {/if}
                </g>
            {/if}
            {#each beat.roads as road, index (road.key)}
                <path
                    d={ROAD_PATHS[road.key]}
                    pathLength="1"
                    class="beat-road"
                    style:stroke={pieceColor(beat.awards[0].playerId)}
                    opacity="0"
                    {@attach scoring?.part(`road:${beat.key}:${index}`)}
                ></path>
            {/each}
            {@const width = beat.awards.length * CHIP.step - (CHIP.step - CHIP.width)}
            <g transform="translate({beat.chipsAt.x} {beat.chipsAt.y})">
                <g opacity="0" {@attach scoring?.part(`chips:${beat.key}`)}>
                    {#each beat.awards as award, index (award.playerId)}
                        <g
                            transform="translate({index * CHIP.step -
                                width / 2 +
                                CHIP.width / 2} 0)"
                        >
                            <rect
                                x={-CHIP.width / 2}
                                y={-CHIP.height / 2}
                                width={CHIP.width}
                                height={CHIP.height}
                                rx={CHIP.height / 2}
                                class="chip"
                                style:fill={pieceColor(award.playerId)}
                            ></rect>
                            <text
                                y={CHIP.font * 0.35}
                                class="chip-text"
                                style:fill={session.colors.getPlayerTextColorValue(award.playerId)}
                                >+{award.points}</text
                            >
                        </g>
                    {/each}
                </g>
            </g>
        {/each}

        <!-- Choice rings above every piece, so a nearer house never covers one. -->
        {#each SPACES as space (space.abbey)}
            {#if session.cloisterTargets.has(space.abbey)}
                {@const at = SPACE_POINTS[space.abbey]}
                {@const ring = HOUSE_SPRITE.ring}
                <g transform="translate({at.x + ring.x} {at.y + ring.y})">
                    <!-- Round the drawing's middle, 17 above its foot. -->
                    {@render targetRing(-ring.x, -17 - ring.y, 35)}
                    <circle
                        r={ring.r}
                        class="hit"
                        role="button"
                        tabindex="0"
                        aria-label="found a cloister at {space.name}"
                        onclick={() => placeCloister(space.abbey, space.country)}
                        onkeydown={(event) =>
                            onKey(event, () => placeCloister(space.abbey, space.country))}
                    ></circle>
                </g>
            {/if}
        {/each}
    </svg>
</div>

<style>
    .tap-off {
        display: contents;
    }

    .wop-board {
        overflow: visible;
        user-select: none;
    }

    .sea {
        fill: var(--wop-sea);
    }

    .land {
        fill: var(--wop-land);
    }

    .country-under {
        stroke-width: 6;
        stroke-linejoin: round;
    }

    .coast {
        pointer-events: none;
    }

    .mountains {
        opacity: 0.5;
    }

    .mountain {
        fill: none;
        stroke: var(--wop-road);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .map-label {
        font-family: Almendra, Georgia, serif;
        font-size: 22px;
        font-style: italic;
        letter-spacing: 1px;
        text-anchor: middle;
        fill: color-mix(in srgb, var(--wop-label), transparent 30%);
        pointer-events: none;
    }

    .sea-label {
        fill: color-mix(in srgb, var(--wop-sea-ink), transparent 15%);
    }

    /* The printed sea routes: black dash-dot lines, inked by hand. */
    .sea-route {
        fill: var(--wop-road-ink);
    }

    /* Black ink, gone over twice; the second pass a little lighter. */
    .road {
        fill: var(--wop-road-ink);
    }

    .road.second {
        fill-opacity: 0.85;
    }

    .smudge-wide {
        fill: rgb(30 22 16 / 0.08);
    }

    .smudge-narrow {
        fill: rgb(30 22 16 / 0.1);
    }

    .tag-shadow {
        fill: rgb(40 25 10 / 0.25);
    }

    .tag {
        stroke: var(--wop-border);
        stroke-width: 1.2;
        stroke-linejoin: round;
    }

    .alliance text {
        font-family: Almendra, Georgia, serif;
        font-size: 19px;
        text-anchor: middle;
        fill: var(--wop-label);
    }

    .arms {
        fill: rgb(255 255 255 / 0.28);
        stroke: var(--wop-border);
        stroke-width: 2.5;
    }

    .arms-emblem {
        fill: var(--wop-card-ink);
        fill-opacity: 0.5;
        pointer-events: none;
    }

    /* Printed ink: a calligraphic hand at its own weight, the country's colour showing through a
       little. */
    .country-name {
        font-family: Almendra, Georgia, serif;
        font-size: 33px;
        letter-spacing: 0.4px;
        fill: var(--wop-label);
        fill-opacity: 0.86;
        pointer-events: none;
    }

    .cloister-ink {
        fill: none;
        stroke: var(--wop-road);
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .cloister-ink.fine {
        stroke-width: 1;
    }

    .target {
        pointer-events: none;
    }

    .target-halo {
        fill: none;
        stroke: #fff4d0;
        stroke-width: 7;
        stroke-opacity: 0.85;
    }

    .target-ring {
        fill: none;
        stroke: var(--wop-lit-ink);
        stroke-width: 3;
        stroke-dasharray: 7 5;
    }

    /* The pulse waits until a choice's own motion has settled, and steps in small changes of
       opacity rather than every frame: WebKit redraws the whole board for each, which cost a
       third of the frames while a card was chosen (38 against 57 fps). */
    @media (prefers-reduced-motion: no-preference) {
        .target-halo,
        .target-ring {
            animation: target-pulse 1.6s steps(16, jump-none) 0.5s infinite;
        }
    }

    @keyframes target-pulse {
        50% {
            stroke-opacity: 0.4;
        }
    }

    .lit,
    .beat-light {
        pointer-events: none;
    }

    .beat-ring {
        fill: none;
        stroke: var(--wop-lit-ink);
        stroke-width: 3;
    }

    /* A scoring chain drawn along its roads in its player's colour. */
    .beat-road {
        fill: none;
        stroke-width: 9;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 1 1;
        stroke-dashoffset: 1;
        stroke-opacity: 0.85;
        pointer-events: none;
    }

    .chip {
        stroke: var(--wop-lit-ink);
        stroke-width: 3;
    }

    .chip-text {
        font-family: Almendra, Georgia, serif;
        font-size: 36px;
        font-weight: 700;
        text-anchor: middle;
        pointer-events: none;
    }

    /* Light enough that a player's pieces stand off their own colour (red houses in Franken). */
    .lit-tint {
        opacity: 0.4;
    }

    /* Drawn twice as wide as they show: the country's outline clips them to its inside. */
    .lit-halo {
        fill: none;
        stroke: #fff4d0;
        stroke-width: 11;
        stroke-linejoin: round;
        opacity: 0.85;
    }

    .lit-edge {
        fill: none;
        stroke: var(--wop-lit-ink);
        stroke-width: 7;
        stroke-linejoin: round;
    }

    .hit {
        fill: transparent;
        cursor: pointer;
        outline: none;
    }

    .hit:focus-visible {
        stroke: var(--wop-ink);
        stroke-width: 2;
    }
</style>
