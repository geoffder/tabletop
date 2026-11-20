<script lang="ts">
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import { pointsByPlayer, type HistoryEntry } from '$lib/history/historyEntries.js'
    import { turnSegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CardChip from './CardChip.svelte'

    let { entry, brief = false }: { entry: HistoryEntry; brief?: boolean } = $props()

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }
</script>

{#if entry.kind === 'call'}
    <CalledGameDescription action={entry.action} />
{:else if entry.kind === 'turn'}<span
        ><span class="font-semibold">{nameOf(entry.playerId)}</span
        >{#each turnSegments(entry, brief) as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else}<CardChip
                    card={segment.card}
                />{/if}{/each}</span
    >{:else}<span
        ><span class="font-semibold"
            >{entry.kind === 'interim' ? 'Interim scoring' : 'Final scoring'}</span
        >{#each pointsByPlayer(entry) as { playerId, points }, index (playerId)}{index === 0
                ? ': '
                : ', '}{nameOf(playerId)}
            {points}{/each}{#if pointsByPlayer(entry).length === 0}: no points{/if}</span
    >{/if}
