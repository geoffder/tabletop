<script lang="ts">
    import { CARD_COUNTRIES, COUNTRY_NAMES, type CardColor } from '@tabletop/web-of-power'

    let {
        card,
        chosen = false,
        dimmed = false,
        label,
        onclick
    }: {
        // Undefined draws the card's back.
        card?: CardColor
        chosen?: boolean
        dimmed?: boolean
        label?: string
        onclick?: () => void
    } = $props()

    const names = $derived(
        card ? CARD_COUNTRIES[card].map((country) => COUNTRY_NAMES[country]) : []
    )
</script>

{#snippet face()}
    {#if card}
        {#each names as name, index (name)}
            {#if index > 0}<span class="rule"></span>{/if}
            <span class="name">{name}</span>
        {/each}
    {:else}
        <span class="back-mark">K&amp;K</span>
    {/if}
{/snippet}

{#if onclick}
    <button
        type="button"
        class="card"
        class:back={!card}
        class:chosen
        class:dimmed
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
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        width: 46px;
        height: 64px;
        flex-shrink: 0;
        border-radius: 6px;
        box-shadow:
            inset 0 0 0 1px rgb(40 30 20 / 0.4),
            0 1px 3px rgb(40 30 20 / 0.3);
        color: #1d1711;
        font-family: Georgia, 'Times New Roman', serif;
        transition:
            transform 0.15s,
            opacity 0.15s;
    }

    .card.back {
        background: #2e5ea8;
        color: #f3ead2;
    }

    .card.dimmed {
        opacity: 0.45;
    }

    button.card {
        cursor: pointer;
    }

    .card.chosen {
        transform: translateY(-5px);
        box-shadow:
            0 0 0 2px #000c,
            0 0 0 4.5px var(--wop-mark),
            0 3px 6px rgb(40 30 20 / 0.35);
    }

    .name {
        font-size: 9.5px;
        line-height: 1.05;
        letter-spacing: 0.01em;
        max-width: 42px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .rule {
        width: 24px;
        height: 1px;
        background: rgb(40 30 20 / 0.45);
    }

    .back-mark {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
    }
</style>
