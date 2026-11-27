<script lang="ts">
    import { CARD_COUNTRIES, COUNTRY_NAMES, type CardColor } from '@tabletop/web-of-power'
    import { EMBLEMS, JOKER_EMBLEM } from '$lib/board/armsData.js'

    let {
        card,
        chosen = false,
        choosable = false,
        dimmed = false,
        pile = false,
        label,
        onclick
    }: {
        card?: CardColor
        chosen?: boolean
        choosable?: boolean
        dimmed?: boolean
        pile?: boolean
        label?: string
        onclick?: () => void
    } = $props()

    const countries = $derived(card ? CARD_COUNTRIES[card] : [])
    const names = $derived(countries.map((country) => COUNTRY_NAMES[country]))

    const seals = $derived(
        countries.length === 1
            ? [{ country: countries[0], y: 45, r: 22 }]
            : countries.map((country, index) => ({ country, y: index === 0 ? 25 : 65, r: 18.5 }))
    )
</script>

{#snippet seal(emblem: string, y: number, r: number)}
    <circle cx="30" cy={y} {r} class="ring"></circle>
    <circle cx="30" cy={y} r={r * 0.74} class="ring inner"></circle>
    <path d={emblem} transform="translate(30 {y}) scale({(r * 0.7) / 50})" class="emblem"></path>
{/snippet}

{#snippet face()}
    <svg viewBox="0 0 60 90" class="art" aria-hidden="true">
        {#if card}
            {#each seals as at (at.country)}
                {@render seal(EMBLEMS[at.country], at.y, at.r)}
            {/each}
        {:else}
            <circle cx="30" cy="45" r="23" class="back-ring"></circle>
            <circle cx="30" cy="45" r="17" class="back-ring inner"></circle>
            <path d={JOKER_EMBLEM} transform="translate(30 45) scale({15 / 50})" class="back-emblem"
            ></path>
        {/if}
    </svg>
{/snippet}

{#if onclick}
    <button
        type="button"
        class="card"
        class:back={!card}
        class:chosen
        class:choosable
        class:dimmed
        class:pile
        style:background={card ? `var(--wop-${card})` : undefined}
        aria-label={label ?? (card ? names.join(' or ') : 'deck')}
        aria-pressed={chosen}
        {onclick}>{@render face()}</button
    >
{:else}
    <div
        class="card"
        class:back={!card}
        class:dimmed
        class:pile
        style:background={card ? `var(--wop-${card})` : undefined}
        aria-label={label ?? (card ? names.join(' or ') : 'deck')}
        role="img"
    >
        {@render face()}
    </div>
{/if}

<style>
    .card {
        position: relative;
        display: block;
        width: var(--wop-card-width, 54px);
        height: calc(var(--wop-card-width, 54px) * 1.5);
        flex-shrink: 0;
        padding: 0;
        border-radius: 6px;
        box-shadow:
            inset 0 0 0 1px rgb(40 30 20 / 0.4),
            0 1px 3px rgb(40 30 20 / 0.3);
        /* Only the lift a hover or a choice gives eases; a pile's tilt and a dimmed card follow the
           state at once. */
        transition: translate 0.15s;
    }

    .art {
        display: block;
        width: 100%;
        height: 100%;
    }

    .card.back {
        background: #2e6fb0;
    }

    .card.pile:not(.back) {
        transform: rotate(-6deg);
        opacity: 0.82;
    }

    .card.dimmed {
        opacity: 0.45;
    }

    button.card {
        cursor: pointer;
    }

    .card.choosable {
        box-shadow:
            inset 0 0 0 1px rgb(40 30 20 / 0.4),
            0 0 0 2px var(--wop-gold),
            0 1px 3px rgb(40 30 20 / 0.3);
    }

    @media (hover: hover) {
        button.card:not(.chosen):hover {
            translate: 0 -4px;
        }
    }

    .card.chosen {
        translate: 0 -11px;
        box-shadow:
            inset 0 0 0 1px rgb(40 30 20 / 0.4),
            0 0 0 2px var(--wop-card-ink),
            0 0 0 4px var(--wop-gold),
            0 9px 14px rgb(40 30 20 / 0.42);
    }

    .ring {
        fill: rgb(255 250 236 / 0.18);
        stroke: var(--wop-card-ink);
        stroke-width: 1.1;
    }

    .ring.inner {
        fill: none;
        stroke-width: 0.8;
    }

    .emblem {
        fill: var(--wop-card-ink);
    }

    .back-ring {
        fill: none;
        stroke: #f6f1e4;
        stroke-width: 3.2;
    }

    .back-ring.inner {
        stroke-width: 1.6;
    }

    .back-emblem {
        fill: #f6f1e4;
    }
</style>
