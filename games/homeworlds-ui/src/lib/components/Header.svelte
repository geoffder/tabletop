<script lang="ts">
    import { fade } from 'svelte/transition'
    import { Popover } from 'flowbite-svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import HelpGuide from './HelpGuide.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()
    // Full screen draws a second header in its dialog; each anchors its own guide.
    const uid = $props.id()
    const headerId = `hw-header-${uid}`
    const guideId = `hw-guide-${uid}`

    const currentTurnPlayerId = $derived(session.gameState.turnManager.currentTurn()?.playerId)
</script>

<div
    id={headerId}
    class="relative flex h-[44px] items-center justify-between px-4 tracking-[0.08em] text-(--hw-table-ink) max-sm:h-[30px] max-sm:px-1"
>
    <div class="header-grid grid text-[18px] max-sm:text-[14px]">
        {#if session.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>HISTORY</div>
        {:else if session.gameState.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>END OF GAME</div>
        {:else if !session.isMyTurn}
            <div
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 120 }}
                class="inline-flex gap-x-1"
            >
                <PlayerName
                    playerId={currentTurnPlayerId}
                    capitalization="uppercase"
                    possessive={true}
                    additionalClasses="tracking-widest"
                />
                <span>TURN</span>
            </div>
        {:else}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>YOUR TURN</div>
        {/if}
    </div>

    <div class="flex items-center gap-x-2">
        <div class="header-grid grid text-[18px] max-sm:text-[14px]">
            {#if session.hasLocalSelection || session.undoableAction}
                <button type="button" onclick={() => session.undo()} class="header-button"
                    >UNDO</button
                >
            {/if}
        </div>
        <!-- What each colour does, a sacrifice and a catastrophe, as Sol's player aid. -->
        <button
            type="button"
            id={guideId}
            class="guide-button"
            aria-label="How to play"
            title="How to play">?</button
        >
        <Popover
            reference="#{headerId}"
            classes={{ content: 'p-0 rounded-md overflow-hidden dark:border-0' }}
            placement="bottom"
            triggeredBy="#{guideId}"
            trigger="click"
            offset={8}
            arrow={false}><HelpGuide /></Popover
        >
    </div>
</div>

<style>
    .header-grid > * {
        grid-area: 1 / 1;
    }

    .guide-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: var(--hw-panel);
        box-shadow:
            inset 0 0 0 1px var(--hw-panel-edge),
            var(--hw-panel-shadow);
        color: var(--hw-ink);
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0;
    }

    .header-button {
        border-radius: 0.5rem;
        padding: 0.25rem 0.5rem;
    }

    @media (hover: hover) {
        .header-button:hover {
            background: rgb(236 230 211 / 0.1);
        }
    }

    @media (max-width: 639px) {
        .guide-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 999px;
            background: var(--hw-panel);
            box-shadow:
                inset 0 0 0 1px var(--hw-panel-edge),
                var(--hw-panel-shadow);
            color: var(--hw-ink);
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0;
        }

        .header-button {
            padding: 0.125rem 0.375rem;
        }
    }
</style>
