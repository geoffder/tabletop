<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import {
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls,
        ScalingWrapper
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type {
        HydratedWebOfPowerGameState,
        WebOfPowerProjectedState
    } from '@tabletop/web-of-power'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import CardTray from '$lib/components/CardTray.svelte'
    import { WebOfPowerGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        gameSession
    }: { gameSession: GameSession<WebOfPowerProjectedState, HydratedWebOfPowerGameState> } =
        $props()
    assert(gameSession instanceof WebOfPowerGameSession, 'Web of Power needs its own game session')
    setGameSession(gameSession)

    // The shared wrapper exposes full screen only as its dialog becoming modal.
    let expanded = $state(false)
    const watchExpansion: Attachment<HTMLElement> = (node) => {
        const dialog = node.closest('dialog')
        if (!dialog) return
        const read = () => {
            expanded = dialog.matches(':modal')
        }
        const observer = new MutationObserver(read)
        observer.observe(dialog, { attributes: true, attributeFilter: ['role'] })
        read()
        return () => observer.disconnect()
    }
</script>

{#snippet turnControls()}
    <Header />
    <div class="action-card">
        {#if gameSession.gameState.result && !gameSession.isViewingHistory}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
        <CardTray />
    </div>
{/snippet}

<div class="wop-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <!-- Faded controls in a colour that still shows on the panels. -->
            <HistoryControls
                enabledColor="text-(--wop-ink)"
                disabledColor="text-(--wop-control-off)"
                borderClass="border-b border-(--wop-panel-edge)"
                bgClass="bg-(--wop-panel) shadow-(--wop-panel-shadow)"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-(--wop-ink)"
                    disabledColor="text-(--wop-control-off)"
                    borderClass="rounded-lg border border-(--wop-panel-edge)"
                    bgClass="rounded-lg bg-(--wop-panel) shadow-(--wop-panel-shadow)"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 max-sm:[&_svg]:hidden bg-(--wop-panel) shadow-(--wop-panel-shadow) border-2 border-transparent rounded-lg text-(--wop-ink)"
                inactiveTabClass="text-(--wop-table-ink) py-1 px-3 max-sm:[&_svg]:hidden rounded-lg border-2 border-transparent hover:border-[rgb(60_40_20/0.25)]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-(--wop-ink-quiet)"
                        messageTextColor="text-(--wop-ink)"
                        composerTextColor="text-(--wop-ink)"
                        messageHoverColor="hover:bg-(--wop-panel-hover)"
                        bgColor="bg-(--wop-panel) shadow-(--wop-panel-shadow)"
                        inputBgColor="bg-(--wop-panel-inset)"
                        inputBorderColor="border-(--wop-panel-rule)"
                        borderColor="border-(--wop-panel-edge)"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render turnControls()}
            </div>
            <div class="grow-0 overflow-hidden pt-2" style="flex:1; min-height: 40dvh;">
                <ScalingWrapper
                    justify="center"
                    controls="bottom-left"
                    maxScale={4}
                    maxFitScale={1.5}
                    renderAtViewScale
                    expandable
                >
                    <Board />
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog, so the turn controls must come inside it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <!-- The dialog paints its own dim backdrop, so full screen redraws the table behind the board. -->
                                <div class="fullscreen-backdrop" aria-hidden="true"></div>
                                <div class="fullscreen-controls">
                                    {@render turnControls()}
                                </div>
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .wop-table {
        position: relative;
        isolation: isolate;
        background: var(--wop-table);
        touch-action: manipulation;
        color: var(--wop-table-ink);
    }

    /* DefaultTableLayout leaves a tenth of a phone screen showing the sidebar's edge.
       The history controls sit above the table there, so the board takes all but a
       sliver of the narrower player cards; the tabs drop their icons to fit. */
    @media (width < 40rem) {
        .wop-table :global(.game-column.game-column) {
            min-width: calc(100vw - 20px);
        }

        .wop-table :global(div:has(+ .game-column)) {
            width: 260px;
            min-width: 260px;
        }
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--wop-panel);
        box-shadow:
            inset 0 0 0 1px var(--wop-panel-edge),
            var(--wop-panel-shadow);
    }

    .fullscreen-backdrop {
        background: var(--wop-table-deep);
        position: fixed;
        inset: 0;
        z-index: -2;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
