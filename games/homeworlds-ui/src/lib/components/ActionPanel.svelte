<script lang="ts">
    import { MachineState } from '@tabletop/homeworlds'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries, turnEntries } from '$lib/history/historyEntries.js'
    import { ShipPower } from '$lib/model/selection.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import { holdTallest } from './holdTallest.js'
    import GameEndPanel from './GameEndPanel.svelte'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()

    // The ending takes the panel's place, so the height it holds keeps the board still.
    const ended = $derived(
        (session.gameState.result !== undefined || session.gameCall !== undefined) &&
            !session.isViewingHistory
    )

    const lastEntry = $derived(turnEntries(historyEntries(session.actions)).at(-1))
    const machineState = $derived(session.gameState.machineState)
    const acting = $derived(!session.isViewingHistory && session.isMyTurn && !ended)
    const blowUp = $derived(session.overpopulations.length > 0)
    const ship = $derived(session.selectedShip)
</script>

{#snippet endButton(label: string)}
    <button type="button" class="inline" onclick={() => session.endTurn()}>{label}</button>
{/snippet}

<!-- One row: the last move while you wait, the prompt on your turn, the winner at the end. -->
<div class="panel" {@attach holdTallest}>
    {#if ended}
        <GameEndPanel />
    {:else if !acting}
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} brief />
        {:else}
            <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for a homeworld'}</span>
        {/if}
    {:else if session.canCreateHomeworld}
        {#if session.homeworldStars.length < 2}
            <span
                >Choose your homeworld's {session.homeworldStars.length === 0 ? 'first' : 'second'} star
                from the Bank</span
            >
        {:else if session.homeworldShipColor === undefined}
            <span>Now a Large ship from the Bank</span>
        {:else}
            <span
                >{session.smallUniverse ? 'A small universe. ' : ''}<button
                    type="button"
                    class="inline"
                    onclick={() => session.createHomeworld()}>Build homeworld</button
                ></span
            >
        {/if}
    {:else if session.endingLoses}
        <span>No ship of yours at home: ending loses {@render endButton('End turn')}</span>
    {:else if machineState === MachineState.FinishingTurn}
        <span>Blow up a system or {@render endButton('End turn')}</span>
    {:else if ship !== undefined && session.selectedPower === ShipPower.Travel}
        <span
            >Move <PieceIcon piece={ship} ship /> along a lane, or discover a star in the Bank</span
        >
    {:else if ship !== undefined && session.selectedPower === ShipPower.Trade}
        <span>Trade <PieceIcon piece={ship} ship /> for a Bank piece</span>
    {:else if ship !== undefined && session.selectedPower === ShipPower.Capture}
        <span>Capture a ship circled in red</span>
    {:else if ship !== undefined}
        <span>What should <PieceIcon piece={ship} ship /> do?</span>
    {:else if machineState === MachineState.SacrificeActions && session.sacrificeColor}
        <span
            >{session.sacrificeLeft}
            {session.sacrificeColor} action{session.sacrificeLeft === 1 ? '' : 's'}: choose a ship {@render endButton(
                'End turn'
            )}</span
        >
    {:else}
        <span
            >Choose a ship{blowUp ? ', blow up a system,' : ''} or {@render endButton('Pass')}</span
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
        color: var(--hw-ink);
    }

    .inline {
        padding: 0 8px;
        margin-left: 2px;
        border-radius: 8px;
        font-size: inherit;
        font-weight: 600;
        color: var(--hw-ink);
        background: var(--hw-panel-inset);
        box-shadow:
            inset 0 0 0 1.5px var(--hw-toggle-on),
            0 1px 2px rgb(0 0 0 / 0.3);
    }

    @media (hover: hover) {
        .inline:hover {
            background: var(--hw-panel-hover);
        }
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 15px;
            padding: 4px 8px;
        }
    }
</style>
