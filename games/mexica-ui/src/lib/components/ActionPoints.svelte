<script lang="ts">
    import { BASE_AP } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MaskIcon from './MaskIcon.svelte'

    let { size }: { size: number } = $props()

    const session = getGameSession()
    const me = $derived(session.myPlayer?.id)
    const tokens = $derived(
        me === undefined ? 0 : session.gameState.getPlayerState(me).actionTokens
    )
</script>

<div class="ap" title="Action points left this turn">
    {#each Array.from({ length: BASE_AP }, (_, i) => i) as pip (pip)}
        <MaskIcon spent={pip >= session.apLeft} {size} />
    {/each}
    {#if tokens > 0}<span class="tokens" title="Action tokens">+{tokens}</span>{/if}
</div>

<style>
    .ap {
        display: flex;
        align-items: center;
        gap: var(--ap-gap, 6px);
    }

    .tokens {
        margin-left: 2px;
        font-weight: 800;
    }
</style>
