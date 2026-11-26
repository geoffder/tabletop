<script lang="ts">
    import {
        pieceColor,
        pieceSize,
        PYRAMID_COLORS,
        type HydratedHomeworldsPlayerState
    } from '@tabletop/homeworlds'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { scale } from 'svelte/transition'
    import { FLAT_VIEW } from '$lib/board/view.js'
    import PieceIcon from './PieceIcon.svelte'
    import TurnToken from './TurnToken.svelte'

    let { playerState }: { playerState: HydratedHomeworldsPlayerState } = $props()

    const session = getGameSession()
    const playerId = $derived(playerState.playerId)
    const uid = $props.id()
    // The turn token, the size it is drawn on the card.
    const TOKEN_RADIUS = 27

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
        <!-- The turn token lies on the card of the player whose turn it is; tapped, it ends
             the turn. -->
        <span class="token-spot">
            {#if isActive && session.gameState.result === undefined}
                <button
                    class="token"
                    class:live={session.canEndTurn}
                    disabled={!session.canEndTurn}
                    aria-label={session.canEndTurn ? 'End your turn' : 'Turn token'}
                    onclick={() => session.endTurn()}
                    transition:scale={{ duration: 220, start: 0.6 }}
                >
                    <svg
                        viewBox="{-TOKEN_RADIUS - 4} {-TOKEN_RADIUS - 4} {TOKEN_RADIUS * 2 +
                            8} {TOKEN_RADIUS * 2 + 8}"
                        width={TOKEN_RADIUS * 2 + 8}
                        height={TOKEN_RADIUS * 2 + 8}
                    >
                        <TurnToken
                            radius={TOKEN_RADIUS}
                            view={FLAT_VIEW}
                            facingFar={false}
                            uid="{uid}-token"
                        />
                    </svg>
                </button>
            {/if}
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
        grid-template-columns: max-content 1fr max-content;
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

    .token-spot {
        grid-column: 3;
        grid-row: 1 / span 2;
        width: 62px;
        height: 62px;
        margin: -4px -6px -4px 0;
    }

    .token {
        display: block;
        border-radius: 50%;
        cursor: default;
    }

    .token.live {
        cursor: pointer;
        box-shadow: 0 0 0 3px var(--hw-mark);
    }

    .token:focus-visible {
        outline: 2px solid var(--hw-mark);
        outline-offset: 2px;
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
