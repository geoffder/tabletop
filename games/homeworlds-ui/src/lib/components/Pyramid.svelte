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
    const pale = $derived(plasticColor(color, 'pale'))
    const body = $derived(plasticColor(color, 'body'))
    // Towards the light on screen, which falls from the upper left.
    const TOWARD_LIGHT = { x: -0.6, y: -0.8 }
</script>

<!-- Translucent plastic: the far faces show through the near ones, the edges deeper in colour
     where the plastic is thick, the pips pressed into the faces. -->
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
        <!-- Pressed into the face: shaded on the side towards the light, lit on the far
             side where the light meets its wall. -->
        <circle r="1" transform={pip.transform} fill={body} fill-opacity="0.9"></circle>
        <circle
            cx={pip.x - TOWARD_LIGHT.x * pip.r * 0.3}
            cy={pip.y - TOWARD_LIGHT.y * pip.r * 0.3}
            r={pip.r * 0.72}
            fill={pale}
            fill-opacity="0.95"
        ></circle>
        <circle
            cx={pip.x + TOWARD_LIGHT.x * pip.r * 0.22}
            cy={pip.y + TOWARD_LIGHT.y * pip.r * 0.22}
            r={pip.r * 0.72}
            fill={deep}
        ></circle>
    {/each}
</g>
