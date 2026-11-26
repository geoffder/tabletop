<script lang="ts">
    import { pieceColor, pieceSize, PYRAMID_SIZES } from '@tabletop/homeworlds'
    import { plasticColor } from '$lib/board/pyramid.js'

    // A pyramid drawn small in text: standing as a star, lying and pointing right as a ship, its
    // size by its height and its pips.
    let { piece, ship = false }: { piece: number; ship?: boolean } = $props()

    const size = $derived(pieceSize(piece))
    const color = $derived(pieceColor(piece))
    const scale = $derived(0.62 + (size / PYRAMID_SIZES.length) * 0.38)
    const body = $derived(plasticColor(color, 'body'))
    const deep = $derived(plasticColor(color, 'deep'))
    const lit = $derived(plasticColor(color, 'lit'))
</script>

<svg
    class="piece-icon"
    class:ship
    viewBox="-10 -10 20 20"
    aria-label="{['', 'Small', 'Medium', 'Large'][size]} {color} {ship ? 'ship' : 'star'}"
    role="img"
>
    <g transform="scale({scale}) rotate({ship ? 90 : 0})">
        <polygon points="0,-9 -6,8 0,6 " fill={lit} fill-opacity="0.9"></polygon>
        <polygon points="0,-9 6,8 0,6" fill={body}></polygon>
        <polygon
            points="0,-9 -6,8 6,8"
            fill="none"
            stroke={deep}
            stroke-width="1.1"
            stroke-linejoin="round"
        ></polygon>
        {#each { length: size }, index (index)}
            <circle cx={(index - (size - 1) / 2) * 2.6} cy="5.6" r="0.9" fill={deep}></circle>
        {/each}
    </g>
</svg>

<style>
    .piece-icon {
        display: inline-block;
        width: 1.15em;
        height: 1.15em;
        vertical-align: -0.2em;
    }
</style>
