<script lang="ts">
    import { Popover } from 'flowbite-svelte'
    import { CardColor, cardColorName } from '@tabletop/web-of-power'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Card from './Card.svelte'
    import { getCardAnimator } from '$lib/animators/cardAnimatorContext.js'
    import { FAN_STEP } from '$lib/animators/cardAnimator.svelte.js'

    const session = getGameSession()
    const cards = getCardAnimator()
    const place = (name: string) => cards?.place(name)

    const table = $derived(
        cards?.table ?? {
            hand: session.hand,
            display: session.gameState.display,
            discard: session.gameState.discard,
            deckCount: session.gameState.deck.remaining
        }
    )
    // While a move plays the hand is drawn as the move leaves it, so no card shows chosen.
    const chosen = (index: number) =>
        !session.updatingVisibleState && session.chosenIndices.includes(index)
    const display = $derived(table.display)
    const discard = $derived(table.discard)
    const deckCount = $derived(table.deckCount)
    // The tray is drawn twice in full screen; each opens its own discard view.
    const uid = $props.id()

    const discardCounts = $derived(
        Object.values(CardColor)
            .map((card) => ({ card, count: discard.filter((held) => held === card).length }))
            .filter(({ count }) => count > 0)
    )
</script>

<div class="fit">
    <div class="tray">
        {#if session.myPlayer}
            <div class="hand" aria-label="Your hand" {@attach place('hand')}>
                {#each table.hand as card, index (index)}
                    <div
                        class="fanned"
                        class:raised={chosen(index)}
                        style:rotate="{(index - (table.hand.length - 1) / 2) * FAN_STEP}deg"
                    >
                        <!-- The card animator moves this, leaving the fan's tilt to its wrapper. -->
                        <div class="moving" {@attach place(`hand:${index}`)}>
                            <Card
                                {card}
                                chosen={chosen(index)}
                                choosable={session.placeableIndices.has(index)}
                                dimmed={session.canChooseCards &&
                                    !session.canExchange &&
                                    !session.placeableIndices.has(index)}
                                onclick={session.canChooseCards
                                    ? () => session.chooseCard(index)
                                    : undefined}
                            />
                        </div>
                    </div>
                {/each}
            </div>
            <span class="divider"></span>
        {/if}
        <div class="group market" aria-label="Market" {@attach place('display')}>
            {#each display as card, index (index)}
                <div class="slot" {@attach place(`display:${index}`)}>
                    <Card
                        {card}
                        onclick={session.canDrawFaceUp ? () => session.drawFaceUp(card) : undefined}
                        choosable={session.canDrawFaceUp}
                    />
                </div>
            {/each}
            <span class="caption" aria-hidden="true">Market</span>
        </div>
        <div class="piles">
            <div class="stack" class:pile={deckCount > 1} {@attach place('deck')}>
                <Card
                    label="Deck, {deckCount} cards"
                    dimmed={deckCount === 0}
                    onclick={session.canDrawFromDeck ? () => session.drawFromDeck() : undefined}
                    choosable={session.canDrawFromDeck}
                />
                <span class="count">{deckCount}</span>
                <span class="caption" aria-hidden="true">Deck</span>
            </div>
            <div
                id="{uid}-discard"
                class="stack discard"
                class:pile={discard.length > 1}
                {@attach place('discard')}
            >
                {#if discard.length > 0}
                    <Card
                        card={discard.at(-1)}
                        label="Discard pile, {discard.length} cards"
                        pile={discard.length > 1}
                        onclick={session.openDiscard ? () => {} : undefined}
                    />
                {:else}
                    <div class="empty" aria-label="Discard pile, empty"></div>
                {/if}
                <span class="count">{discard.length}</span>
                <span class="caption" aria-hidden="true">Discard</span>
            </div>
        </div>
        {#if session.openDiscard && discard.length > 0}
            <Popover
                triggeredBy="#{uid}-discard"
                trigger="click"
                placement="bottom-end"
                arrow={false}
                class="discard-view"
                classes={{ content: 'p-0' }}
            >
                <div class="view-title">Discard pile · {discard.length}</div>
                <div class="view-cards">
                    {#each discardCounts as { card, count } (card)}
                        <div class="view-card" title={cardColorName(card)}>
                            <Card {card} />
                            <span class="view-count">{count}</span>
                        </div>
                    {/each}
                </div>
            </Popover>
        {/if}
    </div>
</div>

<style>
    /* The game column narrows beside the side panel on tablets, so cards size to the tray. */
    .fit {
        container-type: inline-size;
    }

    .tray {
        /* seven cards' width; the fanned hand takes 2.5 */
        --wop-card-width: min(54px, calc((100cqi - 86px) / 6.5));
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

    /* The market's caption lines up with the piles', which sit in a recess 6px deep. */
    .market {
        position: relative;
        --wop-caption-drop: 6px;
    }

    .market .caption {
        margin-top: calc(-1 * var(--wop-caption-drop));
    }

    .hand {
        display: flex;
        align-items: flex-end;
        padding-inline: calc(0.2 * var(--wop-card-width));
    }

    .fanned,
    .moving {
        transform-origin: 50% 120%;
    }

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

    .fit :global(.discard-view) {
        background: var(--wop-panel) !important;
        border: none !important;
        border-radius: 10px !important;
        box-shadow:
            inset 0 0 0 1px var(--wop-panel-edge),
            0 6px 18px rgb(40 30 20 / 0.28) !important;
        color: var(--wop-ink);
    }

    .view-title {
        padding: 8px 12px 0;
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--wop-ink-quiet);
    }

    .view-cards {
        --wop-card-width: 38px;
        display: flex;
        gap: 10px;
        padding: 8px 12px 10px;
    }

    .view-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .view-count {
        font-size: 15px;
        font-weight: 700;
        color: var(--wop-ink);
    }

    /* Below 54px cards the piles stand too close for the wide captions. */
    @container (width < 440px) {
        .caption {
            top: calc(100% + 11px);
            font-size: 9px;
            letter-spacing: 0.04em;
        }
    }

    @media (max-width: 639px) {
        .tray {
            --wop-card-width: min(46px, calc((100cqi - 36px) / 6.5));
            gap: 6px;
            padding: 6px 4px 16px;
        }

        .piles {
            gap: 8px;
            padding: 5px 9px 5px 6px;
        }

        .market {
            --wop-caption-drop: 5px;
        }

        .caption {
            top: calc(100% + 7px);
            font-size: 9px;
            letter-spacing: 0.04em;
        }

        .group {
            gap: 4px;
        }
    }
</style>
