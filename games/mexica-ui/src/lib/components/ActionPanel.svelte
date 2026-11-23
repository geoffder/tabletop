<script lang="ts">
    import { Axis, tokenSize } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import GameEndPanel from './GameEndPanel.svelte'
    import { holdTallest } from './holdTallest.js'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const acting = $derived(
        !session.isViewingHistory && (session.canChooseStart || session.isActing)
    )
    const foundingSize = $derived(
        session.foundingToken === undefined ? undefined : tokenSize(session.foundingToken)
    )
    const ended = $derived(session.gameState.result !== undefined && !session.isViewingHistory)
    const tool = $derived(session.tool)
    const singles = $derived(session.gameState.singleCanalsLeft())
    const AXIS_NAMES: Record<Axis, string> = {
        [Axis.NorthSouth]: '↕',
        [Axis.EastWest]: '↔'
    }
</script>

{#snippet endTurn()}
    <button type="button" class="inline" onclick={() => session.endTurn()}>End turn</button>
{/snippet}

<!-- One row: the last move while you wait, the prompt on your turn, the winner at the end. Held at
     its tallest, so the board stays put as the game ends. -->
<div class="panel" class:ended {@attach holdTallest}>
    {#if ended}
        <GameEndPanel />
    {:else if !acting}
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} brief />
        {:else}
            <span
                >{session.isViewingHistory
                    ? 'The game begins'
                    : 'Waiting for the first player'}</span
            >
        {/if}
    {:else if session.canChooseStart}
        <span>Choose a starting space in the palace</span>
    {:else if session.axisChoices.length > 1}
        <span
            >Which way does the bridge run? {#each session.axisChoices as axis (axis)}<button
                    type="button"
                    class="inline"
                    onclick={() => session.chooseAxis(axis)}>{AXIS_NAMES[axis]}</button
                >{/each}</span
        >
    {:else if tool === 'canal' && session.chosenCell !== undefined && session.canDigChosenAlone}
        <span>A neighbour for a double, this space again for a single, or {@render endTurn()}</span>
    {:else if tool === 'canal' && session.chosenCell !== undefined}
        <span>Choose a neighbour to finish the canal, or {@render endTurn()}</span>
    {:else if tool === 'canal' && singles > 0}
        <span
            >Choose two neighbouring spaces, or one twice for a single, or {@render endTurn()}</span
        >
    {:else if tool === 'canal'}
        <span>Choose 2 neighbouring spaces to dig, or {@render endTurn()}</span>
    {:else if tool === 'bridge'}
        <span>Build a bridge: choose a canal, or {@render endTurn()}</span>
    {:else if tool === 'moveBridge'}
        <span
            >{session.chosenCell === undefined
                ? 'Move a bridge: choose the bridge'
                : 'Then choose the destination'}, or {@render endTurn()}</span
        >
    {:else if tool === 'found'}
        <span>Found the district: choose a space for the token, or {@render endTurn()}</span>
    {:else if typeof tool === 'number'}
        <span>Build a {tool}-level temple: choose a space, or {@render endTurn()}</span>
    {:else if foundingSize !== undefined}
        <span
            ><button type="button" class="inline" onclick={() => session.pickTool('found')}
                >Found</button
            >
            a district of {foundingSize}, move, pick a piece, or {@render endTurn()}</span
        >
    {:else}
        <span
            >{#if session.apAvailable === 0}No action points left{:else}Choose where to move, or
                pick a piece{/if}
            {@render endTurn()}</span
        >
    {/if}
</div>

<style>
    /* The ending fills the card, the tray gone from under it. */
    .panel.ended {
        flex: 1;
    }

    .panel {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px 8px;
        min-height: 50px;
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
        .panel {
            font-size: 15px;
            padding: 4px 8px;
        }
    }
</style>
