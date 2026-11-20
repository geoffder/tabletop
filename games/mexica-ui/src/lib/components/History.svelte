<script lang="ts">
    import { fade } from 'svelte/transition'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries, type HistoryEntry } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    let replaying = $state.raw<{ entryId: string; entries: HistoryEntry[] } | undefined>(undefined)
    const liveEntries = $derived(historyEntries(session.actions))
    const entries = $derived((replaying?.entries ?? liveEntries).toReversed())

    async function replay(entry: HistoryEntry) {
        if (replaying) return
        replaying = { entryId: entry.id, entries: liveEntries }
        try {
            await session.history.replayRange(entry.firstIndex, entry.lastIndex)
        } finally {
            replaying = undefined
        }
    }

    function markColor(entry: HistoryEntry): string {
        return entry.kind === 'turn' ? session.playerFill(entry.playerId) : 'transparent'
    }
</script>

<div class="history h-full min-h-[300px] w-full overflow-auto rounded-lg p-2">
    {#if session.gameState.result && !session.isViewingHistory}
        <div class="divider">Game over</div>
    {/if}
    {#each entries as entry (entry.id)}
        {#if entry.kind === 'scoring'}
            <div class="divider">
                {entry.period === 1 ? 'First period scored' : 'Final scoring'}
            </div>
        {/if}
        <button
            type="button"
            class="entry"
            class:replaying={replaying?.entryId === entry.id}
            title="Replay on the board"
            onclick={() => replay(entry)}
            in:fade={{ duration: 200 }}
        >
            <span class="mark mt-[5px] shrink-0" style:background={markColor(entry)}></span>
            <span class="text-left text-[15px] leading-snug">
                <HistoryEntryLine {entry} />
            </span>
        </button>
    {:else}
        <div class="p-3 text-center italic text-(--mx-ink-quiet)">No moves yet</div>
    {/each}
</div>

<style>
    .history {
        background: var(--mx-panel);
        color: var(--mx-ink);
        box-shadow:
            inset 0 0 0 1px var(--mx-panel-edge),
            var(--mx-panel-shadow);
    }

    .mark {
        width: 11px;
        height: 11px;
        border-radius: 3px;
    }

    .entry {
        display: flex;
        width: 100%;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
    }

    @media (hover: hover) {
        .entry:hover {
            background: var(--mx-panel-hover);
        }
    }

    .entry.replaying {
        background: rgb(242 193 78 / 0.18);
    }

    .divider {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 6px 4px 10px;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--mx-ink-quiet);
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--mx-panel-rule);
    }
</style>
