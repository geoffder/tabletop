<script lang="ts">
    import { CardColor, cardColorName } from '@tabletop/web-of-power'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Card from './Card.svelte'

    const session = getGameSession()

    const display = $derived(session.gameState.display)
    const discard = $derived(session.gameState.discard)
    const deckCount = $derived(session.gameState.deck.remaining)
    let discardOpen = $state(false)

    // Degrees between neighbouring cards in the fanned hand.
    const FAN_STEP = 8

    // The discard pile by colour, for the open pile.
    const discardCounts = $derived(
        Object.values(CardColor)
            .map((card) => ({ card, count: discard.filter((held) => held === card).length }))
            .filter(({ count }) => count > 0)
    )
</script>

<div class="tray">
    {#if session.myPlayer}
        <div class="hand" aria-label="Your hand">
            {#each session.hand as card, index (index)}
                <div
                    class="fanned"
                    class:raised={session.chosenIndices.includes(index)}
                    style:rotate="{(index - (session.hand.length - 1) / 2) * FAN_STEP}deg"
                >
                    <Card
                        {card}
                        chosen={session.chosenIndices.includes(index)}
                        onclick={session.canChooseCards
                            ? () => session.chooseCard(index)
                            : undefined}
                    />
                </div>
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
    </div>
    <div class="piles">
        <div class="stack" class:pile={deckCount > 1}>
            <Card
                label="Deck, {deckCount} cards"
                dimmed={deckCount === 0}
                onclick={session.canDrawFromDeck ? () => session.drawFromDeck() : undefined}
                chosen={session.canDrawFromDeck}
            />
            <span class="count">{deckCount}</span>
            <span class="caption" aria-hidden="true">Deck</span>
        </div>
        <div class="stack discard" class:pile={discard.length > 1}>
            {#if discard.length > 0}
                <Card
                    card={discard.at(-1)}
                    label="Discard pile, {discard.length} cards"
                    pile={discard.length > 1}
                    onclick={session.openDiscard ? () => (discardOpen = !discardOpen) : undefined}
                />
            {:else}
                <div class="empty" aria-label="Discard pile, empty"></div>
            {/if}
            <span class="count">{discard.length}</span>
            <span class="caption" aria-hidden="true">Discard</span>
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
        --wop-card-width: 54px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 10px;
        padding: 8px 8px 24px;
    }

    .group {
        display: flex;
        align-items: flex-end;
        gap: 6px;
    }

    /* The hand fans from a point just below the cards, each overlapping the one to its left; the
       padding keeps the outer cards' tilted corners inside the hand's own space. */
    .hand {
        display: flex;
        align-items: flex-end;
        padding-inline: calc(0.2 * var(--wop-card-width));
    }

    .fanned {
        transform-origin: 50% 120%;
    }

    /* A chosen card comes out over its neighbours, its ring whole. */
    .fanned.raised {
        position: relative;
        z-index: 1;
    }

    .fanned + .fanned {
        margin-left: calc(-0.45 * var(--wop-card-width));
    }

    .divider {
        align-self: stretch;
        width: 1px;
        background: var(--wop-panel-rule);
    }

    /* The deck and discard sit in a shallow recess of their own, apart from the cards to take. */
    .piles {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        padding: 6px 10px 6px 7px;
        border-radius: 8px;
        background: rgb(70 50 25 / 0.09);
        box-shadow: inset 0 1px 3px rgb(40 30 20 / 0.22);
    }

    .stack {
        position: relative;
        isolation: isolate;
        --wop-pile-edge: #2a64a0;
    }

    .stack.discard {
        --wop-pile-edge: #f2ead6;
    }

    /* The cards beneath the top one, so the top card can lift off a pile that stays put. */
    .stack.pile::before,
    .stack.pile::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        z-index: -1;
        width: var(--wop-card-width);
        height: calc(var(--wop-card-width) * 1.5);
        border-radius: 6px;
        background: var(--wop-pile-edge);
        box-shadow: inset 0 0 0 1px rgb(40 30 20 / 0.45);
    }

    .stack.pile::before {
        transform: translate(4px, 4px);
    }

    .stack.pile::after {
        transform: translate(2px, 2px);
    }

    .stack.discard.pile::before {
        transform: translate(3px, 3px) rotate(2deg);
    }

    .stack.discard.pile::after {
        transform: translate(1px, 2px) rotate(-2deg);
    }

    .caption {
        position: absolute;
        left: 50%;
        top: calc(100% + 13px);
        transform: translateX(-50%);
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        white-space: nowrap;
        color: var(--wop-ink-quiet);
        pointer-events: none;
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
        width: var(--wop-card-width);
        height: calc(var(--wop-card-width) * 1.5);
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
            /* seven cards to a row (the fanned hand takes the width of 2.5), shrinking below 46px
               on narrow phones to keep clear of the edges */
            --wop-card-width: min(46px, calc((100vw - 80px) / 6.5));
            gap: 6px;
            padding: 6px 4px 22px;
        }

        .piles {
            gap: 8px;
            padding: 5px 9px 5px 6px;
        }

        .caption {
            top: calc(100% + 11px);
            font-size: 9px;
            letter-spacing: 0.04em;
        }

        .group {
            gap: 4px;
        }
    }
</style>
