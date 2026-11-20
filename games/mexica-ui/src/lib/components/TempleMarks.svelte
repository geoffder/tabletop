<script lang="ts">
    import { type OwnerMark, TEMPLE_TINT } from '$lib/board/templeMarks.js'
    import type { StairStyle } from '$lib/board/templeShape.js'

    let { mark, stair, fill }: { mark: OwnerMark; stair: StairStyle; fill: string | undefined } =
        $props()

    const SHADE = '#1c1712'
    const GLINT = '#fbf7ee'
</script>

{#if fill !== undefined}
    <path d={mark.path} {fill} opacity={TEMPLE_TINT}></path>
    {#if stair === 'darker' || stair === 'combined'}
        <path d={mark.stair} fill={SHADE} opacity="0.28"></path>
    {/if}
{/if}
{#if stair === 'outlined'}
    <path d={mark.stair} fill="none" stroke={SHADE} stroke-opacity="0.6" stroke-width="0.6"></path>
{/if}
{#if stair === 'treads' || stair === 'combined'}
    <path d={mark.treads} fill="none" stroke={GLINT} stroke-opacity="0.65" stroke-width="0.5"
    ></path>
{/if}
{#each mark.pips as pip, index (index)}
    <ellipse
        cx={pip.x + pip.width / 2}
        cy={pip.y + pip.height / 2}
        rx={pip.width / 2}
        ry={pip.height / 2}
        fill={SHADE}
        opacity="0.38"
    ></ellipse>
{/each}
