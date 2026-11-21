<script module lang="ts">
    let made = 0
</script>

<script lang="ts">
    // An action point: a small mask of blue stone in the Aztec manner, a fan of feathers behind
    // it, gold eyes in raised rims under a heavy brow, spools in its ears, bared teeth and an
    // ornament hanging from the lip. A spent point shows as a pale ghost of it.
    let { spent = false, size = 20 }: { spent?: boolean; size?: number } = $props()

    const id = `mx-mask-${made++}`
    const FACE =
        'M-11.5 -10 Q0 -13 11.5 -10 Q14 1 10.5 9 Q6 15.5 0 16 Q-6 15.5 -10.5 9 Q-14 1 -11.5 -10 Z'
    // Feathers fanning out behind the head, from its top.
    const FEATHERS = [-62, -40, -20, 0, 20, 40, 62].map((angle) => angle)
</script>

<svg viewBox="-21 -24 42 44" width={size} height={size} aria-hidden="true" class:spent>
    <defs>
        <linearGradient id="{id}-stone" x1="0.2" y1="0" x2="0.6" y2="1">
            <stop offset="0" stop-color="#9fb2ec"></stop>
            <stop offset="0.55" stop-color="#5468bd"></stop>
            <stop offset="1" stop-color="#26306f"></stop>
        </linearGradient>
        <linearGradient id="{id}-feather" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#6f86d6"></stop>
            <stop offset="1" stop-color="#2b3680"></stop>
        </linearGradient>
        <radialGradient id="{id}-gold" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stop-color="#fbe9a0"></stop>
            <stop offset="1" stop-color="#c9952f"></stop>
        </radialGradient>
    </defs>
    {#each FEATHERS as angle (angle)}
        <path
            d="M0 -4 Q-3.4 -14 0 -21 Q3.4 -14 0 -4 Z"
            transform="rotate({angle} 0 -4)"
            fill="url(#{id}-feather)"
            class="edge"
        ></path>
    {/each}
    {#each [-1, 1] as side (side)}
        <circle cx={side * 13.8} cy="0" r="3.8" fill="url(#{id}-stone)" class="edge"></circle>
        <circle cx={side * 13.8} cy="0" r="1.5" class="hollow"></circle>
    {/each}
    <path d={FACE} fill="url(#{id}-stone)" class="edge"></path>
    <!-- A heavy brow, and the eyes in their rims. -->
    <path d="M-10.5 -6.8 Q-5.5 -10 0 -7.2 Q5.5 -10 10.5 -6.8" class="brow"></path>
    {#each [-1, 1] as side (side)}
        <ellipse cx={side * 5.4} cy="-2.6" rx="4.2" ry="3.1" class="rim"></ellipse>
        <ellipse cx={side * 5.4} cy="-2.6" rx="3" ry="1.9" fill="url(#{id}-gold)"></ellipse>
        <ellipse cx={side * 5.4} cy="-2.6" rx="1.1" ry="1.5" class="pupil"></ellipse>
    {/each}
    <path d="M-1.6 -3.5 L1.6 -3.5 L2.4 3.2 Q0 4.6 -2.4 3.2 Z" class="nose"></path>
    <!-- Bared teeth in an open mouth, and an ornament hanging from the lip. -->
    <path d="M-6.5 6 Q0 4.6 6.5 6 Q5.5 11 0 11.4 Q-5.5 11 -6.5 6 Z" class="mouth"></path>
    <path d="M-4.2 6.6 V8.4 M-1.4 6.2 V8.2 M1.4 6.2 V8.2 M4.2 6.6 V8.4" class="teeth"></path>
    <rect x="-1.7" y="11.6" width="3.4" height="7" rx="1.2" fill="url(#{id}-stone)" class="edge"
    ></rect>
</svg>

<style>
    svg {
        display: block;
        overflow: visible;
    }

    .spent {
        opacity: 0.22;
    }

    .edge {
        stroke: rgb(12 14 34 / 0.8);
        stroke-width: 1.1;
    }

    .hollow,
    .pupil {
        fill: #120e0a;
    }

    .brow {
        fill: none;
        stroke: rgb(12 14 34 / 0.75);
        stroke-width: 1.8;
        stroke-linecap: round;
    }

    .rim {
        fill: #3a4796;
        stroke: rgb(12 14 34 / 0.8);
        stroke-width: 1;
    }

    .nose {
        fill: rgb(12 14 34 / 0.3);
    }

    .mouth {
        fill: #1a1020;
        stroke: rgb(12 14 34 / 0.85);
        stroke-width: 0.9;
    }

    .teeth {
        fill: none;
        stroke: #f2ead6;
        stroke-width: 1.7;
        stroke-linecap: round;
    }
</style>
