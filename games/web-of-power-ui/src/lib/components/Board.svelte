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
    import { advisorRing, cloisterSketch, houseShape, pegShape } from '$lib/board/pieces.js'
    import { MAP_LABELS, MOUNTAINS } from '$lib/board/mapDetails.js'
    import coast from '$lib/images/coast.webp'
    import { EMBLEMS } from '$lib/board/armsData.js'

    // A house's gable end is 34 wide, as large as the closest spaces (Poblet and Veruela) allow
    // with room between them; an empty space's sketch is the same width.
    const house = houseShape(34)
    const peg = pegShape(16)
    const sketch = cloisterSketch(34)

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

    // Each coat of arms' radius: as large as the houses round the seals allow (Schwaben's rim
    // runs under its neighbours' houses, its middle clear for the advisors). The seals were
    // moved to fit by /workspace/tmp/web-of-power/map/arms_fit.py.
    const ARMS_R = 52

    // Names sit above their coats of arms, England's to the right of it as on the board.
    const LABELS: Partial<Record<Country, { x: number; y: number; anchor: string }>> = {
        [Country.England]: { x: ARMS_R + 10, y: 10, anchor: 'start' }
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

    // Each advisor's spot on its seal, drawn from the back so nearer pegs stand in front.
    function standing<T>(country: Country, advisors: readonly T[]) {
        const spots = advisorRing(advisors.length, 7919 * (countries.indexOf(country) + 1))
        return advisors
            .map((advisor, index) => ({ advisor, index, spot: spots[index] }))
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
        <rect
            x={MAP_VIEW.x}
            y={MAP_VIEW.y}
            width={MAP_VIEW.width}
            height={MAP_VIEW.height}
            class="sea"
        ></rect>
        {#each Object.values(SEA_ROUTES) as route, index (index)}
            <path d={route} class="sea-route"></path>
        {/each}
        <path d={LAND_PATH} class="land"></path>
        <path d={CORSICA} class="land island"></path>
        <ellipse cx="1049" cy="1088" rx="3.2" ry="5.5" class="land island"></ellipse>
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
        {#each countries as country (country)}
            <use href="#wop-country-{country}" class="border"></use>
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

        {#each ROADS as [a, b] (`${a}|${b}`)}
            <path d={ROAD_PATHS[`${a}|${b}`]} class="road"></path>
        {/each}

        {#each ALLIANCES as [a, b], index (index)}
            {@const box = ALLIANCE_BOXES[index + 1]}
            <g transform="translate({box.x} {box.y})" class="alliance">
                <title>Alliance {index + 1}: {COUNTRY_NAMES[a]} and {COUNTRY_NAMES[b]}</title>
                <rect x="-15" y="-15" width="30" height="30" rx="3"></rect>
                <text y="6.3">{index + 1}</text>
            </g>
        {/each}

        <!-- Each country's coat of arms, where its advisors stand. -->
        {#each countries as country (country)}
            {@const at = ARMS[country]}
            {@const advisors = advisorsIn.get(country) ?? []}
            {@const label = LABELS[country] ?? { x: 0, y: -ARMS_R - 10, anchor: 'middle' }}
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
                    <g transform="translate({spot.x} {spot.y})" class="piece">
                        <ellipse
                            cx={peg.shadow.cx}
                            cy={peg.shadow.cy}
                            rx={peg.shadow.rx}
                            ry={peg.shadow.ry}
                            class="shadow"
                        ></ellipse>
                        <path d={peg.body} style:fill={pieceColor(advisor.playerId)}></path>
                        <path d={peg.shade} class="shade"></path>
                        <path d={peg.top} class="lit"></path>
                        <path d={peg.body} class="edge"></path>
                        <path d={peg.top} class="edge inner"></path>
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

        <!-- Shadows first, so no house's shadow falls across the house behind it. -->
        {#each SPACES as space (space.abbey)}
            {@const at = SPACE_POINTS[space.abbey]}
            {#if cloisterAt.has(space.abbey)}
                <ellipse
                    cx={at.x + house.shadow.cx}
                    cy={at.y + house.shadow.cy}
                    rx={house.shadow.rx}
                    ry={house.shadow.ry}
                    class="shadow"
                ></ellipse>
            {/if}
        {/each}
        {#each spacesFromBack as space (space.abbey)}
            {@const at = SPACE_POINTS[space.abbey]}
            {@const owner = cloisterAt.get(space.abbey)}
            <g transform="translate({at.x} {at.y})">
                {#if owner}
                    <g class="piece">
                        <path d={house.outline} style:fill={pieceColor(owner)}></path>
                        <path d={house.side} class="shade"></path>
                        <path d={house.roof} class="lit"></path>
                        <path d={house.outline} class="edge"></path>
                        <path d={house.front} class="edge inner"></path>
                    </g>
                {:else}
                    <path d={sketch.fill} class="sketch-fill"></path>
                    <path d={sketch.lines} class="sketch-lines"></path>
                {/if}
            </g>
        {/each}

        <!-- Choice rings above every piece, so a nearer house never covers one. -->
        {#each SPACES as space (space.abbey)}
            {#if session.cloisterTargets.has(space.abbey)}
                {@const at = SPACE_POINTS[space.abbey]}
                <g transform="translate({at.x + house.centre.x} {at.y + house.centre.y})">
                    <circle r={house.reach} class="target-band"></circle>
                    <circle r={house.reach} class="target-mark"></circle>
                    <circle
                        r={house.reach}
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

    .border {
        fill: none;
        stroke: var(--wop-border);
        stroke-width: 2;
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
        font-family: Georgia, 'Times New Roman', serif;
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

    .sea-route {
        fill: none;
        stroke: var(--wop-sea-ink);
        stroke-width: 3;
        stroke-dasharray: 12 8;
        stroke-linecap: round;
    }

    .road {
        fill: none;
        stroke: var(--wop-road);
        stroke-width: 3.2;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .alliance rect {
        fill: #fbf6e8;
        stroke: var(--wop-border);
        stroke-width: 1.6;
    }

    .alliance text {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 18px;
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

    .country-name {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 30px;
        font-weight: 600;
        letter-spacing: 0.6px;
        fill: var(--wop-label);
        pointer-events: none;
    }

    .shadow {
        fill: rgb(30 20 10 / 0.3);
    }

    .piece .edge {
        fill: none;
        stroke: #1b1510;
        stroke-width: 1.5;
        stroke-linejoin: round;
    }

    .piece .edge.inner {
        stroke-width: 1;
    }

    .piece path:not(.edge) {
        stroke: none;
    }

    .shade {
        fill: rgb(20 10 0 / 0.3);
    }

    .lit {
        fill: rgb(255 255 255 / 0.3);
    }

    .sketch-fill {
        fill: rgb(255 250 236 / 0.45);
    }

    .sketch-lines {
        fill: none;
        stroke: var(--wop-road);
        stroke-width: 1.4;
        stroke-linecap: round;
        stroke-linejoin: round;
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
