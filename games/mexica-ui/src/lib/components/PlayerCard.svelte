<script lang="ts">
    import { LEVELS, type HydratedMexicaPlayerState } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'
    import MaskIcon from './MaskIcon.svelte'
    import { getTokenFlights } from '$lib/animators/tokenFlights.svelte.js'

    let { playerState }: { playerState: HydratedMexicaPlayerState } = $props()

    const session = getGameSession()
    const flights = getTokenFlights()

    const playerId = $derived(playerState.playerId)
    const isActive = $derived(session.gameState.activePlayerIds.includes(playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.includes(playerId)
    )
    const isStarter = $derived(session.gameState.turnManager.turnOrder[0] === playerId)
    const fill = $derived(session.playerFill(playerId))
    const ink = $derived(session.playerInk(playerId))
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
        <span class="score"><b>{playerState.score}</b> <span class="word">points</span></span>
        {#each LEVELS as level (level)}
            <span class="tally" title={`${level}-level temples left this period`}>
                <PieceIcon piece={level} {fill} size={26} />
                <b>{session.gameState.templesLeft(playerId, level)}</b>
            </span>
        {/each}
        <span class="tally" title="Action tokens">
            <span class="mask" {@attach flights?.cardMask(playerId)}><MaskIcon size={22} /></span><b
                >{playerState.actionTokens}</b
            >
        </span>
    </div>
</div>

<style>
    .mask {
        display: inline-flex;
    }

    .card {
        border-radius: 12px;
        background: var(--mx-panel);
        box-shadow:
            inset 0 0 0 1px var(--mx-panel-edge),
            var(--mx-panel-shadow);
        color: var(--mx-ink);
        overflow: hidden;
    }

    .card.active {
        box-shadow:
            inset 0 0 0 2px var(--mx-target),
            var(--mx-panel-shadow);
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
        gap: 10px;
        padding: 6px 12px;
        font-size: 14px;
    }

    .score {
        margin-right: auto;
        color: var(--mx-ink-quiet);
    }

    .score b {
        font-size: 17px;
        color: var(--mx-ink);
    }

    .tally {
        display: inline-flex;
        align-items: center;
        gap: 2px;
    }

    /* On a narrow card the pieces shrink and the score drops its word, so all five tallies fit. */
    .card {
        container-type: inline-size;
    }

    @container (max-width: 300px) {
        .body {
            gap: 5px;
            padding: 6px 8px;
            font-size: 13px;
        }

        .tally :global(svg) {
            width: 18px;
            height: 18px;
        }

        .score .word {
            display: none;
        }
    }
</style>
