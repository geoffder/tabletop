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
    import { DESIGN, type TempleDesign, templeBounds } from '$lib/board/templeShape.js'
    import { ownerMark } from '$lib/board/templeMarks.js'
    import { renderPilli } from '$lib/board/pilliLight.js'
    import {
        PILLI_STYLE,
        type PilliStyle,
        pilliBounds,
        pilliLook,
        pilliShineLook,
        shineOver
    } from '$lib/board/pilliShape.js'
    import type { Box } from '$lib/board/view.js'
    import TempleMarks from '$lib/components/TempleMarks.svelte'
    import { CELL, FLAT, TILT } from '$lib/board/view.js'
    import { PIGMENTS } from '$lib/model/palette.js'
    import '../../app.css'

    // For scripts/render-looks.mjs to save as the images the game shows.
    let urls: Record<string, string> | undefined = $state()
    // Each figure's outline, which the board fills with its owner's colour under the image.
    let outlines: Record<string, string> | undefined = $state()
    let millis = $state(0)
    // Designs to compare, drawn after the saved looks so the render script need not wait.
    let previews: Record<string, string> | undefined = $state()
    type Figure = { url: string; shine: string; outline: string; box: Box }
    let figures: Record<string, Figure> | undefined = $state()
    // Dry-brushed over the darker paints in a range of strengths.
    const FIGURE_STYLES: [string, PilliStyle][] = [
        ['no knot', { ...PILLI_STYLE, knot: 'none' }],
        ['shoulder knot', { ...PILLI_STYLE, knot: 'shoulder' }],
        ['chest knot', { ...PILLI_STYLE, knot: 'chest' }]
    ]
    const SHINES = [0, 0.3]
    const FIGURE_ROWS = FIGURE_STYLES.flatMap(([name]) => SHINES.map((shine) => ({ name, shine })))
    const FIGURE_COLORS: readonly Color[] = [
        Color.Green,
        Color.Red,
        Color.Yellow,
        Color.Blue,
        Color.White,
        Color.Black
    ]

    const LEVELS: readonly Level[] = [1, 2, 3, 4]
    const STRIP: readonly [Level, Color][] = [
        [1, Color.Green],
        [2, Color.Red],
        [3, Color.Yellow],
        [4, Color.Blue],
        [2, Color.White],
        [3, Color.Black]
    ]
    // How much darker the stair's wash is, down the side; how strongly its treads show, across.
    const SHADES = [0, 0.05, 0.1, 0.15, 0.2]
    const TREADS = [
        { name: 'no treads', glint: 0, riser: 1 },
        { name: 'faint', glint: 0.14, riser: 0.92 },
        { name: 'light', glint: 0.24, riser: 0.84 },
        { name: 'medium', glint: 0.36, riser: 0.75 }
    ]

    function stairDesign(shade: number, glint: number, riser: number): TempleDesign {
        return { ...DESIGN, stair: { shade, glint, riser, balustrade: false } }
    }

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
        const traced: Record<string, string> = {}
        for (const tilt of [TILT, FLAT]) {
            const name = pilliLook(tilt === FLAT)
            const look = renderPilli(tilt)
            drawn[name] = toUrl(look.bitmap, 0.92)
            drawn[pilliShineLook(tilt === FLAT)] = toUrl(look.shine, 0.92)
            traced[name] = look.outline
        }
        urls = drawn
        outlines = traced
        millis = Math.round(performance.now() - start)
        setTimeout(() => {
            const drawnFigures: Record<string, Figure> = {}
            for (const [name, style] of FIGURE_STYLES) {
                const look = renderPilli(TILT, style)
                drawnFigures[name] = {
                    url: toUrl(look.bitmap, 0.92),
                    shine: toUrl(look.shine, 0.92),
                    outline: look.outline,
                    box: pilliBounds(TILT)
                }
            }
            figures = drawnFigures
            const designs: Record<string, string> = {}
            for (const { riser } of TREADS) {
                for (const level of LEVELS) {
                    const design = stairDesign(0, 0, riser)
                    designs[`${riser}-${level}`] = toUrl(renderTemple(level, TILT, design), 0.9)
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

{#snippet pilli(figure: Figure, tilt: number, x: number, color: Color, shine: number)}
    <g transform="translate({x} 0)">
        <ellipse cx="1" cy="1" rx={CELL * 0.26} ry={CELL * 0.26 * tilt} fill="url(#temple-shadow)"
        ></ellipse>
        <path d={figure.outline} fill={PIGMENTS[color].fill} fill-rule="evenodd"></path>
        <image href={figure.url} {...figure.box} preserveAspectRatio="none"></image>
        <image
            href={figure.shine}
            {...figure.box}
            preserveAspectRatio="none"
            opacity={shineOver(PIGMENTS[color].fill, shine)}
        ></image>
    </g>
{/snippet}

{#snippet figureRow(name: string, tilt: number, shine: number)}
    {@const figure = figures?.[name]}
    {#if figure}
        <tr>
            <th>{name}, dry brush {shine}</th>
            <td>
                <svg viewBox="-20 -40 240 52" width="720" height="156">
                    <rect x="-20" y="-40" width="240" height="52" fill="#e6dcc4"></rect>
                    {#each FIGURE_COLORS as color, index (color)}
                        {@render pilli(figure, tilt, index * 40, color, shine)}
                    {/each}
                </svg>
            </td>
            <td>
                <!-- At the size a desktop board shows them, on the paving. -->
                <svg viewBox="-20 -40 240 56" width="336" height="78">
                    {#if urls}
                        <image
                            href={urls[PAVING_LOOK]}
                            x="-60"
                            y="-140"
                            width="840"
                            height="420"
                            preserveAspectRatio="none"
                        ></image>
                    {/if}
                    {#each FIGURE_COLORS as color, index (color)}
                        {@render pilli(figure, tilt, index * 40, color, shine)}
                    {/each}
                </svg>
            </td>
        </tr>
    {/if}
{/snippet}

<main class="looks">
    {#if urls}
        <p>Drawn in {millis} ms.</p>
        <section data-looks={JSON.stringify(urls)} data-outlines={JSON.stringify(outlines)}>
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
    {#if figures}
        <h2>Pilli Mexica</h2>
        <table class="designs">
            <tbody>
                {#each FIGURE_ROWS as { name, shine } (`${name}-${shine}`)}
                    {@render figureRow(name, TILT, shine)}
                {/each}
            </tbody>
        </table>
    {/if}
    {#if previews && urls}
        {@const drawn = previews}
        {@const paving = urls[PAVING_LOOK]}
        <h2>Stairs</h2>
        <table class="designs">
            <thead>
                <tr>
                    <th>wash</th>
                    {#each TREADS as treads (treads.name)}<th>{treads.name}</th>{/each}
                </tr>
            </thead>
            <tbody>
                {#each SHADES as shade (shade)}
                    <tr>
                        <th>{shade === 0 ? 'tiers' : `+${shade}`}</th>
                        {#each TREADS as { name, glint, riser } (name)}
                            <td>
                                <!-- At the size a desktop board shows them, on the paving. -->
                                <svg viewBox="-20 -42 240 60" width="336" height="84">
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
                                            stairDesign(shade, glint, riser),
                                            drawn[`${riser}-${level}`],
                                            level,
                                            index * 40,
                                            color
                                        )}
                                    {/each}
                                </svg>
                            </td>
                        {/each}
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
