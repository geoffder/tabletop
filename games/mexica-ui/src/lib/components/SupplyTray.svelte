<script lang="ts">
    import { BASE_AP, LEVELS, type Level } from '@tabletop/mexica'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TempleIcon from './TempleIcon.svelte'

    const session = getGameSession()

    const me = $derived(session.myPlayer?.id)
    const game = $derived(session.gameState)
    const shown = $derived(me !== undefined && game.machineState === 'Acting')
    const tokens = $derived(me === undefined ? 0 : game.getPlayerState(me).actionTokens)
    const fill = $derived(me === undefined ? '#888' : session.colors.getPlayerBgColorValue(me))
    const left = (level: Level) => (me === undefined ? 0 : game.templesLeft(me, level))
    const usable = (level: Level) => session.templeLevels.includes(level)
</script>

<!-- Always room for the tray, so the board stays put between turns. -->
<div class="tray" class:hidden={!shown}>
    {#if shown}
        <div class="ap" title="Action points left this turn">
            {#each Array.from({ length: BASE_AP }, (_, i) => i) as pip (pip)}
                <span class="pip" class:spent={pip >= session.apLeft}></span>
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
                    <TempleIcon {level} {fill} />
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
                <span class="canal-icon"></span>
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
                    <span class="bridge-icon"></span>
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
                    <span class="bridge-icon"></span>
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
                <span class="token-icon"></span>
                <span class="count">{game.tokenSupply()}</span>
            </button>
        </div>
    {/if}
</div>

<style>
    .tray {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px 14px;
        padding: 0 10px 8px;
        color: var(--mx-ink);
    }

    .tray.hidden {
        visibility: hidden;
        min-height: 33px;
    }

    .ap {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .pip {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--mx-ap);
        box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.35);
    }

    .pip.spent {
        background: transparent;
        box-shadow: inset 0 0 0 1.5px rgb(0 0 0 / 0.25);
    }

    .tokens {
        margin-left: 4px;
        font-weight: 700;
        font-size: 14px;
    }

    .tools {
        display: flex;
        gap: 6px;
    }

    .tool {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 6px;
        border-radius: 8px;
        background: var(--mx-panel-inset);
        box-shadow: inset 0 0 0 1px var(--mx-panel-edge);
    }

    .tool.picked {
        box-shadow: inset 0 0 0 2px var(--mx-target);
    }

    .tool:disabled {
        opacity: 0.4;
    }

    .count {
        font-size: 13px;
        font-weight: 700;
        min-width: 1.1em;
    }

    .canal-icon {
        width: 22px;
        height: 11px;
        border-radius: 2px;
        background: var(--mx-canal);
        box-shadow: inset 0 0 0 1px var(--mx-canal-ink);
    }

    .bridge-icon {
        width: 22px;
        height: 11px;
        border-radius: 8px 8px 2px 2px;
        background: var(--mx-bridge);
        box-shadow: inset 0 0 0 1px var(--mx-bridge-ink);
    }

    .token-icon {
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: var(--mx-ap);
        box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.35);
    }

    @media (hover: hover) {
        .tool:not(:disabled):hover {
            background: var(--mx-panel-hover);
        }
    }
</style>
