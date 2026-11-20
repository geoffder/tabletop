<script lang="ts">
    import { cardColorName, type CardColor } from '@tabletop/web-of-power'

    let { card }: { card: CardColor } = $props()
</script>

<!-- A card named inline in text, in its colour. -->
<span class="chip" style:background="var(--wop-{card})">{cardColorName(card)}</span>

<style>
    .chip {
        display: inline-block;
        padding: 0 5px;
        border-radius: 4px;
        font-size: 0.86em;
        line-height: 1.35;
        color: #1d1711;
        box-shadow: inset 0 0 0 1px rgb(40 30 20 / 0.35);
        white-space: nowrap;
    }
</style>
