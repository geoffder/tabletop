<script lang="ts">
    import { PyramidColor } from '@tabletop/homeworlds'
    import { plasticColor } from '$lib/board/pyramid.js'

    const POWERS = [
        {
            color: PyramidColor.Yellow,
            name: 'Move',
            text: 'Move a ship to a connected system, or discover a new star: take any Bank piece of a size the system lacks as the star and move the ship there.'
        },
        {
            color: PyramidColor.Green,
            name: 'Build',
            text: 'Build a ship of a colour you already have in the system: the smallest of that colour left in the Bank.'
        },
        {
            color: PyramidColor.Blue,
            name: 'Trade',
            text: 'Swap one of your ships for a Bank piece of the same size in another colour.'
        },
        {
            color: PyramidColor.Red,
            name: 'Capture',
            text: 'Take an enemy ship no bigger than your biggest ship in the system; it turns round to point away from you.'
        }
    ]
</script>

<!-- What each colour does, and the rest of a turn, in one card. -->
<div class="guide">
    <p class="lead">
        On your turn take <b>one action</b> with a colour you have where one of your ships is: the star's
        colour or one of your ships' there.
    </p>
    <ul class="powers">
        {#each POWERS as power (power.color)}
            <li>
                <span class="swatch" style:--swatch={plasticColor(power.color, 'body')}></span>
                <span><b>{power.name}.</b> {power.text}</span>
            </li>
        {/each}
    </ul>
    <p>
        <b>Sacrifice</b> one of your ships instead to take as many actions of its colour as it has pips
        (1–3), in any systems where you have ships.
    </p>
    <p>
        <b>Connections.</b> Ships travel only between systems whose stars are all different sizes; the
        faint lanes show them.
    </p>
    <p>
        <b>Catastrophe.</b> Four or more pieces of one colour in a system, star included, may be blown
        up at any time in your turn: every piece of that colour goes back to the Bank, and if the star
        goes, every ship there with it.
    </p>
    <p>
        <b>Winning.</b> At the end of any turn, a player with no ship at their homeworld, or no homeworld
        left, is out.
    </p>
    <p class="quiet">Tap the turn token to end your turn when it does not end by itself.</p>
</div>

<style>
    .guide {
        width: min(440px, calc(100vw - 24px));
        padding: 14px 16px;
        background: var(--hw-panel);
        color: var(--hw-ink);
        font-size: 14px;
        line-height: 1.4;
        letter-spacing: 0.01em;
    }

    .guide p + p,
    .powers + p {
        margin-top: 8px;
    }

    .lead {
        margin-bottom: 8px;
    }

    .powers {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .powers li {
        display: flex;
        gap: 8px;
        align-items: baseline;
    }

    .swatch {
        flex-shrink: 0;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 11px solid var(--swatch);
        transform: translateY(1px);
    }

    .quiet {
        color: var(--hw-ink-quiet);
    }
</style>
