<script lang="ts">
    import { COUNTRY_NAMES } from '@tabletop/web-of-power'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import { holdTallest } from './holdTallest.js'
    import { getScoringAnimator } from '$lib/animators/cardAnimatorContext.js'
    import GameEndPanel from './GameEndPanel.svelte'

    const session = getGameSession()
    const scoring = getScoringAnimator()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const placedThisTurn = $derived(session.gameState.placements.length)
    const where = $derived(
        session.chosenCards.length === 2
            ? 'any country'
            : session.chosenCountries.map((country) => COUNTRY_NAMES[country]).join(' or ')
    )
    const acting = $derived(
        !session.isViewingHistory &&
            (session.canChooseCards ||
                session.canEndPlacing ||
                session.canPass ||
                session.isDrawing)
    )
</script>

<!-- One row: the last move while you wait, the prompt on your turn. -->
<div class="fit">
    <div class="panel" {@attach holdTallest}>
        {#if scoring?.heading}
            <span class="whitespace-nowrap"
                ><b>{scoring.heading}</b>{#if scoring.label}:{/if}</span
            >
            {#if scoring.label}<span>{scoring.label}</span>{/if}
        {:else if session.gameState.result && !session.isViewingHistory}
            <GameEndPanel />
        {:else if !acting}
            {#if lastEntry}
                <HistoryEntryLine entry={lastEntry} brief />
            {:else}
                <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for turn'}</span>
            {/if}
        {:else if session.isDrawing}
            <span
                >Draw {session.cardsToDraw === 1 ? 'a card' : `${session.cardsToDraw} cards`}: a
                face-up card or the {#if session.canDrawFromDeck}<button
                        type="button"
                        class="inline"
                        onclick={() => session.drawFromDeck()}>deck</button
                    >{:else}deck{/if}</span
            >
        {:else if session.chosenCards.length > 0}
            <span
                >{#if session.targets.length > 0}Place in {where}{:else}Nowhere to place with that{/if}{#if session.canExchange}{' or '}<button
                        type="button"
                        class="inline"
                        onclick={() => session.exchange()}>Exchange</button
                    >{' it'}{/if}</span
            >
        {:else if placedThisTurn > 0}
            <span
                >Choose a card for a second piece or <button
                    type="button"
                    class="inline"
                    onclick={() => session.endPlacing()}>Done</button
                ></span
            >
        {:else if session.canPass}
            <span
                >Choose a card to place with or <button
                    type="button"
                    class="inline"
                    onclick={() => session.pass()}>Pass</button
                ></span
            >
        {:else}
            <span>Choose a card to place with or to exchange</span>
        {/if}
    </div>
</div>

<style>
    .fit {
        container: wop-panel / inline-size;
    }

    .panel {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0 8px;
        min-height: 50px;
        padding: 4px 16px;
        text-align: center;
        font-size: 18px;
        letter-spacing: 0.02em;
        color: var(--wop-ink);
    }

    .inline {
        padding: 0 8px;
        margin-left: 2px;
        border-radius: 8px;
        font-size: inherit;
        font-weight: 600;
        color: var(--wop-ink);
        background: var(--wop-panel-inset);
        box-shadow:
            inset 0 0 0 2px var(--wop-gold),
            0 1px 2px rgb(60 40 20 / 0.25);
    }

    @media (hover: hover) {
        .inline:hover {
            background: var(--wop-panel-hover);
        }
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 15px;
            padding: 4px 8px;
        }
    }

    /* Where a usual line would wrap, every line gets two lines' room, so the board stays put as
       prompts and moves change. The widest usual line is a move with pieces in two countries
       ("Carol placed a cloister in Frankreich and an advisor in Lothringen"); the widths are its
       single-line width at each font size, padding included. Lines that need three (long names)
       are left to holdTallest. */
    @media (min-width: 640px) {
        @container wop-panel (width < 580px) {
            .panel {
                min-height: calc(2lh + 8px);
            }
        }
    }

    @media (max-width: 639px) {
        @container wop-panel (width < 472px) {
            .panel {
                min-height: calc(2lh + 8px);
            }
        }
    }
</style>
