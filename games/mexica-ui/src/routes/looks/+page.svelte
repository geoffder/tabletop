<script lang="ts">
    import { onMount } from 'svelte'
    import { Color } from '@tabletop/common'
    import type { Level } from '@tabletop/mexica'
    import {
        renderCanal,
        renderLake,
        renderPaving,
        STONES,
        TURQUOISE
    } from '$lib/board/surfaceTexture.js'
    import { CANAL_LOOK, LAKE_LOOK, PAVING_LOOK, templeLook } from '$lib/board/looks.js'
    import type { Bitmap } from '$lib/board/light.js'
    import { renderTemple } from '$lib/board/templeLight.js'
    import { DESIGNS, type TempleDesign, templeBounds } from '$lib/board/templeShape.js'
    import { ownerMark } from '$lib/board/templeMarks.js'
    import TempleMarks from '$lib/components/TempleMarks.svelte'
    import { CELL, FLAT, TILT } from '$lib/board/view.js'
    import { PIGMENTS } from '$lib/model/palette.js'
    import '../../app.css'

    // For scripts/render-looks.mjs to save as the images the game shows.
    let urls: Record<string, string> | undefined = $state()
    let millis = $state(0)
    // Designs to compare, drawn after the saved looks so the render script need not wait.
    let previews: Record<string, string> | undefined = $state()

    const LEVELS: readonly Level[] = [1, 2, 3, 4]
    const STRIP: readonly [Level, Color][] = [
        [1, Color.Green],
        [2, Color.Red],
        [3, Color.Yellow],
        [2, Color.Blue]
    ]
    const DESIGN_ROWS: [string, TempleDesign][] = Object.entries(DESIGNS)

    function toUrl(bitmap: Bitmap, quality: number): string {
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        context?.putImageData(new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width), 0, 0)
        return canvas.toDataURL('image/webp', quality)
    }

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
        setTimeout(() => {
            const designs: Record<string, string> = {}
            for (const [name, design] of DESIGN_ROWS) {
                for (const level of LEVELS) {
                    designs[`${name}-${level}`] = toUrl(renderTemple(level, TILT, design), 0.9)
                }
            }
            previews = designs
        })
    })
</script>

{#snippet temple(design: TempleDesign, url: string, level: Level, x: number, color: Color)}
    {@const mark = ownerMark(level, TILT, design)}
    <g transform="translate({x} 0)">
        <ellipse cx="2" cy="2" rx={CELL * 0.5} ry={CELL * 0.5 * TILT} fill="url(#temple-shadow)"
        ></ellipse>
        <image href={url} {...templeBounds(level, TILT, design)} preserveAspectRatio="none"></image>
        <TempleMarks {mark} stair={design.stair} fill={PIGMENTS[color].fill} />
    </g>
{/snippet}

<main class="looks">
    {#if urls}
        <p>Drawn in {millis} ms.</p>
        <section data-looks={JSON.stringify(urls)}>
            {#each [PAVING_LOOK, LAKE_LOOK, CANAL_LOOK] as name (name)}
                <figure>
                    <img src={urls[name]} alt={name} />
                    <figcaption>{name}</figcaption>
                </figure>
            {/each}
        </section>
    {:else}
        <p>Drawing…</p>
    {/if}
    {#if previews && urls}
        {@const drawn = previews}
        {@const paving = urls[PAVING_LOOK]}
        <h2>Stairs</h2>
        <table class="designs">
            <tbody>
                {#each DESIGN_ROWS as [name, design] (name)}
                    <tr>
                        <th>{name}</th>
                        <td>
                            <svg viewBox="-24 -50 192 66" width="576" height="198">
                                <rect x="-24" y="-50" width="192" height="66" fill="#e6dcc4"></rect>
                                {#each LEVELS as level, index (level)}
                                    {@render temple(
                                        design,
                                        drawn[`${name}-${level}`],
                                        level,
                                        index * 48,
                                        Color.Green
                                    )}
                                {/each}
                            </svg>
                        </td>
                        <td>
                            <!-- At the size a desktop board shows them, on the paving. -->
                            <svg viewBox="-20 -42 160 60" width="208" height="78">
                                <image
                                    href={paving}
                                    x="-60"
                                    y="-140"
                                    width="840"
                                    height="420"
                                    preserveAspectRatio="none"
                                ></image>
                                {#each STRIP as [level, color], index (index)}
                                    {@render temple(
                                        design,
                                        drawn[`${name}-${level}`],
                                        level,
                                        index * 40,
                                        color
                                    )}
                                {/each}
                            </svg>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
    <svg width="0" height="0" aria-hidden="true">
        <defs>
            <radialGradient id="temple-shadow">
                <stop offset="0.6" stop-color="#2a1a08" stop-opacity="0.3"></stop>
                <stop offset="1" stop-color="#2a1a08" stop-opacity="0"></stop>
            </radialGradient>
        </defs>
    </svg>
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

    .designs th {
        padding-right: 12px;
        text-align: right;
    }

    .designs td {
        padding: 4px;
        vertical-align: bottom;
    }
</style>
