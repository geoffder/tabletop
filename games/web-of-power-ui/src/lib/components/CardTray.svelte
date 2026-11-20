<script lang="ts">
    import { CardColor, cardColorName } from '@tabletop/web-of-power'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Card from './Card.svelte'

    const session = getGameSession()

    const display = $derived(session.gameState.display)
    const discard = $derived(session.gameState.discard)
    const deckCount = $derived(session.gameState.deck.remaining)
    let discardOpen = $state(false)

    // The discard pile by colour, for the open pile.
    const discardCounts = $derived(
        Object.values(CardColor)
            .map((card) => ({ card, count: discard.filter((held) => held === card).length }))
            .filter(({ count }) => count > 0)
    )
</script>

<div class="tray">
    {#if session.myPlayer}
        <div class="group" aria-label="Your hand">
            {#each session.hand as card, index (index)}
                <Card
                    {card}
                    chosen={session.chosenIndices.includes(index)}
                    onclick={session.canChooseCards ? () => session.chooseCard(index) : undefined}
                />
            {/each}
        </div>
        <span class="divider"></span>
    {/if}
    <div class="group" aria-label="Face-up cards">
        {#each display as card, index (index)}
            <Card
                {card}
                onclick={session.canDrawFaceUp ? () => session.drawFaceUp(card) : undefined}
                chosen={session.canDrawFaceUp}
            />
        {/each}
        <div class="stack">
            <Card
                label="Deck, {deckCount} cards"
                dimmed={deckCount === 0}
                onclick={session.canDrawFromDeck ? () => session.drawFromDeck() : undefined}
                chosen={session.canDrawFromDeck}
            />
            <span class="count">{deckCount}</span>
        </div>
        <div class="stack discard">
            {#if discard.length > 0}
                <Card
                    card={discard.at(-1)}
                    label="Discard pile, {discard.length} cards"
                    onclick={session.openDiscard ? () => (discardOpen = !discardOpen) : undefined}
                />
            {:else}
                <div class="empty" aria-label="Discard pile, empty"></div>
            {/if}
            <span class="count">{discard.length}</span>
            {#if discardOpen && session.openDiscard}
                <div class="popover" role="dialog" aria-label="Discard pile">
                    <div class="popover-title">Discard pile · {discard.length}</div>
                    {#each discardCounts as { card, count } (card)}
                        <div class="popover-row">
                            <span class="swatch" style:background="var(--wop-{card})"></span>
                            <span>{cardColorName(card)}</span>
                            <span class="ms-auto font-semibold">{count}</span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .tray {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 10px;
        padding: 8px 8px 6px;
    }

    .group {
        display: flex;
        align-items: flex-end;
        gap: 6px;
    }

    .divider {
        align-self: stretch;
        width: 1px;
        background: var(--wop-panel-rule);
    }

    .stack {
        position: relative;
    }

    .count {
        position: absolute;
        right: -5px;
        bottom: -5px;
        min-width: 20px;
        padding: 0 4px;
        border-radius: 10px;
        background: var(--wop-panel);
        box-shadow: inset 0 0 0 1px var(--wop-panel-edge);
        font-size: 12px;
        font-weight: 600;
        text-align: center;
        color: var(--wop-ink);
        pointer-events: none;
    }

    .empty {
        width: 54px;
        height: 81px;
        border-radius: 6px;
        border: 1.5px dashed var(--wop-panel-rule);
    }

    .popover {
        position: absolute;
        right: 0;
        top: calc(100% + 8px);
        z-index: 20;
        min-width: 200px;
        padding: 8px 10px;
        border-radius: 10px;
        background: var(--wop-panel);
        box-shadow:
            inset 0 0 0 1px var(--wop-panel-edge),
            0 6px 18px rgb(40 30 20 / 0.28);
        color: var(--wop-ink);
        font-size: 14px;
    }

    .popover-title {
        margin-bottom: 4px;
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--wop-ink-quiet);
    }

    .popover-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 0;
    }

    .swatch {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        box-shadow: inset 0 0 0 1px rgb(40 30 20 / 0.35);
    }

    @media (max-width: 639px) {
        .tray {
            gap: 6px;
            padding: 6px 4px 6px;
        }

        .group {
            gap: 4px;
        }

        .empty {
            width: 46px;
            height: 69px;
        }
    }
</style>
