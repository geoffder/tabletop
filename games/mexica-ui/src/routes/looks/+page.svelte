<script lang="ts">
    import { onMount } from 'svelte'
    import {
        renderCanal,
        renderLake,
        renderPaving,
        STONES,
        TURQUOISE
    } from '$lib/board/surfaceTexture.js'
    import { CANAL_LOOK, LAKE_LOOK, PAVING_LOOK } from '$lib/board/looks.js'
    import type { Bitmap } from '$lib/board/light.js'
    import { renderTemple } from '$lib/board/templeLight.js'
    import { templeBounds } from '$lib/board/templeShape.js'
    import { ownerMark } from '$lib/board/templeMarks.js'
    import { templeLook } from '$lib/board/looks.js'
    import { FLAT, TILT } from '$lib/board/view.js'
    import type { Level } from '@tabletop/mexica'
    import '../../app.css'

    // For scripts/render-looks.mjs to save as the images the game shows.
    let urls: Record<string, string> | undefined = $state()
    let millis = $state(0)

    function toUrl(bitmap: Bitmap, quality: number): string {
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        context?.putImageData(new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width), 0, 0)
        return canvas.toDataURL('image/webp', quality)
    }

    const LEVELS: readonly Level[] = [1, 2, 3, 4]
    const COLORS = [
        'red',
        'blue',
        'green',
        'yellow',
        'orange',
        'purple',
        'pink',
        'brown',
        'black',
        'white'
    ]
    const PALETTES: { name: string; colors: Record<string, string> }[] = [
        {
            name: 'site',
            colors: {
                red: '#b91c1c',
                blue: '#2563eb',
                green: '#16a34a',
                yellow: '#fde047',
                orange: '#ea580c',
                purple: '#9333ea',
                pink: '#ec4899',
                brown: '#92400e',
                black: '#1f2937',
                white: '#f9fafb'
            }
        },
        {
            name: 'pigment',
            colors: {
                red: '#a8322d',
                blue: '#2f78a8',
                green: '#3a8a5f',
                yellow: '#d9a62e',
                orange: '#c9672a',
                purple: '#6d4a8f',
                pink: '#c25b82',
                brown: '#7a5232',
                black: '#2b2622',
                white: '#efe9dc'
            }
        },
        {
            name: 'soft',
            colors: {
                red: '#c25a4e',
                blue: '#5b8fb5',
                green: '#6aa07c',
                yellow: '#e2bf5a',
                orange: '#d88a52',
                purple: '#8a72a8',
                pink: '#d3849f',
                brown: '#97704f',
                black: '#47423d',
                white: '#f3efe6'
            }
        }
    ]
    const PREVIEW_LEVEL: Level = 3

    onMount(() => {
        const start = performance.now()
        const drawn: Record<string, string> = {}
        drawn[PAVING_LOOK] = toUrl(renderPaving(STONES.limestone), 0.86)
        drawn[LAKE_LOOK] = toUrl(renderLake(TURQUOISE), 0.86)
        drawn[CANAL_LOOK] = toUrl(renderCanal(TURQUOISE), 0.86)
        for (const level of LEVELS) {
            for (const tilt of [TILT, FLAT]) {
                drawn[templeLook(level, tilt === FLAT)] = toUrl(renderTemple(level, tilt), 0.9)
            }
        }
        urls = drawn
        millis = Math.round(performance.now() - start)
    })
</script>

<main class="looks">
    {#if urls}
        <p>Drawn in {millis} ms.</p>
        <section data-looks={JSON.stringify(urls)}>
            {#each Object.entries(urls).filter(([name]) => !name.startsWith('temple')) as [name, url] (name)}
                <figure>
                    <img src={url} alt={name} />
                    <figcaption>{name}</figcaption>
                </figure>
            {/each}
        </section>
        {@const drawn = urls}
        {#each [false, true] as flat (flat)}
            <h2>Temples, {flat ? 'flat' : 'tilted'}</h2>
            <table class="temples">
                <tbody>
                    {#each PALETTES as palette (palette.name)}
                        <tr>
                            <th>{palette.name}</th>
                            {#each COLORS as name (name)}
                                {@const tilt = flat ? FLAT : TILT}
                                {@const box = templeBounds(PREVIEW_LEVEL, tilt)}
                                {@const mark = ownerMark(PREVIEW_LEVEL, tilt, 'tinted')}
                                <td>
                                    <svg viewBox="-20 -34 40 50" width="120" height="150">
                                        <rect x="-20" y="-34" width="40" height="50" fill="#e6dcc4"
                                        ></rect>
                                        <ellipse
                                            cx="1.5"
                                            cy="1.5"
                                            rx="19"
                                            ry={19 * tilt}
                                            fill="url(#temple-shadow)"
                                        ></ellipse>
                                        <image
                                            href={drawn[templeLook(PREVIEW_LEVEL, flat)]}
                                            {...box}
                                            preserveAspectRatio="none"
                                        ></image>
                                        <path
                                            d={mark.tops}
                                            fill={palette.colors[name]}
                                            opacity={mark.opacity}
                                        ></path>
                                    </svg>
                                </td>
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/each}
        <svg width="0" height="0" aria-hidden="true">
            <defs>
                <radialGradient id="temple-shadow">
                    <stop offset="0.6" stop-color="#2a1a08" stop-opacity="0.3"></stop>
                    <stop offset="1" stop-color="#2a1a08" stop-opacity="0"></stop>
                </radialGradient>
            </defs>
        </svg>
    {:else}
        <p>Drawing…</p>
    {/if}
</main>

<style>
    .looks {
        min-height: 100vh;
        padding: 16px;
        background: #e6dfd3;
        font-family: system-ui, sans-serif;
    }

    section {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
        gap: 16px;
    }

    img {
        width: 100%;
    }

    .temples {
        border-collapse: collapse;
        margin-bottom: 16px;
    }

    .temples th {
        padding-right: 12px;
        text-align: right;
    }

    .temples td {
        padding: 2px;
    }
</style>
