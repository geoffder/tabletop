<script module lang="ts">
    let made = 0

    // A feather along a spine that sets off `start` degrees from straight up and turns a further
    // `turn` degrees by its tip, so the outer feathers rise, arch over and hang down.
    function plume(
        x0: number,
        y0: number,
        start: number,
        turn: number,
        len: number,
        width: number
    ) {
        const steps = 16
        const spine: { x: number; y: number; angle: number; half: number }[] = []
        let x = x0
        let y = y0
        for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const angle = ((start + turn * t) * Math.PI) / 180
            const swell = Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.8
            spine.push({ x, y, angle, half: width * swell * (1 - 0.35 * t) })
            x += (Math.sin(angle) * len) / steps
            y -= (Math.cos(angle) * len) / steps
        }
        const point = (px: number, py: number) => `${px.toFixed(2)} ${py.toFixed(2)}`
        const edge = (side: number) =>
            spine.map((p) =>
                point(
                    p.x + side * Math.cos(p.angle) * p.half,
                    p.y + side * Math.sin(p.angle) * p.half
                )
            )
        return {
            outline: `M${edge(-1).join('L')}L${edge(1).reverse().join('L')}Z`,
            rib: `M${spine
                .slice(1, -2)
                .map((p) => point(p.x, p.y))
                .join('L')}`
        }
    }

    // The crest: plumes rooted behind the top of the head, the middle ones rising, the outer ones
    // arching out over the frame and hanging down its sides; a shorter, paler row in front. The
    // outermost are drawn first so the middle ones lie over them.
    const SPREAD = 78
    const CREST = [
        { count: 9, len: 19, grow: 13, width: 4.4, fill: 'feather', most: SPREAD },
        { count: 6, len: 13, grow: 8, width: 3.9, fill: 'pale', most: SPREAD * 0.8 }
    ].flatMap((row) =>
        Array.from(
            { length: row.count },
            (_, i) => -row.most + (2 * row.most * i) / (row.count - 1)
        )
            .sort((a, b) => Math.abs(b) - Math.abs(a))
            .map((start) => {
                const t = Math.abs(start) / SPREAD
                return {
                    ...plume(
                        start * 0.06,
                        -9,
                        start,
                        start * 1.5 * t,
                        row.len + row.grow * t,
                        row.width
                    ),
                    fill: row.fill
                }
            })
    )
</script>

<script lang="ts">
    // An action point: the stone mask from the box, a squared face in a frame with side panels
    // and gold spools, a band over a heavy brow, gold eyes, a long nose, a panel of teeth and a
    // stepped chin over a hanging column, under a crest of feathers. A spent point shows as a
    // pale ghost of it.
    let { spent = false, size = 20 }: { spent?: boolean; size?: number } = $props()

    const id = `mx-mask-${made++}`
</script>

<svg viewBox="-31 -32 62 62" width={size} height={size} aria-hidden="true" class:spent>
    <defs>
        <linearGradient id="{id}-stone" x1="0.2" y1="0" x2="0.6" y2="1">
            <stop offset="0" stop-color="#a9bcf0"></stop>
            <stop offset="0.55" stop-color="#5468bd"></stop>
            <stop offset="1" stop-color="#26306f"></stop>
        </linearGradient>
        <linearGradient id="{id}-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#5468bd"></stop>
            <stop offset="1" stop-color="#26306f"></stop>
        </linearGradient>
        <linearGradient id="{id}-feather" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#7a90dc"></stop>
            <stop offset="1" stop-color="#2b3680"></stop>
        </linearGradient>
        <linearGradient id="{id}-pale" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#a9bcf0"></stop>
            <stop offset="1" stop-color="#5468bd"></stop>
        </linearGradient>
        <radialGradient id="{id}-gold" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stop-color="#fbe9a0"></stop>
            <stop offset="1" stop-color="#c9952f"></stop>
        </radialGradient>
    </defs>
    {#each CREST as feather, index (index)}
        <path d={feather.outline} fill="url(#{id}-{feather.fill})" class="edge thin"></path>
        <path d={feather.rib} class="rib"></path>
    {/each}
    <path
        d="M-14.5 -11 Q-14.5 -15 -10.5 -15 H10.5 Q14.5 -15 14.5 -11 V9 Q14.5 11 12.5 11 H-12.5 Q-14.5 11 -14.5 9 Z"
        fill="url(#{id}-dark)"
        class="edge"
    ></path>
    {#each [-1, 1] as side (side)}
        <rect
            x={side > 0 ? 13 : -18}
            y="-7"
            width="5"
            height="16"
            rx="1.4"
            fill="url(#{id}-dark)"
            class="edge"
        ></rect>
        <circle cx={side * 15.5} cy="-1" r="2.6" fill="url(#{id}-gold)" class="edge spool"></circle>
        <circle cx={side * 15.5} cy="-1" r="0.9" class="hollow"></circle>
    {/each}
    <path d="M-12 -13.2 H12 V-9.6 H-12 Z" fill="url(#{id}-dark)" class="edge thin"></path>
    <path
        d="M-10.5 -9 H10.5 V2 Q10.5 9 5.5 11.5 H-5.5 Q-10.5 9 -10.5 2 Z"
        fill="url(#{id}-stone)"
        class="edge"
    ></path>
    <path
        d="M-9.8 -7.4 Q-5.4 -8.6 -1 -7.2 L1 -7.2 Q5.4 -8.6 9.8 -7.4 L9.8 -5.6 Q5.4 -6.8 1 -5.4 L-1 -5.4 Q-5.4 -6.8 -9.8 -5.6 Z"
        class="brow"
    ></path>
    {#each [-1, 1] as side (side)}
        <path
            d="M{side * 1.6} -2.4 Q{side * 5.3} -5.6 {side * 9} -2.9 Q{side * 5.3} -0.2 {side *
                1.6} -2.4 Z"
            fill="url(#{id}-gold)"
            class="eye"
        ></path>
        <circle cx={side * 5.3} cy="-2.7" r="1.1" class="hollow"></circle>
    {/each}
    <path
        d="M-1.3 -4.4 H1.3 L1.9 1.6 Q3.6 2.4 3 3.6 Q0 4.8 -3 3.6 Q-3.6 2.4 -1.9 1.6 Z"
        fill="url(#{id}-stone)"
        class="nose"
    ></path>
    <rect x="-5.6" y="5.2" width="11.2" height="4.8" rx="1" class="mouth"></rect>
    <path d="M-3.6 6 V8.2 M-1.2 6 V8.2 M1.2 6 V8.2 M3.6 6 V8.2" class="teeth"></path>
    <path d="M-5.5 11.5 H5.5 L4.2 13.8 H-4.2 Z" fill="url(#{id}-dark)" class="edge thin"></path>
    <rect x="-2.2" y="13.6" width="4.4" height="7.4" rx="0.8" fill="url(#{id}-stone)" class="edge"
    ></rect>
    <path d="M-2.2 16.4 H2.2 M-2.2 18.8 H2.2" class="rib"></path>
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

    .edge.thin {
        stroke-width: 0.8;
    }

    .edge.spool {
        stroke-width: 0.8;
    }

    .rib {
        fill: none;
        stroke: rgb(12 14 34 / 0.5);
        stroke-width: 0.6;
    }

    .hollow {
        fill: #120e0a;
    }

    .brow {
        fill: rgb(12 14 34 / 0.55);
    }

    .eye {
        stroke: #120e0a;
        stroke-width: 1.1;
        stroke-linejoin: round;
    }

    .nose {
        stroke: rgb(12 14 34 / 0.7);
        stroke-width: 0.7;
    }

    .mouth {
        fill: #1a1020;
        stroke: rgb(12 14 34 / 0.85);
        stroke-width: 0.9;
    }

    .teeth {
        fill: none;
        stroke: #f2ead6;
        stroke-width: 1.6;
        stroke-linecap: square;
    }
</style>
