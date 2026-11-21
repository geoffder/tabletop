<script lang="ts">
    import { Axis, tokenSize } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import { holdTallest } from './holdTallest.js'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const acting = $derived(
        !session.isViewingHistory && (session.canChooseStart || session.isActing)
    )
    const foundingSize = $derived.by(() => {
        const me = session.myPlayer?.id
        if (!session.canFound || me === undefined) return undefined
        const token = session.gameState.foundingToken(me)
        return token === undefined ? undefined : tokenSize(token)
    })
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

<!-- One row: the last move while you wait, the prompt on your turn. -->
<div class="panel" {@attach holdTallest}>
    {#if !acting}
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
        <span>Choose a neighbour for a double, or this space again for a single</span>
    {:else if tool === 'canal' && session.chosenCell !== undefined}
        <span>Choose a neighbour to finish the canal</span>
    {:else if tool === 'canal' && singles > 0}
        <span>Choose two neighbouring spaces, or one twice for a single ({singles}&nbsp;left)</span>
    {:else if tool === 'canal'}
        <span>Choose two neighbouring spaces</span>
    {:else if tool === 'bridge'}
        <span>Build a bridge: choose a canal</span>
    {:else if tool === 'moveBridge'}
        <span
            >{session.chosenCell === undefined
                ? 'Move a bridge: choose the bridge'
                : 'Then choose the destination'}</span
        >
    {:else if tool === 'found'}
        <span>Found the district: choose a space for the token</span>
    {:else if typeof tool === 'number'}
        <span>Build a {tool}-level temple: choose a space</span>
    {:else if foundingSize !== undefined}
        <span
            >Your district has {foundingSize} spaces:
            <button type="button" class="inline" onclick={() => session.pickTool('found')}
                >Found it</button
            >
            or {@render endTurn()}</span
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
