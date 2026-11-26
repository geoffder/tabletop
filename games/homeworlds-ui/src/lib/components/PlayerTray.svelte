<script lang="ts">
    import {
        pieceColor,
        pieceSize,
        PYRAMID_COLORS,
        type HydratedHomeworldsPlayerState
    } from '@tabletop/homeworlds'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'

    let { playerState }: { playerState: HydratedHomeworldsPlayerState } = $props()

    const session = getGameSession()
    const playerId = $derived(playerState.playerId)

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.length === 1 &&
            session.gameState.winningPlayerIds.includes(playerId)
    )
    const starMap = $derived(session.gameState.starMap)
    const home = $derived(starMap.homeworldOf(playerId))
    const byKind = (a: number, b: number) =>
        pieceSize(b) - pieceSize(a) ||
        PYRAMID_COLORS.indexOf(pieceColor(a)) - PYRAMID_COLORS.indexOf(pieceColor(b))
    const homeShips = $derived(
        home
            ? starMap
                  .ownShips(home, playerId)
                  .map((ship) => ship.piece)
                  .toSorted(byKind)
            : []
    )
    const fleet = $derived(
        starMap.systems
            .flatMap((system) => starMap.ownShips(system, playerId))
            .map((ship) => ship.piece)
            .toSorted(byKind)
    )
</script>

<div class="tray" class:active={isActive}>
    <div
        class="flex items-center gap-2 rounded-t-[10px] px-3 py-1 font-semibold"
        style:background={session.colors.getPlayerBgColorValue(playerId)}
        style:color={session.colors.getPlayerTextColorValue(playerId)}
    >
        <span class="truncate text-[17px]">{session.getPlayerName(playerId)}</span>
        <span class="ms-auto text-[13px] tracking-[0.12em] whitespace-nowrap uppercase">
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    <div class="body">
        <span class="caption">home</span>
        <span class="pieces">
            {#if home}
                {#each home.stars as star (star)}<PieceIcon piece={star} />{/each}
                <span class="gap"></span>
                {#each homeShips as ship (ship)}<PieceIcon piece={ship} ship />{/each}
            {:else}
                <span class="none">{session.gameState.result ? 'destroyed' : 'not yet built'}</span>
            {/if}
        </span>
        <span class="caption">fleet</span>
        <span class="pieces">
            <b class="count">{fleet.length}</b>
            {#each fleet as ship (ship)}<PieceIcon piece={ship} ship />{/each}
        </span>
    </div>
</div>

<style>
    .tray {
        border-radius: 12px;
        background: var(--hw-panel);
        box-shadow:
            inset 0 0 0 1px var(--hw-panel-edge),
            var(--hw-panel-shadow);
        color: var(--hw-ink);
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--hw-target),
            var(--hw-panel-shadow);
    }

    .body {
        display: grid;
        grid-template-columns: max-content 1fr;
        align-items: center;
        gap: 4px 10px;
        padding: 6px 12px 8px;
        font-size: 17px;
    }

    .pieces {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0 1px;
        min-height: 22px;
    }

    .gap {
        width: 8px;
    }

    .count {
        min-width: 1.4em;
        font-size: 15px;
    }

    .caption,
    .none {
        font-size: 13px;
        letter-spacing: 0.04em;
        color: var(--hw-ink-quiet);
    }
</style>
