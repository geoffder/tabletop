<script lang="ts">
    import type { BoardView } from '$lib/board/view.js'

    // The Homeworlds turn token, lying on the table: a black disc with a sunburst over a rainbow
    // and the Earth, "IT'S MY TURN!" across it, read from the side it rests on.
    let {
        radius,
        view,
        facingFar,
        uid
    }: { radius: number; view: BoardView; facingFar: boolean; uid: string } = $props()

    // The art is drawn on a disc of radius 100.
    const unit = $derived(radius / 100)
    const thickness = $derived(4 * view.rise)
    const RAYS = 18
    const rays = Array.from({ length: RAYS }, (_, index) => {
        const from = Math.PI + (index / RAYS) * Math.PI
        const to = Math.PI + ((index + 1) / RAYS) * Math.PI
        const reach = 90
        return {
            d: `M0 12 L${Math.cos(from) * reach} ${12 + Math.sin(from) * reach} L${Math.cos(to) * reach} ${12 + Math.sin(to) * reach} Z`,
            fill: index % 2 === 0 ? '#f26b21' : '#f9a533'
        }
    })
    const RAINBOW = ['#e3262d', '#f47b20', '#fcd116', '#3fae49', '#2a7fc1', '#6a3c9a']
</script>

<g class="turn-token">
    <!-- The card's edge, showing below its face when seen from the side. -->
    <ellipse cx="0" cy={thickness} rx={radius} ry={radius * view.tilt} fill="#050507"></ellipse>
    <g transform="scale({unit} {unit * view.tilt}) rotate({facingFar ? 180 : 0})">
        <defs>
            <clipPath id="{uid}-sun">
                <path d="M-70 12 A70 70 0 0 1 70 12 Z"></path>
            </clipPath>
            <clipPath id="{uid}-bow">
                <rect x="-70" y="-70" width="140" height="98"></rect>
            </clipPath>
            <path id="{uid}-top" d="M-80 0 A80 80 0 0 1 80 0"></path>
            <path id="{uid}-bottom" d="M-84 0 A84 84 0 0 0 84 0"></path>
        </defs>
        <circle r="100" fill="#121214"></circle>
        <circle r="93" fill="none" stroke="#f4efe4" stroke-width="2.2"></circle>
        <g clip-path="url(#{uid}-sun)">
            {#each rays as ray, index (index)}
                <path d={ray.d} fill={ray.fill}></path>
            {/each}
        </g>
        <g clip-path="url(#{uid}-bow)">
            {#each RAINBOW as color, index (color)}
                <circle cx="0" cy="28" r={56 - index * 7} fill={color}></circle>
            {/each}
            <circle cx="0" cy="28" r="15" fill="#2f8fd8"></circle>
            <path
                d="M-11 22 q4 -6 9 -3 q3 4 -2 7 q-5 2 -7 -4 Z M3 26 q5 -3 8 2 q-2 4 -8 1 Z"
                fill="#4fb153"
            ></path>
        </g>
        <rect x="-76" y="-14" width="152" height="26" rx="3" fill="#f7f3ea"></rect>
        <text
            x="0"
            y="-1"
            dy="6.3"
            text-anchor="middle"
            font-size="18"
            font-weight="900"
            letter-spacing="0.6px"
            font-family="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
            fill="#121214">IT'S MY TURN!</text
        >
        <text
            font-size="11"
            font-weight="700"
            letter-spacing="1.6px"
            fill="#f4efe4"
            font-family="'Helvetica Neue', Arial, sans-serif"
            ><textPath href="#{uid}-top" startOffset="50%" text-anchor="middle"
                >LOONEYLABS.COM</textPath
            ></text
        >
        <text
            font-size="11"
            font-weight="700"
            letter-spacing="1.6px"
            fill="#f4efe4"
            font-family="'Helvetica Neue', Arial, sans-serif"
            dy="8"
            ><textPath href="#{uid}-bottom" startOffset="50%" text-anchor="middle"
                >TURN TOKEN</textPath
            ></text
        >
    </g>
</g>
