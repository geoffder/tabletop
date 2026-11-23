<script lang="ts">
    import { onMount } from 'svelte'
    import { Color } from '@tabletop/common'
    import { Axis, type Level } from '@tabletop/mexica'
    import {
        renderCanal,
        renderLake,
        renderPaving,
        renderSpill,
        renderShore,
        renderSlope,
        renderSlopeCorner,
        renderSlopeCove,
        PAVING,
        TURQUOISE
    } from '$lib/board/surfaceTexture.js'
    import {
        CANAL_LOOK,
        LAKE_LOOK,
        MASK_BOX,
        MASK_LOOK,
        PAVING_LOOK,
        PINCH_LOOK,
        SHORE_LOOK,
        type SlopeCorner,
        slopeCornerLook,
        slopeCoveLook,
        slopeLook,
        type SlopeSide,
        spillLook,
        templeLook,
        bridgeLook
    } from '$lib/board/looks.js'
    import type { Bitmap } from '$lib/board/light.js'
    import { renderPinchSheet } from '$lib/board/pinchPatches.js'
    import { renderTemple } from '$lib/board/templeLight.js'
    import { renderBridge } from '$lib/board/bridgeLight.js'
    import { renderToken } from '$lib/board/tokenLight.js'
    import { renderPalace } from '$lib/board/palaceLight.js'
    import { palaceLook } from '$lib/board/palaceShape.js'
    import { tokenLook } from '$lib/board/tokenShape.js'
    import { SPILL_DEPTHS, type SpillKind } from '$lib/board/spillShape.js'
    import { DESIGN, type TempleDesign, templeBounds } from '$lib/board/templeShape.js'
    import { ownerMark } from '$lib/board/templeMarks.js'
    import { renderPilli } from '$lib/board/pilliLight.js'
    import { pilliBounds, pilliLook, pilliShineLook, shineOver } from '$lib/board/pilliShape.js'
    import type { Box } from '$lib/board/view.js'
    import TempleMarks from '$lib/components/TempleMarks.svelte'
    import { CELL, FLAT, TILT } from '$lib/board/view.js'
    import { PIGMENTS } from '$lib/model/palette.js'
    import '../../app.css'
    import MaskDrawing from './MaskDrawing.svelte'

    // For scripts/render-looks.mjs to save as the images the game shows.
    let urls: Record<string, string> | undefined = $state()
    // Each figure's outline, which the board fills with its owner's colour under the image.
    let outlines: Record<string, string> | undefined = $state()
    let millis = $state(0)
    // Designs to compare, drawn after the saved looks so the render script need not wait.
    let previews: Record<string, string> | undefined = $state()
    type Figure = { url: string; shine: string; outline: string; box: Box }
    // The saved figure in each colour, tilted and flat.
    let figures: Record<string, Figure> | undefined = $state()
    const FIGURE_COLORS: readonly Color[] = [
        Color.Green,
        Color.Red,
        Color.Yellow,
        Color.Blue,
        Color.White,
        Color.Black
    ]

    const LEVELS: readonly Level[] = [1, 2, 3, 4]
    const SLOPE_SIDES: readonly SlopeSide[] = ['n', 'e', 's', 'w']
    const SLOPE_CORNERS: readonly SlopeCorner[] = ['ne', 'nw', 'se', 'sw']
    const SPILL_KINDS: readonly SpillKind[] = ['across', 'along']
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

    // The mask drawing, rasterised over MASK_BOX at `pixels` per unit: drawn four times as large
    // and halved twice, so its many edges blend smoothly. The drawing's scoped styles do not
    // travel with its markup, so each element takes its computed paint along inline.
    let maskHost: HTMLElement | undefined = $state()
    let maskOverflow = $state('')
    const MASK_PIXELS = 3

    async function drawMask(): Promise<string> {
        const svg = maskHost?.querySelector('svg')
        if (!svg) throw new Error('The mask drawing is missing')
        const bbox = svg.getBBox()
        const box = MASK_BOX
        if (
            bbox.x < box.x ||
            bbox.y < box.y ||
            bbox.x + bbox.width > box.x + box.width ||
            bbox.y + bbox.height > box.y + box.height
        ) {
            maskOverflow = `The mask reaches ${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}, past MASK_BOX`
        }
        const copy = svg.cloneNode(true)
        if (!(copy instanceof SVGSVGElement)) throw new Error('The mask copy is not an svg')
        const originals = [svg, ...svg.querySelectorAll('*')]
        const copies = [copy, ...copy.querySelectorAll('*')]
        const PAINT = [
            'fill',
            'stroke',
            'stroke-width',
            'stroke-linecap',
            'stroke-linejoin',
            'opacity',
            'fill-opacity',
            'stroke-opacity'
        ]
        originals.forEach((element, index) => {
            const style = getComputedStyle(element)
            const target = copies[index]
            if (!(target instanceof SVGElement)) return
            for (const property of PAINT) {
                target.style.setProperty(property, style.getPropertyValue(property))
            }
        })
        const big = MASK_PIXELS * 4
        copy.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
        copy.setAttribute('width', String(box.width * big))
        copy.setAttribute('height', String(box.height * big))
        copy.style.overflow = 'hidden'
        const markup = new XMLSerializer().serializeToString(copy)
        const image = new Image()
        image.src = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
        await image.decode()
        let canvas = document.createElement('canvas')
        canvas.width = box.width * big
        canvas.height = box.height * big
        canvas.getContext('2d')?.drawImage(image, 0, 0)
        URL.revokeObjectURL(image.src)
        for (let halving = 0; halving < 2; halving++) {
            const half = document.createElement('canvas')
            half.width = canvas.width / 2
            half.height = canvas.height / 2
            const context = half.getContext('2d')
            if (context) {
                context.imageSmoothingQuality = 'high'
                context.drawImage(canvas, 0, 0, half.width, half.height)
            }
            canvas = half
        }
        return canvas.toDataURL('image/webp', 0.9)
    }

    function toUrl(bitmap: Bitmap, quality: number): string {
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        context?.putImageData(new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width), 0, 0)
        return canvas.toDataURL('image/webp', quality)
    }

    onMount(async () => {
        const start = performance.now()
        const drawn: Record<string, string> = {}
        drawn[PAVING_LOOK] = toUrl(renderPaving(PAVING), 0.86)
        drawn[LAKE_LOOK] = toUrl(renderLake(TURQUOISE), 0.86)
        drawn[CANAL_LOOK] = toUrl(renderCanal(TURQUOISE), 0.86)
        drawn[SHORE_LOOK] = toUrl(renderShore(), 0.86)
        drawn[PINCH_LOOK] = toUrl(renderPinchSheet(2), 0.9)
        for (const side of SLOPE_SIDES) drawn[slopeLook(side)] = toUrl(renderSlope(side), 0.9)
        for (const out of SLOPE_SIDES) {
            for (const end of SLOPE_SIDES) {
                if (end === out || SLOPE_SIDES.indexOf(end) % 2 === SLOPE_SIDES.indexOf(out) % 2) {
                    continue
                }
                for (const kind of SPILL_KINDS) {
                    for (const depth of SPILL_DEPTHS) {
                        drawn[spillLook(out, end, kind, depth)] = toUrl(
                            renderSpill(out, end, kind, depth),
                            0.9
                        )
                    }
                }
            }
        }
        for (const corner of SLOPE_CORNERS) {
            drawn[slopeCornerLook(corner)] = toUrl(renderSlopeCorner(corner), 0.9)
            drawn[slopeCoveLook(corner)] = toUrl(renderSlopeCove(corner), 0.9)
        }
        for (const level of LEVELS) {
            for (const tilt of [TILT, FLAT]) {
                drawn[templeLook(level, tilt === FLAT)] = toUrl(renderTemple(level, tilt), 0.9)
            }
        }
        for (const tilt of [TILT, FLAT]) {
            const flat = tilt === FLAT
            drawn[bridgeLook(Axis.NorthSouth, flat)] = toUrl(
                renderBridge(Axis.NorthSouth, tilt),
                0.9
            )
            for (const layer of ['back', 'front'] as const) {
                drawn[bridgeLook(Axis.EastWest, flat, layer)] = toUrl(
                    renderBridge(Axis.EastWest, tilt, layer),
                    0.9
                )
            }
        }
        for (const tilt of [TILT, FLAT]) {
            drawn[tokenLook(tilt === FLAT)] = toUrl(renderToken(tilt), 0.9)
        }
        for (const tilt of [TILT, FLAT]) {
            drawn[palaceLook(tilt === FLAT)] = toUrl(renderPalace(tilt), 0.9)
        }
        const traced: Record<string, string> = {}
        for (const tilt of [TILT, FLAT]) {
            const name = pilliLook(tilt === FLAT)
            const look = renderPilli(tilt)
            drawn[name] = toUrl(look.bitmap, 0.92)
            drawn[pilliShineLook(tilt === FLAT)] = toUrl(look.shine, 0.92)
            traced[name] = look.outline
        }
        drawn[MASK_LOOK] = await drawMask()
        urls = drawn
        outlines = traced
        figures = Object.fromEntries(
            [TILT, FLAT].map((tilt) => {
                const flat = tilt === FLAT
                return [
                    pilliLook(flat),
                    {
                        url: drawn[pilliLook(flat)],
                        shine: drawn[pilliShineLook(flat)],
                        outline: traced[pilliLook(flat)],
                        box: pilliBounds(tilt)
                    }
                ]
            })
        )
        millis = Math.round(performance.now() - start)
        setTimeout(() => {
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

{#snippet pilli(figure: Figure, tilt: number, x: number, color: Color)}
    <g transform="translate({x} 0)">
        <ellipse cx="1" cy="1" rx={CELL * 0.26} ry={CELL * 0.26 * tilt} fill="url(#temple-shadow)"
        ></ellipse>
        <path d={figure.outline} fill={PIGMENTS[color].fill} fill-rule="evenodd"></path>
        <image href={figure.url} {...figure.box} preserveAspectRatio="none"></image>
        <image
            href={figure.shine}
            {...figure.box}
            preserveAspectRatio="none"
            opacity={shineOver(PIGMENTS[color].fill)}
        ></image>
    </g>
{/snippet}

{#snippet figureRow(tilt: number)}
    {@const figure = figures?.[pilliLook(tilt === FLAT)]}
    {#if figure}
        <tr>
            <th>{tilt === FLAT ? 'flat' : 'tilted'}</th>
            <td>
                <svg viewBox="-20 -40 240 52" width="720" height="156">
                    <rect x="-20" y="-40" width="240" height="52" fill="#e6dcc4"></rect>
                    {#each FIGURE_COLORS as color, index (color)}
                        {@render pilli(figure, tilt, index * 40, color)}
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
                        {@render pilli(figure, tilt, index * 40, color)}
                    {/each}
                </svg>
            </td>
        </tr>
    {/if}
{/snippet}

<main class="looks">
    <div class="mask-drawing" bind:this={maskHost}><MaskDrawing size={80} /></div>
    {#if maskOverflow}<p class="warning">{maskOverflow}</p>{/if}
    {#if urls}
        <p>Drawn in {millis} ms.</p>
        <section data-looks={JSON.stringify(urls)} data-outlines={JSON.stringify(outlines)}>
            {#each [PAVING_LOOK, LAKE_LOOK, CANAL_LOOK, SHORE_LOOK] as name (name)}
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
                {@render figureRow(TILT)}
                {@render figureRow(FLAT)}
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
    .mask-drawing {
        position: absolute;
        left: -1000px;
    }

    .warning {
        color: #b00;
        font-weight: bold;
    }

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
