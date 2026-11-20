<script lang="ts">
    import type { HydratedWebOfPowerPlayerState } from '@tabletop/web-of-power'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { houseShape, pegShape } from '$lib/board/pieces.js'

    let { playerState }: { playerState: HydratedWebOfPowerPlayerState } = $props()

    const session = getGameSession()

    const playerId = $derived(playerState.playerId)
    const isActive = $derived(session.gameState.activePlayerIds.includes(playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.includes(playerId)
    )
    const isStarter = $derived(session.gameState.turnManager.turnOrder[0] === playerId)
    const fill = $derived(session.colors.getPlayerBgColorValue(playerId))
    const ink = $derived(session.colors.getPlayerTextColorValue(playerId))

    // The pieces as the board draws them.
    const house = houseShape(34)
    const peg = pegShape(16)
</script>

<div class="card" class:active={isActive}>
    <div
        class="flex items-center gap-2 rounded-t-[10px] px-3 py-1 font-semibold"
        style:background={fill}
        style:color={ink}
    >
        <span class="truncate text-[17px]">{session.getPlayerName(playerId)}</span>
        {#if isStarter}<span class="starter" title="Starting player"></span>{/if}
        <span class="ms-auto text-[13px] tracking-[0.12em] whitespace-nowrap uppercase">
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    <div class="body">
        <span class="score"><b>{playerState.score}</b> points</span>
        <span class="tally" title="Cloisters left">
            <svg viewBox="-19 -47 47 49" width="19" height="20" aria-hidden="true">
                <path d={house.outline} style:fill></path>
                <path d={house.side} class="shade"></path>
                <path d={house.roof} class="lit"></path>
                <path d={house.outline} class="edge"></path>
                <path d={house.front} class="edge inner"></path>
            </svg>
            <b>{session.gameState.cloistersLeft(playerId)}</b>
        </span>
        <span class="tally" title="Advisors left">
            <svg viewBox="-10 -27 20 32" width="12" height="19" aria-hidden="true">
                <path d={peg.body} style:fill></path>
                <path d={peg.shade} class="shade"></path>
                <path d={peg.top} class="lit"></path>
                <path d={peg.body} class="edge"></path>
                <path d={peg.top} class="edge inner"></path>
            </svg>
            <b>{session.gameState.advisorsLeft(playerId)}</b>
        </span>
        <span class="tally" title="Cards in hand">
            <span class="mini-card"></span><b>{playerState.handCount}</b>
        </span>
    </div>
</div>

<style>
    .card {
        border-radius: 12px;
        background: var(--wop-panel);
        box-shadow:
            inset 0 0 0 1px var(--wop-panel-edge),
            var(--wop-panel-shadow);
        color: var(--wop-ink);
        overflow: hidden;
    }

    .card.active {
        box-shadow:
            inset 0 0 0 2px var(--wop-target),
            var(--wop-panel-shadow);
    }

    .starter {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #111;
        box-shadow: 0 0 0 1.5px #fff8;
    }

    .body {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 6px 12px;
        font-size: 14px;
    }

    .score {
        margin-right: auto;
        color: var(--wop-ink-quiet);
    }

    .score b {
        font-size: 17px;
        color: var(--wop-ink);
    }

    .tally {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    .edge {
        fill: none;
        stroke: #1b1510;
        stroke-width: 2.2;
        stroke-linejoin: round;
    }

    .edge.inner {
        stroke-width: 1.4;
    }

    .shade {
        fill: rgb(20 10 0 / 0.3);
    }

    .lit {
        fill: rgb(255 255 255 / 0.3);
    }

    .mini-card {
        width: 11px;
        height: 15px;
        border-radius: 2px;
        background: #2e5ea8;
        box-shadow: inset 0 0 0 1px rgb(20 20 20 / 0.35);
    }
</style>
