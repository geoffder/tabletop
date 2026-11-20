<svelte:options namespace="svg" />

<script lang="ts">
    import houseLight from '$lib/images/house-light.webp'
    import pegLight from '$lib/images/peg-light.webp'
    import { HOUSE_SPRITE, PEG_SPRITE } from '$lib/board/pieceSprites.js'

    // A cloister's house or an advisor's peg, its foot at the origin: the outline in the player's
    // colour under the painted wood's light and shadow (scripts/render-pieces.mjs).
    let { kind, fill }: { kind: 'house' | 'peg'; fill: string } = $props()

    const sprite = $derived(kind === 'house' ? HOUSE_SPRITE : PEG_SPRITE)
</script>

<g>
    <path d={sprite.outline} style:fill></path>
    <image
        href={kind === 'house' ? houseLight : pegLight}
        x={sprite.light.x}
        y={sprite.light.y}
        width={sprite.light.width}
        height={sprite.light.height}
    ></image>
</g>
