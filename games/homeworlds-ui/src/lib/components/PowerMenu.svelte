<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SHIP_POWER_COLOR } from '$lib/model/session.svelte.js'
    import { ShipPower } from '$lib/model/selection.js'
    import { plasticColor } from '$lib/board/pyramid.js'

    const session = getGameSession()

    const LABEL: Record<ShipPower, string> = {
        [ShipPower.Travel]: 'Move',
        [ShipPower.Build]: 'Build',
        [ShipPower.Trade]: 'Trade',
        [ShipPower.Capture]: 'Capture',
        [ShipPower.Sacrifice]: 'Sacrifice'
    }
</script>

<!-- What the chosen ship can do, beside it, so the eye stays on the board. -->
<Floater reference="#hw-ship-anchor" placement="top" offset={14} onClose={() => session.letGo()}>
    <div class="menu" role="menu">
        {#each session.selectedShipPowers as power (power)}
            {@const color = SHIP_POWER_COLOR[power]}
            <button
                type="button"
                role="menuitem"
                class="power"
                onclick={() => session.choosePower(power)}
            >
                <span
                    class="swatch"
                    class:sacrifice={color === undefined}
                    style:--swatch={color === undefined ? undefined : plasticColor(color, 'body')}
                ></span>
                {LABEL[power]}
            </button>
        {/each}
    </div>
</Floater>

<style>
    .menu {
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 10px;
        background: var(--hw-panel);
        box-shadow:
            inset 0 0 0 1px var(--hw-panel-edge),
            var(--hw-panel-shadow);
    }

    .power {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 7px;
        font-size: 15px;
        font-weight: 600;
        color: var(--hw-ink);
        white-space: nowrap;
    }

    .swatch {
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 11px solid currentColor;
    }

    .swatch:not(.sacrifice) {
        border-bottom-color: var(--swatch);
    }

    @media (hover: hover) {
        .power:hover {
            background: var(--hw-panel-hover);
        }
    }

    @media (max-width: 639px) {
        .power {
            padding: 4px 7px;
            font-size: 14px;
        }
    }
</style>
