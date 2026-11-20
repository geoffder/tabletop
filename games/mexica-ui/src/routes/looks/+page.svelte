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
    const OWNERS = [
        { name: 'red', color: '#b91c1c' },
        { name: 'blue', color: '#2563eb' },
        { name: 'green', color: '#16a34a' },
        { name: 'yellow', color: '#fde047' },
        { name: 'neutral', color: undefined }
    ]
    const PREVIEW_LEVELS: readonly Level[] = [4, 2]
    const TINTS = [0.45, 0.6, 0.75]

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
                    {#each TINTS as tint (tint)}
                        <tr>
                            <th>tint {tint}</th>
                            {#each PREVIEW_LEVELS as level (level)}
                                {#each OWNERS as owner (owner.name)}
                                    {@const tilt = flat ? FLAT : TILT}
                                    {@const box = templeBounds(level, tilt)}
                                    {@const mark = ownerMark(level, tilt, 'tinted')}
                                    <td>
                                        <svg
                                            viewBox="-24 -36 48 54"
                                            width="144"
                                            height="162"
                                            data-temple="{tint}-{level}-{owner.name}"
                                        >
                                            <rect
                                                x="-24"
                                                y="-36"
                                                width="48"
                                                height="54"
                                                fill="#e6dcc4"
                                            ></rect>
                                            <ellipse
                                                cx="1.5"
                                                cy="1.5"
                                                rx="19"
                                                ry={19 * tilt}
                                                fill="url(#temple-shadow)"
                                            ></ellipse>
                                            <image
                                                href={drawn[templeLook(level, flat)]}
                                                {...box}
                                                preserveAspectRatio="none"
                                            ></image>
                                            {#if owner.color}
                                                <path
                                                    d={mark.tops}
                                                    fill={owner.color}
                                                    opacity={tint}
                                                ></path>
                                                <path
                                                    d={mark.fronts}
                                                    fill={owner.color}
                                                    opacity={tint}
                                                ></path>
                                                <path
                                                    d={mark.fronts}
                                                    fill="#000"
                                                    opacity={tint * 0.22}
                                                ></path>
                                            {/if}
                                        </svg>
                                    </td>
                                {/each}
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
