<script lang="ts">
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { LOOK_OUTLINES } from '$lib/board/lookOutlines.js'
    import {
        pilliBounds,
        pilliLook,
        pilliPaint,
        pilliShineLook,
        shineOver
    } from '$lib/board/pilliShape.js'
    import { TILT } from '$lib/board/view.js'

    // A player's Pilli Mexica as the board draws it, fitted to `size` pixels square.
    let { fill, size }: { fill: string; size: number } = $props()

    const box = pilliBounds(TILT)
    const side = Math.max(box.width, box.height)
    const viewBox = `${box.x - (side - box.width) / 2} ${box.y - (side - box.height) / 2} ${side} ${side}`
    const look = pilliLook(false)
</script>

<svg {viewBox} width={size} height={size} aria-hidden="true">
    <path d={LOOK_OUTLINES[look]} fill={pilliPaint(fill)} fill-rule="evenodd"></path>
    <image href={LOOK_URLS[look]} {...box} preserveAspectRatio="none"></image>
    <image
        href={LOOK_URLS[pilliShineLook(false)]}
        {...box}
        preserveAspectRatio="none"
        opacity={shineOver(fill)}
    ></image>
</svg>

<style>
    svg {
        display: block;
        overflow: visible;
    }
</style>
