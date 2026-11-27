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
    import type { HomeworldsGameState, HydratedHomeworldsGameState } from '@tabletop/homeworlds'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import { HomeworldsGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        gameSession
    }: { gameSession: GameSession<HomeworldsGameState, HydratedHomeworldsGameState> } = $props()
    assert(gameSession instanceof HomeworldsGameSession, 'Homeworlds needs its own game session')
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
        <ActionPanel />
    </div>
{/snippet}

<div class="hw-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <!-- Faded controls in a colour that still shows on the panels. -->
            <HistoryControls
                enabledColor="text-(--hw-ink)"
                disabledColor="text-(--hw-control-off)"
                borderClass="border-b border-(--hw-panel-edge)"
                bgClass="bg-(--hw-panel) shadow-(--hw-panel-shadow)"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-(--hw-ink)"
                    disabledColor="text-(--hw-control-off)"
                    borderClass="rounded-lg border border-(--hw-panel-edge)"
                    bgClass="rounded-lg bg-(--hw-panel) shadow-(--hw-panel-shadow)"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 max-sm:[&_svg]:hidden bg-(--hw-panel) shadow-(--hw-panel-shadow) border-2 border-transparent rounded-lg text-(--hw-ink)"
                inactiveTabClass="text-(--hw-table-ink) py-1 px-3 max-sm:[&_svg]:hidden rounded-lg border-2 border-transparent hover:border-[rgb(236_230_211/0.25)]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-(--hw-ink-quiet)"
                        messageTextColor="text-(--hw-ink)"
                        composerTextColor="text-(--hw-ink)"
                        messageHoverColor="hover:bg-(--hw-panel-hover)"
                        bgColor="bg-(--hw-panel) shadow-(--hw-panel-shadow)"
                        inputBgColor="bg-(--hw-panel-inset)"
                        inputBorderColor="border-(--hw-panel-rule)"
                        borderColor="border-(--hw-panel-edge)"
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
                    controls="bottom-right"
                    maxScale={3}
                    maxFitScale={2}
                    renderAtViewScale
                    expandable
                >
                    <Board />
                    {#snippet overlay()}
                        <!-- Right-aligned rows no wider than the zoom controls below, so they take
                             no more of the board's width; the far side last, by the zoom. -->
                        <div
                            class="board-toggles pointer-events-auto absolute right-0 bottom-11 z-10"
                        >
                            <OverlayToggle
                                label="Top-down view"
                                pressed={gameSession.flatBoard}
                                onToggle={() => gameSession.toggleFlatBoard()}
                            >
                                <!-- A pyramid seen from straight above: a square crossed corner to corner. -->
                                <svg
                                    viewBox="0 0 16 16"
                                    width="16"
                                    height="16"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.4"
                                    stroke-linejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M2 2 H14 V14 H2 Z M2 2 L14 14 M14 2 L2 14"></path>
                                </svg>
                            </OverlayToggle>
                            <!-- The map's line laid an eighth of a turn flatter, named by its angle as PÜNCT's 90°. -->
                            <OverlayToggle
                                label="Map turned 45°"
                                pressed={gameSession.wideMap}
                                onToggle={() => gameSession.toggleWideMap()}>45°</OverlayToggle
                            >
                            <!-- Half a turn round, to sit on the other player's side. -->
                            <OverlayToggle
                                label="Far side"
                                pressed={gameSession.turned}
                                onToggle={() => gameSession.toggleTurned()}
                            >
                                <svg
                                    viewBox="-8 -8 16 16"
                                    width="16"
                                    height="16"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.4"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M -5.5 -1 A 5.5 5.5 0 0 1 4.5 -3.2 M 2 -5 L 4.8 -3 L 2.2 -0.8 M 5.5 1 A 5.5 5.5 0 0 1 -4.5 3.2 M -2 5 L -4.8 3 L -2.2 0.8"
                                    ></path>
                                </svg>
                            </OverlayToggle>
                        </div>
                    {/snippet}
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
    .hw-table {
        position: relative;
        isolation: isolate;
        background: var(--hw-table);
        touch-action: manipulation;
        color: var(--hw-table-ink);
    }

    /* DefaultTableLayout leaves a tenth of a phone screen showing the sidebar's edge.
       The history controls sit above the table there, so the board takes all but a
       sliver of the narrower player cards; the tabs drop their icons to fit. */
    @media (width < 40rem) {
        .hw-table :global(.game-column.game-column) {
            min-width: calc(100vw - 20px);
        }

        .hw-table :global(div:has(+ .game-column)) {
            width: 260px;
            min-width: 260px;
        }
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--hw-panel);
        box-shadow:
            inset 0 0 0 1px var(--hw-panel-edge),
            var(--hw-panel-shadow);
    }

    .board-toggles {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 6px;
        max-width: 112px;
    }

    .fullscreen-backdrop {
        background: var(--hw-table-deep);
        position: fixed;
        inset: 0;
        z-index: -2;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
