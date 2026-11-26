<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { EndReason } from '@tabletop/homeworlds'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const DRAWN: Record<Exclude<EndReason, EndReason.Eliminated>, string> = {
        [EndReason.BothEliminated]: 'Drawn: both homeworlds lost',
        [EndReason.Repetition]: 'Drawn: the same position three times'
    }

    const ending = $derived.by(() => {
        if (session.gameCall) return undefined
        const reason = session.gameState.endReason
        assertExists(reason, 'A finished game records why it ended')
        if (reason !== EndReason.Eliminated) return DRAWN[reason]
        const [winner] = session.gameState.winningPlayerIds
        assertExists(winner, 'A won game names its winner')
        return winner === session.myPlayer?.id ? 'You win' : `${session.getPlayerName(winner)} wins`
    })
</script>

<div class="ending">
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else}
        <span class="winner">{ending}</span>
    {/if}
</div>

<style>
    .ending {
        display: flex;
        justify-content: center;
        min-width: 0;
        max-width: 100%;
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
        color: var(--hw-ink);
    }
</style>
