<script lang="ts">
    import { Axis, type Level } from '@tabletop/mexica'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { bridgeLook, templeLook } from '$lib/board/looks.js'
    import { bridgeBounds } from '$lib/board/bridgeShape.js'
    import { templeMark } from '$lib/board/templeMarks.js'
    import { DESIGN, templeBounds } from '$lib/board/templeShape.js'
    import { TILT, type Box } from '$lib/board/view.js'
    import TempleMarks from './TempleMarks.svelte'
    import MaskIcon from './MaskIcon.svelte'

    // A piece as the board draws it, tilted, fitted to `size` pixels square.
    let {
        piece,
        fill,
        size
    }: { piece: Level | 'canal' | 'bridge' | 'token'; fill: string; size: number } = $props()

    const square = (box: Box): string => {
        const side = Math.max(box.width, box.height)
        return `${box.x - (side - box.width) / 2} ${box.y - (side - box.height) / 2} ${side} ${side}`
    }
    const bridge = $derived(bridgeBounds(Axis.EastWest, TILT))
</script>

{#if typeof piece === 'number'}
    {@const box = templeBounds(4, TILT)}
    {@const mark = templeMark(piece, TILT)}
    <svg viewBox={square(box)} width={size} height={size} aria-hidden="true">
        <!-- Traced as on the board: the stroke under the stone shows only its outer half. -->
        <path d={mark.path} class="trace"></path>
        <image
            href={LOOK_URLS[templeLook(piece, false)]}
            {...templeBounds(piece, TILT)}
            preserveAspectRatio="none"
        ></image>
        <TempleMarks {mark} stair={DESIGN.stair} {fill} />
    </svg>
{:else if piece === 'bridge'}
    <svg viewBox={square(bridge)} width={size} height={size} aria-hidden="true">
        {#each ['back', 'front'] as layer (layer)}
            <image
                href={LOOK_URLS[bridgeLook(Axis.EastWest, false, layer)]}
                {...bridge}
                preserveAspectRatio="none"
            ></image>
        {/each}
    </svg>
{:else if piece === 'canal'}
    <!-- A square of canal between brick banks. -->
    <svg viewBox="-20 -20 40 40" width={size} height={size} aria-hidden="true">
        <rect x="-19" y="-11" width="38" height="22" rx="1.5" class="brick"></rect>
        <rect x="-19" y="-6.5" width="38" height="13" class="water"></rect>
        <path d="M-15 -1 q4 -2.5 8 0 t8 0 t8 0 t8 0" class="ripple"></path>
    </svg>
{:else}
    <!-- An action token: a mask, with the point it adds. -->
    <div class="token" style:--size="{size}px">
        <MaskIcon size={size * 0.86} />
        <span class="plus">+1</span>
    </div>
{/if}

<style>
    svg {
        display: block;
        overflow: visible;
    }

    .trace {
        fill: none;
        stroke: #1c1712;
        stroke-width: 1.6;
        stroke-linejoin: round;
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

    .token {
        width: var(--size);
        height: var(--size);
        position: relative;
        display: grid;
        place-items: center;
    }

    .plus {
        position: absolute;
        left: -3px;
        top: -4px;
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
        color: #2b3680;
        text-shadow:
            0 0 2px var(--mx-panel),
            0 0 2px var(--mx-panel);
    }
</style>
