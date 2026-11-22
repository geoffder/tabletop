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

<!-- Inside the action panel: the winner over the scores, two lines as tall as its one-line prompt. -->
<div class="ending">
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else}
        <div class="winner">
            {#if winners.length === 1}
                {winners[0] === session.myPlayer?.id ? 'You win' : `${nameOf(winners[0])} wins`}
            {:else}
                {winners.map(nameOf).join(' and ')} share the win
            {/if}
        </div>
        <div class="scores">
            {ranking.map((player) => `${nameOf(player.playerId)} ${player.score}`).join(' · ')}
        </div>
    {/if}
</div>

<style>
    .ending {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        min-width: 0;
        color: var(--mx-ink);
        line-height: 1.2;
    }

    .winner,
    .scores {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .winner {
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.04em;
    }

    .scores {
        font-size: 15px;
        color: var(--mx-ink-quiet);
    }

    @media (max-width: 639px) {
        .winner {
            font-size: 18px;
        }

        .scores {
            font-size: 13px;
        }
    }
</style>
