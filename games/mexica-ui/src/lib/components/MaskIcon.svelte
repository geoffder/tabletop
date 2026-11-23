<script lang="ts">
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { MASK_BOX, MASK_LOOK } from '$lib/board/looks.js'

    // An action point: the stone mask from the box, under a crest of feathers, drawn ahead of time
    // (routes/looks/MaskDrawing.svelte) since a page shows a dozen of them. A spent point shows as
    // a pale ghost of it.
    let { spent = false, size = 20 }: { spent?: boolean; size?: number } = $props()
</script>

<svg viewBox="-31 -32 62 62" width={size} height={size} aria-hidden="true" class:spent>
    <image href={LOOK_URLS[MASK_LOOK]} {...MASK_BOX} preserveAspectRatio="none"></image>
</svg>

<style>
    svg {
        display: block;
        overflow: visible;
    }

    .spent {
        opacity: 0.22;
    }
</style>
