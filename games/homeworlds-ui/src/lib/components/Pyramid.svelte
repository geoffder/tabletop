<script lang="ts">
    import type { PyramidColor, PyramidSize } from '@tabletop/homeworlds'
    import { drawPyramid, plasticColor, type PyramidPose } from '$lib/board/pyramid.js'
    import type { BoardView } from '$lib/board/view.js'

    let {
        color,
        size,
        pose,
        view
    }: { color: PyramidColor; size: PyramidSize; pose: PyramidPose; view: BoardView } = $props()

    const drawing = $derived(drawPyramid(view, color, size, pose))
    const deep = $derived(plasticColor(color, 'deep'))
    const lit = $derived(plasticColor(color, 'lit'))
</script>

<!-- Translucent plastic: the far faces show through the near ones, the edges deeper in colour
     where the plastic is thick, the pips catching the light. -->
<g class="pyramid">
    <!-- Far walls first: their outer faces, then the hollow's faces in front of them. -->
    {#each drawing.faces.filter((face) => !face.facing) as face, index (index)}
        <polygon points={face.points} fill={face.fill} fill-opacity="0.72"></polygon>
    {/each}
    {#each drawing.inner as face, index (index)}
        <polygon points={face.points} fill={face.fill} fill-opacity={face.facing ? 0.3 : 0.42}
        ></polygon>
    {/each}
    <!-- The thick rim round the open base, deep where the plastic is seen edge on. -->
    <path d={drawing.rim} fill={deep} fill-opacity="0.75" fill-rule="evenodd"></path>
    {#if drawing.mouth}
        <!-- Looking into the hollow: darker inside the rim. -->
        <polygon points={drawing.mouth} fill={deep} fill-opacity="0.4"></polygon>
    {/if}
    {#each drawing.faces.filter((face) => face.facing) as face, index (index)}
        <polygon points={face.points} fill={face.fill} fill-opacity="0.5"></polygon>
    {/each}
    {#each drawing.edges as edge, index (index)}
        <path
            d={edge.d}
            stroke={edge.facing ? lit : deep}
            stroke-opacity={edge.facing ? 0.75 : 0.5}
            stroke-width={edge.facing ? 1.1 : 2.4}
            stroke-linecap="round"
            fill="none"
        ></path>
    {/each}
    <!-- The piece's silhouette, so stacked and touching pyramids read apart. -->
    <polygon
        points={drawing.outline}
        fill="none"
        stroke={deep}
        stroke-width="1.5"
        stroke-opacity="0.95"
        stroke-linejoin="round"
    ></polygon>
    {#each drawing.pips as pip, index (index)}
        <circle r="1" transform={pip.transform} fill={deep} fill-opacity="0.75"></circle>
    {/each}
</g>
