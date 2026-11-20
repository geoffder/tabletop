<script lang="ts">
    import { assert } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winners = $derived.by(() => {
        const ids = session.gameState.winningPlayerIds
        assert(ids.length > 0, 'A finished game names its winners')
        return ids
    })

    const nameOf = (playerId: string) =>
        playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)

    const ranking = $derived(session.gameState.players.toSorted((a, b) => b.score - a.score || 0))
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--mx-ink)">
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else}
        <div class="text-[22px] font-semibold tracking-[0.06em]">
            {#if winners.length === 1}
                {winners[0] === session.myPlayer?.id ? 'You win' : `${nameOf(winners[0])} wins`}
            {:else}
                {winners.map(nameOf).join(' and ')} share the win
            {/if}
        </div>
        <div class="text-[15px] text-(--mx-ink-quiet)">
            {ranking.map((player) => `${nameOf(player.playerId)} ${player.score}`).join(' · ')}
        </div>
    {/if}
</div>
