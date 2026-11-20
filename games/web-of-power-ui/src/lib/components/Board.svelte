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
    import {
        ADVISOR_PATH,
        ADVISOR_TOP,
        HOUSE_PATH,
        HOUSE_ROOF,
        advisorSpots
    } from '$lib/board/pieces.js'

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

    // Names sit above their coats of arms, but England's beside it, as on the board.
    const LABELS: Partial<Record<Country, { x: number; y: number; anchor: string }>> = {
        [Country.England]: { x: 52, y: 10, anchor: 'start' }
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
        {#each countries as country (country)}
            <path
                d={COUNTRY_PATHS[country]}
                class="country"
                class:chosen={session.chosenCountries.includes(country)}
                style:fill="var(--wop-{cardColorOf(country)})"
            ></path>
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
            {@const label = LABELS[country] ?? { x: 0, y: -50, anchor: 'middle' }}
            <g transform="translate({at.x} {at.y})">
                <circle r="40" class="arms"></circle>
                <text x={label.x} y={label.y} text-anchor={label.anchor} class="country-name"
                    >{COUNTRY_NAMES[country]}</text
                >
                {#each advisorSpots(advisors.length) as spot, index (index)}
                    {@const advisor = advisors[index]}
                    <g transform="translate({spot.x} {spot.y})" class="advisor">
                        <path d={ADVISOR_PATH} style:fill={pieceColor(advisor.playerId)}></path>
                        <path d={ADVISOR_TOP} class="advisor-top"></path>
                    </g>
                {/each}
                {#if session.advisorTargets.has(country)}
                    <circle r="46" class="target-band"></circle>
                    <circle r="46" class="target-mark"></circle>
                    <circle
                        r="46"
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

        {#each SPACES as space (space.abbey)}
            {@const at = SPACE_POINTS[space.abbey]}
            {@const owner = cloisterAt.get(space.abbey)}
            {@const open = session.cloisterTargets.has(space.abbey)}
            <g transform="translate({at.x} {at.y})">
                {#if owner}
                    <g class="house">
                        <path d={HOUSE_PATH} style:fill={pieceColor(owner)}></path>
                        <path d={HOUSE_ROOF} class="house-roof"></path>
                    </g>
                {:else}
                    <path d={HOUSE_PATH} class="space"></path>
                {/if}
                {#if open}
                    <circle r="25" cy="-6" class="target-band"></circle>
                    <circle r="25" cy="-6" class="target-mark"></circle>
                    <circle
                        r="25"
                        cy="-6"
                        class="hit"
                        role="button"
                        tabindex="0"
                        aria-label="found a cloister at {space.name}"
                        onclick={() => placeCloister(space.abbey, space.country)}
                        onkeydown={(event) =>
                            onKey(event, () => placeCloister(space.abbey, space.country))}
                    ></circle>
                {/if}
            </g>
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

    .country {
        stroke: var(--wop-border);
        stroke-width: 2;
        stroke-linejoin: round;
        transition: filter 0.2s;
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

    .country-name {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 30px;
        font-weight: 600;
        letter-spacing: 0.6px;
        fill: var(--wop-label);
        pointer-events: none;
    }

    .space {
        fill: rgb(255 252 242 / 0.7);
        stroke: var(--wop-border);
        stroke-width: 1.6;
        stroke-linejoin: round;
    }

    .house path,
    .advisor path {
        stroke: #1b1510;
        stroke-width: 1.8;
        stroke-linejoin: round;
    }

    .house-roof,
    .advisor-top {
        fill: rgb(255 255 255 / 0.28);
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
