<script lang="ts">
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
    import { roadInk, seaRouteInk } from '$lib/board/roadInk.js'
    import { MAP_LABELS, MOUNTAINS } from '$lib/board/mapDetails.js'
    import { HOUSE_SPRITE } from '$lib/board/pieceSprites.js'
    import { EMBLEMS } from '$lib/board/armsData.js'
    import { ARMS_R, advisorSpots } from '$lib/board/advisorSpots.js'
    import coast from '$lib/images/coast.webp'
    import Piece from './Piece.svelte'

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

    const viewBox = `${MAP_VIEW.x} ${MAP_VIEW.y} ${MAP_VIEW.width} ${MAP_VIEW.height}`
    const countries = Object.values(Country)

    const cloisterAt = $derived(
        new Map(session.gameState.cloisters.map((cloister) => [cloister.abbey, cloister.playerId]))
    )

    // Every country's advisors, in the order they arrived.
    const advisorsIn = $derived(
        new Map(
            countries.map((country) => [
                country,
                session.gameState.advisors.filter((advisor) => advisor.country === country)
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

    // The northern tip of Corsica, at the board's lower edge.
    const CORSICA =
        'M1006 1080C1011 1079 1014 1085 1012 1091C1016 1097 1018 1104 1019 1112L975 1112C981 1104 992 1103 1000 1099C1004 1094 1002 1085 1006 1080Z'
    // A mountain, as the board draws them: two peaks sketched in ink.
    const MOUNTAIN = 'M-11 1 L-6 -6 L-2 -1 L3 -8 L10 1'

    // Each advisor's spot on its seal, worked out ahead of time (board/advisorSpots.ts); drawn
    // from the back so nearer pegs stand in front.
    function standing<T>(country: Country, advisors: readonly T[]) {
        const ring = advisorSpots(country, advisors.length)
        return advisors
            .map((advisor, index) => ({ advisor, index, spot: ring[index] }))
            .sort((a, b) => a.spot.y - b.spot.y)
    }

    const pieceColor = (playerId: string) => session.colors.getPlayerBgColorValue(playerId)
</script>

<div class="tap-off" role="presentation" onclick={onTap}>
    <svg
        class="wop-board"
        {viewBox}
        width={MAP_VIEW.width}
        height={MAP_VIEW.height}
        role="group"
        aria-label="Map of Europe"
    >
        <defs>
            <!-- Parchment for the alliance tags, darker towards its worn edges. -->
            <radialGradient id="{uid}-parchment" cx="45%" cy="40%" r="75%">
                <stop offset="0%" stop-color="#fbf3dc"></stop>
                <stop offset="62%" stop-color="#f1e2bd"></stop>
                <stop offset="100%" stop-color="#d9bf8a"></stop>
            </radialGradient>
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
        <path d={CORSICA} class="land island"></path>
        <ellipse cx="1049" cy="1088" rx="3.2" ry="5.5" class="land island"></ellipse>
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
                        <Piece kind="peg" fill={pieceColor(advisor.playerId)} />
                    </g>
                {/each}
                {#if session.advisorTargets.has(country)}
                    <circle r={ARMS_R + 6} class="target-band"></circle>
                    <circle r={ARMS_R + 6} class="target-mark"></circle>
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
                    <Piece kind="house" fill={pieceColor(owner)} />
                </g>
            {/if}
        {/each}

        <!-- Choice rings above every piece, so a nearer house never covers one. -->
        {#each SPACES as space (space.abbey)}
            {#if session.cloisterTargets.has(space.abbey)}
                {@const at = SPACE_POINTS[space.abbey]}
                {@const ring = HOUSE_SPRITE.ring}
                <g transform="translate({at.x + ring.x} {at.y + ring.y})">
                    <circle r={ring.r} class="target-band"></circle>
                    <circle r={ring.r} class="target-mark"></circle>
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

    .island {
        stroke: var(--wop-border);
        stroke-width: 1.6;
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

    .target-band {
        fill: none;
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 7;
        pointer-events: none;
    }

    .target-mark {
        fill: none;
        stroke: var(--wop-mark);
        stroke-width: 3.5;
        pointer-events: none;
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
