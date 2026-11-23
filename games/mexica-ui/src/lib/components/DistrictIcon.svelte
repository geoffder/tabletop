<script lang="ts">
    import { tokenSize } from '@tabletop/mexica'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { TOKEN, TOKEN_INK, tokenBounds, tokenLook } from '$lib/board/tokenShape.js'

    // A calpulli token from above, with its size, fitted to `size` pixels square.
    let { tokenId, size }: { tokenId: number; size: number } = $props()

    const box = tokenBounds(1)
    const side = Math.max(box.width, box.height)
    const viewBox = `${box.x - (side - box.width) / 2} ${box.y - (side - box.height) / 2} ${side} ${side}`
</script>

<svg {viewBox} width={size} height={size} aria-hidden="true">
    <image href={LOOK_URLS[tokenLook(true)]} {...box} preserveAspectRatio="none"></image>
    <text y={TOKEN.radius * 0.36} text-anchor="middle" fill={TOKEN_INK}>{tokenSize(tokenId)}</text>
</svg>

<style>
    svg {
        display: block;
        overflow: visible;
    }

    text {
        font-size: 30px;
        font-weight: 800;
    }
</style>
