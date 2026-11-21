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
    >{:else}<!-- Two parts, so the action panel (a wrapping row) puts the scores under the heading
    when they would not fit beside it, rather than breaking among them. --><span
        class="whitespace-nowrap"
        ><span class="font-semibold"
            >{entry.kind === 'interim' ? 'Interim scoring' : 'Final scoring'}</span
        >:</span
    >{' '}<span
        >{#each pointsByPlayer(entry) as { playerId, points }, index (playerId)}{index === 0
                ? ''
                : ', '}<span class="whitespace-nowrap">{nameOf(playerId)} {points}</span>{:else}no
            points{/each}</span
    >{/if}
