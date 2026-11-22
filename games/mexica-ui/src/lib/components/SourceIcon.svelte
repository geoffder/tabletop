<script lang="ts">
    import type { ScoreSources } from '$lib/scoring/scoreBreakdown.js'
    import PieceIcon from './PieceIcon.svelte'

    // A score source's heading in the end panel's table: a calpulli token being put down for the
    // foundings; for the districts a period scored, a token standing on a temple, numbered for the
    // period or struck out for the unfounded ones; and the palace's cross for its bonus.
    let { source, size = 18 }: { source: keyof ScoreSources; size?: number } = $props()

    const scored = $derived(
        source === 'firstPeriod' || source === 'finalFounded' || source === 'finalUnfounded'
    )
    // On a temple the token shrinks and sinks over the temple's top, hiding its pips.
    const ON_TEMPLE = { token: 0.82, temple: 1.05, sink: 12 }
    const tokenSize = $derived(scored ? size * ON_TEMPLE.token : size)

    // A calpulli token's octagon round the origin, flat sides square to the page.
    const R = 9
    const OCTAGON = Array.from({ length: 8 }, (_, k) => {
        const angle = Math.PI / 8 + (k * Math.PI) / 4
        const r = R / Math.cos(Math.PI / 8)
        return `${(r * Math.cos(angle)).toFixed(2)} ${(r * Math.sin(angle)).toFixed(2)}`
    })
    const octagon = `M${OCTAGON.join('L')}Z`
</script>

<span class="icon" class:scored>
    <svg
        viewBox="-12 -12 24 24"
        width={tokenSize}
        height={tokenSize}
        style:margin-bottom={scored ? `${-ON_TEMPLE.sink}px` : undefined}
        aria-hidden="true"
    >
        {#if source === 'palace'}
            <!-- The palace from above: a cross of stone with its turquoise sun in the middle. -->
            <path d="M-3.5 -10.5H3.5V-3.5H10.5V3.5H3.5V10.5H-3.5V3.5H-10.5V-3.5H-3.5Z" class="stone"
            ></path>
            <circle r="3" class="sun"></circle>
        {:else}
            <path d={octagon} class="token"></path>
            <path d={octagon} transform="scale(0.72)" class="rim"></path>
            {#if source === 'founding'}
                <path d="M0 -5.5V3.5M-3.8 0L0 4.2L3.8 0" class="arrow"></path>
            {:else if source === 'finalUnfounded'}
                <path d="M-5.5 -5.5L5.5 5.5M5.5 -5.5L-5.5 5.5" class="cross"></path>
            {:else}
                <text dy="3.6" class="number">{source === 'firstPeriod' ? 1 : 2}</text>
            {/if}
        {/if}
    </svg>
    {#if scored}<PieceIcon piece={2} fill="#8f8676" size={size * ON_TEMPLE.temple} />{/if}
</span>

<style>
    .icon {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        vertical-align: middle;
    }

    svg {
        display: block;
        overflow: visible;
    }

    .scored svg {
        position: relative;
        z-index: 1;
    }

    .token {
        fill: #d9a74a;
        stroke: #3b2708;
        stroke-width: 1.3;
        stroke-linejoin: round;
    }

    .rim {
        fill: none;
        stroke: #2fb3ad;
        stroke-width: 0.9;
        stroke-linejoin: round;
    }

    .number {
        font-size: 11px;
        font-weight: 800;
        text-anchor: middle;
        fill: #3b2708;
    }

    .arrow,
    .cross {
        fill: none;
        stroke: #3b2708;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .cross {
        stroke: #9b1c1c;
        stroke-width: 2.2;
    }

    .stone {
        fill: #a1a6ad;
        stroke: #3f434a;
        stroke-width: 1.2;
        stroke-linejoin: round;
    }

    .sun {
        fill: #2fb3ad;
        stroke: #13706e;
        stroke-width: 0.8;
    }
</style>
