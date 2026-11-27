<script lang="ts">
    import { pieceColor } from '@tabletop/homeworlds'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SHIP_POWER_COLOR } from '$lib/model/session.svelte.js'
    import { ShipPower } from '$lib/model/selection.js'
    import { plasticColor } from '$lib/board/pyramid.js'
    import PowerIcon from './PowerIcon.svelte'

    // What the chosen ship can do, in the prompt where it always shows in the same place, each
    // power marked in the colour that grants it; Sacrifice in the ship's own colour, since that
    // is the colour of the actions it gives.
    const session = getGameSession()

    const LABEL: Record<ShipPower, string> = {
        [ShipPower.Travel]: 'Move',
        [ShipPower.Build]: 'Build',
        [ShipPower.Trade]: 'Trade',
        [ShipPower.Capture]: 'Capture',
        [ShipPower.Sacrifice]: 'Sacrifice'
    }

    function inkOf(power: ShipPower): string {
        const ship = session.selectedShip
        const color = SHIP_POWER_COLOR[power] ?? (ship === undefined ? undefined : pieceColor(ship))
        return color === undefined ? 'currentColor' : plasticColor(color, 'deep')
    }
</script>

<div class="choices" role="menu" aria-label="What the ship can do">
    {#each session.selectedShipPowers as power (power)}
        <button
            type="button"
            role="menuitem"
            class="power"
            style:--power-ink={inkOf(power)}
            onclick={() => session.choosePower(power)}
        >
            <PowerIcon {power} color={inkOf(power)} />
            {LABEL[power]}
        </button>
    {/each}
</div>

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }

    .power {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        padding: 0 10px 0 8px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        color: var(--hw-ink);
        white-space: nowrap;
        background: var(--hw-panel-inset);
        box-shadow:
            inset 0 0 0 1.5px var(--power-ink),
            0 1px 2px rgb(0 0 0 / 0.25);
    }

    @media (hover: hover) {
        .power:hover {
            background: var(--hw-panel-hover);
        }
    }

    .power:active {
        background: var(--hw-panel-hover);
    }

    /* Five powers on one row of a phone's prompt, inside its 50px, so the board never moves. */
    @media (max-width: 639px) {
        .choices {
            flex-wrap: nowrap;
            gap: 4px;
        }

        .choices .power {
            flex-direction: column;
            justify-content: center;
            gap: 1px;
            min-width: 56px;
            min-height: 40px;
            padding: 2px 7px;
            font-size: 12px;
            line-height: 1.2;
        }
    }
</style>
