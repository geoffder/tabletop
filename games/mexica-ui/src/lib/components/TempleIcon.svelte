<script lang="ts">
    import type { Level } from '@tabletop/mexica'

    let { level, fill }: { level: Level; fill: string } = $props()

    // A stepped temple seen from the front: one tier per level.
    const tiers = $derived(
        Array.from({ length: level }, (_, tier) => {
            const half = 9 - tier * 1.6
            return { x: -half, y: -(tier + 1) * 4.2, width: half * 2, height: 4.2 }
        })
    )
</script>

<svg viewBox="-10 -18 20 19" width="20" height="19" aria-hidden="true">
    {#each tiers as tier, index (index)}
        <rect {...tier} style:fill class="tier"></rect>
    {/each}
</svg>

<style>
    .tier {
        stroke: rgb(0 0 0 / 0.6);
        stroke-width: 0.8;
    }
</style>
