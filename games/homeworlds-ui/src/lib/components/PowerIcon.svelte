<script lang="ts">
    import { ShipPower } from '$lib/model/selection.js'

    // A small line drawing of what a power does, stroked in the colour that grants it.
    let { power, color }: { power: ShipPower; color: string } = $props()
</script>

<svg class="power-icon" viewBox="0 0 16 16" aria-hidden="true">
    <g fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        {#if power === ShipPower.Travel}
            <path d="M2 8h11M9 4l4 4-4 4"></path>
        {:else if power === ShipPower.Build}
            <path d="M8 2.5v11M2.5 8h11"></path>
        {:else if power === ShipPower.Trade}
            <path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13"></path>
        {:else if power === ShipPower.Capture}
            <circle cx="8" cy="8" r="4.5"></circle>
            <path d="M8 1v3M8 12v3M1 8h3M12 8h3"></path>
        {:else}
            <path
                d="M8 14.5c-3 0-4.5-2-4.5-4.3 0-2.6 2.3-3.9 2.6-7.2 1.6 1 2.4 2.6 2.2 4.2 1-.5 1.6-1.4 1.8-2.4 1.5 1.4 2.4 3.2 2.4 5.2 0 2.5-1.6 4.5-4.5 4.5Z"
            ></path>
        {/if}
    </g>
</svg>

<style>
    .power-icon {
        width: 16px;
        height: 16px;
        flex: none;
    }
</style>
