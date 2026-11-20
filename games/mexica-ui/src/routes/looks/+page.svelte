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

    onMount(() => {
        const start = performance.now()
        const drawn: Record<string, string> = {}
        drawn[PAVING_LOOK] = toUrl(renderPaving(STONES.warm25), 0.86)
        drawn[LAKE_LOOK] = toUrl(renderLake(TURQUOISE), 0.86)
        drawn[CANAL_LOOK] = toUrl(renderCanal(TURQUOISE), 0.86)
        urls = drawn
        millis = Math.round(performance.now() - start)
    })
</script>

<main class="looks">
    {#if urls}
        <p>Drawn in {millis} ms.</p>
        <section data-looks={JSON.stringify(urls)}>
            {#each Object.entries(urls) as [name, url] (name)}
                <figure>
                    <img src={url} alt={name} />
                    <figcaption>{name}</figcaption>
                </figure>
            {/each}
        </section>
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
</style>
