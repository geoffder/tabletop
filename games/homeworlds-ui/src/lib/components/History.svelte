<script lang="ts">
    import { fade } from 'svelte/transition'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries, turnEntries, type TurnOrCall } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    let replaying = $state.raw<{ entryId: string; entries: TurnOrCall[] } | undefined>(undefined)
    const liveEntries = $derived(turnEntries(historyEntries(session.actions)))
    const entries = $derived((replaying?.entries ?? liveEntries).toReversed())

    async function replay(entry: TurnOrCall) {
        if (replaying) return
        replaying = { entryId: entry.id, entries: liveEntries }
        try {
            await session.history.replayRange(entry.firstIndex, entry.lastIndex)
        } finally {
            replaying = undefined
        }
    }

    function seatColor(playerId: string): string {
        return session.colors.getPlayerBgColorValue(playerId)
    }
</script>

<div class="history h-full min-h-[300px] w-full overflow-auto rounded-lg p-2">
    {#if session.gameState.result && !session.isViewingHistory}
        <div class="divider">Game over</div>
    {/if}
    {#each entries as entry (entry.id)}
        {#if entry.kind === 'turn'}
            <button
                type="button"
                class="entry replayable"
                class:replaying={replaying?.entryId === entry.id}
                title="Replay on the board"
                onclick={() => replay(entry)}
                in:fade={{ duration: 200 }}
            >
                <span class="seat" style:background={seatColor(entry.playerId)}></span>
                <span class="text-left text-[15px] leading-snug">
                    <HistoryEntryLine {entry} />
                </span>
            </button>
        {:else}
            <div class="entry" in:fade={{ duration: 200 }}>
                <span class="seat none"></span>
                <span class="text-left text-[15px] leading-snug">
                    <HistoryEntryLine {entry} />
                </span>
            </div>
        {/if}
    {:else}
        <div class="p-3 text-center italic text-(--hw-ink-quiet)">No moves yet</div>
    {/each}
</div>

<style>
    .history {
        background: var(--hw-panel);
        color: var(--hw-ink);
        box-shadow:
            inset 0 0 0 1px var(--hw-panel-edge),
            var(--hw-panel-shadow);
    }

    .seat {
        margin-top: 5px;
        width: 10px;
        height: 10px;
        flex-shrink: 0;
        border-radius: 999px;
    }

    .seat.none {
        visibility: hidden;
    }

    .entry {
        display: flex;
        width: 100%;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
    }

    @media (hover: hover) {
        .entry.replayable:hover {
            background: var(--hw-panel-hover);
        }
    }

    .entry.replaying {
        background: rgb(94 240 255 / 0.12);
    }

    .divider {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 6px 4px 10px;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--hw-ink-quiet);
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--hw-panel-rule);
    }
</style>
