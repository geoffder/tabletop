<script lang="ts">
    import { stepSegments } from '$lib/history/entryText.js'
    import type { ActionEntry } from '$lib/history/historyEntries.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plasticColor } from '$lib/board/pyramid.js'
    import PieceIcon from './PieceIcon.svelte'

    let { step, brief = false }: { step: ActionEntry; brief?: boolean } = $props()

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'you' : session.getPlayerName(playerId)
    }

    function homeworldOf(seat: number): string {
        const playerId = session.gameState.players[seat]?.playerId
        if (playerId === undefined) return 'a homeworld'
        return playerId === session.myPlayer?.id
            ? 'your homeworld'
            : `${nameOf(playerId)}'s homeworld`
    }
</script>

{#each stepSegments(step, brief) as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'piece'}<PieceIcon
            piece={segment.piece}
            ship={segment.ship}
        />{:else if segment.kind === 'player'}{nameOf(
            segment.playerId
        )}{:else if segment.kind === 'homeworld'}{homeworldOf(segment.seat)}{:else}<span
            class="color"
            style:--swatch={plasticColor(segment.color, 'body')}>{segment.color}</span
        >{/if}{/each}

<style>
    .color {
        font-weight: 600;
        text-decoration: underline;
        text-decoration-color: var(--swatch);
        text-decoration-thickness: 3px;
        text-underline-offset: 2px;
    }
</style>
