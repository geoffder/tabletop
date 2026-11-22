<script lang="ts">
    import { Axis } from '@tabletop/mexica'
    import type { Point } from '@tabletop/common'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { bridgeLook } from '$lib/board/looks.js'
    import { bridgeBounds } from '$lib/board/bridgeShape.js'
    import { TILT, type Box } from '$lib/board/view.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MaskIcon from './MaskIcon.svelte'

    // The pieces every player draws on and how many are left, so anyone can see on any turn
    // what remains: single and double canals, bridges and action tokens, each at its centre in
    // `centres` inside `frame`, drawn `size` across with its count badge `badge` times its
    // usual size.
    let {
        frame,
        centres,
        size,
        badge
    }: { frame: Box; centres: Point[]; size: number; badge: number } = $props()

    const session = getGameSession()
    const game = $derived(session.gameState)
    // Each with where its count sits, right of its centre as a share of `size`: at the piece's
    // right end, clear of the piece where it is short.
    const pieces = $derived([
        { kind: 'single', count: game.singleCanalsLeft(), title: 'Single canals', badgeAt: 0.42 },
        { kind: 'double', count: game.doubleCanalsLeft(), title: 'Double canals', badgeAt: 0.62 },
        { kind: 'bridge', count: game.bridgesLeft(), title: 'Bridges', badgeAt: 0.5 },
        { kind: 'token', count: game.tokenSupply(), title: 'Action tokens', badgeAt: 0.3 }
    ])
    const bridge = bridgeBounds(Axis.EastWest, TILT)
</script>

{#snippet piece(kind: string)}
    {#if kind === 'single' || kind === 'double'}
        <!-- Drawn to scale: a single one square of water in brick banks, a double two. -->
        {@const unit = size * 0.62}
        {@const w = kind === 'double' ? unit * 2 : unit}
        {@const h = unit * 0.75}
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2" class="brick"></rect>
        <rect x={-w / 2 + 3} y={-h / 2 + 3} width={w - 6} height={h - 6} rx="1" class="water"
        ></rect>
        <path
            d="M{-w / 2 + 6} 0 {Array.from(
                { length: Math.floor((w - 12) / 8) },
                () => 'q2 -2 4 0 t4 0'
            ).join(' ')}"
            class="ripple"
        ></path>
    {:else if kind === 'bridge'}
        {@const side = Math.max(bridge.width, bridge.height)}
        <svg
            x={-size / 2}
            y={-size / 2}
            width={size}
            height={size}
            viewBox="{bridge.x - (side - bridge.width) / 2} {bridge.y -
                (side - bridge.height) / 2} {side} {side}"
        >
            {#each ['back', 'front'] as layer (layer)}
                <image
                    href={LOOK_URLS[bridgeLook(Axis.EastWest, false, layer)]}
                    {...bridge}
                    preserveAspectRatio="none"
                ></image>
            {/each}
        </svg>
    {:else}
        <g transform="translate({-size / 2} {-size / 2})">
            <MaskIcon size={size * 0.9} />
        </g>
        <text x={-size / 2 - 4} y={size / 2 - 6} class="plus">+1</text>
    {/if}
{/snippet}

<g class="supply">
    <rect
        x={frame.x - 4}
        y={frame.y - 4}
        width={frame.width + 8}
        height={frame.height + 8}
        rx="8"
        class="frame"
    ></rect>
    {#each pieces as { kind, count, title, badgeAt }, index (kind)}
        {@const at = centres[index]}
        <g transform="translate({at.x} {at.y})" class:out={count === 0}>
            <title>{title} left: {count}</title>
            {@render piece(kind)}
            <!-- The count at the piece's top right, free to stand out of the frame. -->
            <g transform="translate({badgeAt * size} {-size / 2 + 4 * badge}) scale({badge})">
                <rect x="-11" y="-10" width="22" height="20" rx="10" class="badge"></rect>
                <text y={13 * 0.35} class="count">{count}</text>
            </g>
        </g>
    {/each}
</g>

<style>
    .supply {
        pointer-events: none;
    }

    .frame {
        fill: rgb(0 0 0 / 0.12);
        stroke: rgb(255 255 255 / 0.35);
        stroke-width: 1;
    }

    .out {
        opacity: 0.35;
    }

    .brick {
        fill: #8a5a49;
        stroke: #4d3027;
        stroke-width: 1;
    }

    .water {
        fill: #2b9bb3;
    }

    .ripple {
        fill: none;
        stroke: #9fe0e6;
        stroke-width: 1.4;
        stroke-linecap: round;
        opacity: 0.8;
    }

    .plus {
        font-size: 17px;
        font-weight: 800;
        fill: #2b3680;
        paint-order: stroke;
        stroke: #fff8ec;
        stroke-width: 3.5;
    }

    .badge {
        fill: #3a3026;
        stroke: #fff8ec;
        stroke-width: 1.5;
    }

    .count {
        font-size: 13px;
        font-weight: 800;
        fill: #fff8ec;
        text-anchor: middle;
        font-variant-numeric: tabular-nums;
    }
</style>
