<svelte:options namespace="svg" />

<script lang="ts">
    import houseLight from '$lib/images/house-light.webp'
    import pegLight from '$lib/images/peg-light.webp'
    import { HOUSE_SPRITE, PEG_SPRITE } from '$lib/board/pieceSprites.js'

    // A cloister's house or an advisor's peg, its foot at the origin: the outline in the player's
    // colour under the painted wood's light and shadow (scripts/render-pieces.mjs). A small piece
    // (a player card's count) keeps its shading within its outline, its long ground shadow cut
    // off, with a small shadow just past its edge instead.
    let {
        kind,
        fill,
        small = false
    }: { kind: 'house' | 'peg'; fill: string; small?: boolean } = $props()

    const sprite = $derived(kind === 'house' ? HOUSE_SPRITE : PEG_SPRITE)
    const uid = $props.id()
</script>

<g>
    {#if small}
        <defs>
            <clipPath id="{uid}-piece"><path d={sprite.outline}></path></clipPath>
        </defs>
        <path d={sprite.outline} transform="translate(1.6 1.2)" class="small-shadow"></path>
    {/if}
    <path d={sprite.outline} style:fill></path>
    <image
        href={kind === 'house' ? houseLight : pegLight}
        x={sprite.light.x}
        y={sprite.light.y}
        width={sprite.light.width}
        height={sprite.light.height}
        clip-path={small ? `url(#${uid}-piece)` : undefined}
    ></image>
</g>

<style>
    .small-shadow {
        fill: rgb(40 30 20 / 0.28);
    }
</style>
