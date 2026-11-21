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

<!-- Within the height the action panel holds, as in the GIPF titles: the winner over every
     score, the scores wrapping between players if they must. -->
<div class="ending">
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else}
        <span class="winner">
            {#if winners.length === 1}
                {winners[0] === session.myPlayer?.id ? 'You win' : `${nameOf(winners[0])} wins`}
            {:else}
                {winners.map(nameOf).join(' and ')} share the win
            {/if}
        </span>
        <span class="scores"
            >{#each ranking as player, index (player.playerId)}{index === 0 ? '' : ' · '}<span
                    class="whitespace-nowrap">{nameOf(player.playerId)} {player.score}</span
                >{/each}</span
        >
    {/if}
</div>

<style>
    .ending {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        line-height: 1.2;
    }

    .winner {
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.06em;
        white-space: nowrap;
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .scores {
        font-size: 15px;
        color: var(--wop-ink-quiet);
    }

    @media (max-width: 639px) {
        .scores {
            font-size: 13px;
        }
    }
</style>
