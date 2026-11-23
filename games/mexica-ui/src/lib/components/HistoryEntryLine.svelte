<script lang="ts">
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import { tokenSize } from '@tabletop/mexica'
    import { pointsByPlayer, type HistoryEntry } from '$lib/history/historyEntries.js'
    import { turnSegments, withdrawnText } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { entry }: { entry: HistoryEntry } = $props()

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }
</script>

{#if entry.kind === 'call'}
    <CalledGameDescription action={entry.action} />
{:else if entry.kind === 'turn'}<span
        ><span class="font-semibold">{nameOf(entry.playerId)}</span
        >{#each turnSegments(entry) as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else}<span
                    class="font-semibold">{nameOf(segment.playerId)}</span
                >{/if}{/each}</span
    >{:else if entry.kind === 'withdrawn'}<span
        >{withdrawnText(entry.tokenIds.map((id) => tokenSize(id)))}</span
    >{:else}<span
        ><span class="font-semibold">{entry.period === 1 ? 'First scoring' : 'Final scoring'}</span
        >{#each pointsByPlayer(entry) as { playerId, points }, index (playerId)}{index === 0
                ? ': '
                : ', '}{nameOf(playerId)}
            +{points}{/each}{#if pointsByPlayer(entry).length === 0}: no points{/if}</span
    >{/if}
