<script lang="ts">
    import { BASE_AP, LEVELS, type Level } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'
    import MaskIcon from './MaskIcon.svelte'

    const session = getGameSession()

    const me = $derived(session.myPlayer?.id)
    const game = $derived(session.gameState)
    const ended = $derived(session.gameState.result !== undefined && !session.isViewingHistory)
    const shown = $derived(me !== undefined && game.machineState === 'Acting')
    const tokens = $derived(me === undefined ? 0 : game.getPlayerState(me).actionTokens)
    const fill = $derived(me === undefined ? '#888' : session.playerFill(me))
    const left = (level: Level) => (me === undefined ? 0 : game.templesLeft(me, level))
    const usable = (level: Level) => session.templeLevels.includes(level)
</script>

<!-- Always drawn, hidden when it is not your turn, so the board stays put between turns. -->
<div class="tray" class:hidden={!shown} class:gone={ended} inert={!shown} aria-hidden={!shown}>
    <div class="ap" title="Action points left this turn">
        {#each Array.from({ length: BASE_AP }, (_, i) => i) as pip (pip)}
            <MaskIcon spent={pip >= session.apLeft} size={28} />
        {/each}
        {#if tokens > 0}<span class="tokens" title="Action tokens">+{tokens}</span>{/if}
    </div>
    <div class="tools">
        {#each LEVELS as level (level)}
            <button
                type="button"
                class="tool"
                class:picked={session.tool === level}
                disabled={!usable(level)}
                title={`${level}-level temple (${level} AP)`}
                onclick={() => session.pickTool(level)}
            >
                <PieceIcon piece={level} {fill} size={34} />
                <span class="count">{left(level)}</span>
            </button>
        {/each}
        <button
            type="button"
            class="tool"
            class:picked={session.tool === 'canal'}
            disabled={!session.canDig}
            title="Canal (1 AP)"
            onclick={() => session.pickTool('canal')}
        >
            <PieceIcon piece="canal" {fill} size={34} />
            <span class="count">{game.singleCanalsLeft() + game.doubleCanalsLeft()}</span>
        </button>
        {#if game.bridgesLeft() > 0}
            <button
                type="button"
                class="tool"
                class:picked={session.tool === 'bridge'}
                disabled={!session.canBuildBridge}
                title="Bridge (1 AP)"
                onclick={() => session.pickTool('bridge')}
            >
                <PieceIcon piece="bridge" {fill} size={34} />
                <span class="count">{game.bridgesLeft()}</span>
            </button>
        {:else}
            <button
                type="button"
                class="tool"
                class:picked={session.tool === 'moveBridge'}
                disabled={!session.canMoveBridge}
                title="Move a bridge (1 AP)"
                onclick={() => session.pickTool('moveBridge')}
            >
                <PieceIcon piece="bridge" {fill} size={34} />
                <span class="count">↷</span>
            </button>
        {/if}
        <button
            type="button"
            class="tool"
            disabled={!session.canTakeToken}
            title="Take an action token (1 AP now, 1 AP later)"
            onclick={() => session.takeToken()}
        >
            <PieceIcon piece="token" {fill} size={34} />
            <span class="count">{game.tokenSupply()}</span>
        </button>
    </div>
</div>

<style>
    .tray {
        /* Seven tools fit across a 320 px phone. */
        --tile: clamp(34px, calc((100vw - 88px) / 7 - 4px), 58px);
        --icon: calc(var(--tile) * 0.72);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 2px 8px 10px;
        color: var(--mx-ink);
    }

    .tray.hidden {
        visibility: hidden;
    }

    /* At the game's end the ending takes the tray's room. */
    .tray.gone {
        display: none;
    }

    .ap {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 30px;
    }

    .tokens {
        margin-left: 4px;
        font-weight: 800;
        font-size: 16px;
    }

    .tools {
        display: flex;
        gap: 5px;
    }

    /* Square tiles, the count in a badge at the corner. */
    .tool {
        width: var(--tile);
        height: var(--tile);
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--mx-panel), #fff 60%),
            color-mix(in srgb, var(--mx-panel), #6b5c44 10%)
        );
        box-shadow:
            inset 0 0 0 1px var(--mx-panel-edge),
            0 1px 3px rgb(48 36 22 / 0.22);
    }

    .tool :global(svg),
    .tool :global(.token) {
        width: var(--icon);
        height: var(--icon);
    }

    .tool :global(.token svg) {
        width: 86%;
        height: 86%;
    }

    .tool.picked {
        box-shadow:
            inset 0 0 0 2.5px var(--mx-target),
            0 1px 3px rgb(48 36 22 / 0.22);
    }

    .tool:disabled {
        opacity: 0.38;
    }

    .count {
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        position: absolute;
        right: -4px;
        bottom: -4px;
        min-width: 20px;
        height: 20px;
        padding: 0 4px;
        border-radius: 10px;
        font-size: 13px;
        line-height: 20px;
        color: #fff8ec;
        background: #3a3026;
        box-shadow: 0 0 0 1.5px var(--mx-panel);
    }

    @media (hover: hover) {
        .tool:not(:disabled):hover {
            background: var(--mx-panel-hover);
        }
    }
</style>
