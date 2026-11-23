<script lang="ts">
    import { Axis, tokenSize } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import GameEndPanel from './GameEndPanel.svelte'
    import { holdTallest } from './holdTallest.js'

    const session = getGameSession()

    const acting = $derived(
        !session.isViewingHistory && (session.canChooseStart || session.isActing)
    )
    const foundingSize = $derived(
        session.foundingToken === undefined ? undefined : tokenSize(session.foundingToken)
    )
    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const ended = $derived(session.gameState.result !== undefined && !session.isViewingHistory)
    const tool = $derived(session.tool)
    const singles = $derived(session.gameState.singleCanalsLeft())
    const AXIS_NAMES: Record<Axis, string> = {
        [Axis.NorthSouth]: '↕',
        [Axis.EastWest]: '↔'
    }
</script>

<!-- One row: the prompt on your turn, the winner at the end. Held at its tallest, so the board stays
     put as the game ends. -->
<div class="panel" class:ended {@attach holdTallest}>
    {#if ended}
        <GameEndPanel />
    {:else if !acting}
        <!-- Left empty: the last move is shown over the whole card. -->
    {:else if session.canChooseStart}
        <span>Choose a palace space to start</span>
    {:else if session.axisChoices.length > 1}
        <span
            >Which way does it run? {#each session.axisChoices as axis (axis)}<button
                    type="button"
                    class="inline"
                    onclick={() => session.chooseAxis(axis)}>{AXIS_NAMES[axis]}</button
                >{/each}</span
        >
    {:else if tool === 'canal' && session.chosenCell !== undefined && session.canDigChosenAlone}
        <span>Extend into double, or make a single</span>
    {:else if tool === 'canal' && session.chosenCell !== undefined}
        <span>Choose a neighbour to finish</span>
    {:else if tool === 'canal' && singles > 0}
        <span>Dig 2 adjacent spaces, or 1 twice</span>
    {:else if tool === 'canal'}
        <span>Dig 2 adjacent spaces</span>
    {:else if tool === 'bridge'}
        <span>Build a bridge</span>
    {:else if tool === 'moveBridge'}
        <span
            >{session.chosenCell === undefined
                ? 'Choose a bridge to move'
                : 'Choose where it goes'}</span
        >
    {:else if tool === 'found'}
        <span>Found the district: choose a space</span>
    {:else if typeof tool === 'number'}
        <span>Build a {tool}-level temple</span>
    {:else if foundingSize !== undefined}
        <span
            ><button type="button" class="inline" onclick={() => session.pickTool('found')}
                >Found</button
            >
            a district of {foundingSize}, or move</span
        >
    {:else}
        <span>{session.apAvailable === 0 ? 'No action points left' : 'Move, or pick a piece'}</span>
    {/if}
</div>

<!-- While you wait, the last move has the whole card, the tray hidden under it: what the tray
     showed, the board and the player cards show too. -->
{#if !ended && !acting}
    <div class="waiting">
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} />
        {:else}
            <span
                >{session.isViewingHistory
                    ? 'The game begins'
                    : 'Waiting for the first player'}</span
            >
        {/if}
    </div>
{/if}

<style>
    /* The ending fills the card, the tray gone from under it. */
    .panel.ended {
        flex: 1;
    }

    .waiting {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px 16px;
        text-align: center;
        font-size: 18px;
        letter-spacing: 0.02em;
        color: var(--mx-ink);
    }

    .panel {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px 8px;
        min-height: 34px;
        padding: 4px 16px;
        text-align: center;
        font-size: 18px;
        letter-spacing: 0.02em;
        color: var(--mx-ink);
    }

    .inline {
        padding: 0 8px;
        margin-left: 2px;
        border-radius: 8px;
        font-size: inherit;
        font-weight: 600;
        color: var(--mx-ink);
        background: var(--mx-panel-inset);
        box-shadow:
            inset 0 0 0 1.5px var(--mx-toggle-on),
            0 1px 2px rgb(60 40 20 / 0.25);
    }

    @media (hover: hover) {
        .inline:hover {
            background: var(--mx-panel-hover);
        }
    }

    @media (max-width: 639px) {
        .panel,
        .waiting {
            font-size: 15px;
            padding: 4px 8px;
        }
    }
</style>
