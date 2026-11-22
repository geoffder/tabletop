<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { devicePixelRatio } from 'svelte/reactivity/window'
    import {
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls,
        ScalingWrapper
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type { HydratedMexicaGameState, MexicaGameState } from '@tabletop/mexica'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import { holdTallest } from '$lib/components/holdTallest.js'
    import SupplyTray from '$lib/components/SupplyTray.svelte'
    import MaskIcon from '$lib/components/MaskIcon.svelte'
    import { setTokenFlights, TokenFlights } from '$lib/animators/tokenFlights.svelte.js'
    import { ScoreTicker, setScoreTicker } from '$lib/animators/scoreTicker.svelte.js'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import { zoomLimits } from '$lib/board/zoom.js'
    import { MexicaGameSession } from '$lib/model/session.svelte.js'
    import { getGameSession, setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<MexicaGameState, HydratedMexicaGameState> } =
        $props()
    assert(gameSession instanceof MexicaGameSession, 'Mexica needs its own game session')
    setGameSession(gameSession)
    const tokenFlights = new TokenFlights(getGameSession())
    setTokenFlights(tokenFlights)
    const scoreTicker = new ScoreTicker(getGameSession())
    setScoreTicker(scoreTicker)

    const zoom = $derived(zoomLimits(devicePixelRatio.current ?? 1))

    // The shared wrapper exposes full screen only as its dialog becoming modal.
    let expanded = $state(false)
    // The board's space, so it leaves its overlaid controls their room at any size.
    let spaceWidth = $state(0)
    let spaceHeight = $state(0)
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
    <!-- Held at its tallest, so the card keeps its height when the tray gives way to the ending. -->
    <div class="action-card" {@attach holdTallest}>
        <ActionPanel />
        <SupplyTray />
    </div>
{/snippet}

<div class="mx-table">
    <!-- Action tokens flying between the supply tray on the board and the players' cards. -->
    <div
        class="fliers"
        aria-hidden="true"
        {@attach tokenFlights.attach}
        {@attach scoreTicker.attach}
    >
        {#each tokenFlights.fliers as flier (flier.id)}
            <div class="flier" {@attach tokenFlights.flier(flier.id)}><MaskIcon size={40} /></div>
        {/each}
    </div>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <!-- Faded controls in a colour that still shows on the panels. -->
            <HistoryControls
                enabledColor="text-(--mx-ink)"
                disabledColor="text-(--mx-control-off)"
                borderClass="border-b border-(--mx-panel-edge)"
                bgClass="bg-(--mx-panel) shadow-(--mx-panel-shadow)"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-(--mx-ink)"
                    disabledColor="text-(--mx-control-off)"
                    borderClass="rounded-lg border border-(--mx-panel-edge)"
                    bgClass="rounded-lg bg-(--mx-panel) shadow-(--mx-panel-shadow)"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 max-sm:[&_svg]:hidden bg-(--mx-panel) shadow-(--mx-panel-shadow) border-2 border-transparent rounded-lg text-(--mx-ink)"
                inactiveTabClass="text-(--mx-table-ink) py-1 px-3 max-sm:[&_svg]:hidden rounded-lg border-2 border-transparent hover:border-[rgb(60_40_20/0.25)]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-(--mx-ink-quiet)"
                        messageTextColor="text-(--mx-ink)"
                        composerTextColor="text-(--mx-ink)"
                        messageHoverColor="hover:bg-(--mx-panel-hover)"
                        bgColor="bg-(--mx-panel) shadow-(--mx-panel-shadow)"
                        inputBgColor="bg-(--mx-panel-inset)"
                        inputBorderColor="border-(--mx-panel-rule)"
                        borderColor="border-(--mx-panel-edge)"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render turnControls()}
            </div>
            <div
                class="grow-0 overflow-hidden pt-2"
                style="flex:1; min-height: 40dvh;"
                bind:clientWidth={spaceWidth}
                bind:clientHeight={spaceHeight}
            >
                <ScalingWrapper
                    justify="center"
                    controls="bottom-left"
                    maxScale={zoom.maxScale}
                    maxFitScale={zoom.maxFitScale}
                    renderAtViewScale
                    expandable
                >
                    <Board space={{ width: spaceWidth, height: spaceHeight - 8 }} />
                    {#snippet overlay()}
                        <div
                            class="pointer-events-auto absolute right-3 bottom-2 z-10 flex items-center gap-1.5"
                        >
                            <OverlayToggle
                                glyph="A1"
                                label="Coordinates"
                                hint={gameSession.showCoordinates
                                    ? 'Hide the coordinates'
                                    : 'Show the coordinates round the board'}
                                pressed={gameSession.showCoordinates}
                                onToggle={() => gameSession.toggleCoordinates()}
                            />
                            <OverlayToggle
                                label="Flat board"
                                hint={gameSession.flatBoard
                                    ? 'See the board from the near side of the table'
                                    : 'See the board from straight above'}
                                pressed={gameSession.flatBoard}
                                onToggle={() => gameSession.toggleFlatBoard()}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="-8 -8 16 16"
                                    aria-hidden="true"
                                >
                                    <rect x="-6" y="-6" width="12" height="12" class="line"></rect>
                                    <path d="M -6 0 H 6 M 0 -6 V 6" class="line"></path>
                                </svg>
                            </OverlayToggle>
                            <OverlayToggle
                                glyph="AP"
                                label="Move costs"
                                hint={gameSession.moveCosts
                                    ? 'Hide what each move costs'
                                    : 'Show what each move costs on the spaces you can reach'}
                                pressed={gameSession.moveCosts}
                                onToggle={() => gameSession.toggleMoveCosts()}
                            />
                            <OverlayToggle
                                glyph="90°"
                                label="Rotated board"
                                hint={gameSession.rotatedBoard
                                    ? 'Turn the board back a quarter turn'
                                    : 'Turn the board a quarter turn'}
                                pressed={gameSession.rotatedBoard}
                                onToggle={() => gameSession.toggleRotatedBoard()}
                            />
                            <OverlayToggle
                                label="Far side"
                                hint={gameSession.farSide
                                    ? 'See the board from your own side again'
                                    : 'See the board from the far side, to see what temples hide'}
                                pressed={gameSession.farSide}
                                onToggle={() => gameSession.toggleFarSide()}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="-8 -8 16 16"
                                    aria-hidden="true"
                                >
                                    <path d="M -5.5 -1 A 5.5 5.5 0 0 1 4.5 -3.2" class="line"
                                    ></path>
                                    <path d="M 2 -5 L 4.8 -3 L 2.2 -0.8" class="line"></path>
                                    <path d="M 5.5 1 A 5.5 5.5 0 0 1 -4.5 3.2" class="line"></path>
                                    <path d="M -2 5 L -4.8 3 L -2.2 0.8" class="line"></path>
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
    .mx-table {
        position: relative;
        isolation: isolate;
        background: var(--mx-table);
        touch-action: manipulation;
        color: var(--mx-table-ink);
    }

    /* DefaultTableLayout leaves a tenth of a phone screen showing the sidebar's edge.
       The history controls sit above the table there, so the board takes all but a
       sliver of the narrower player cards; the tabs drop their icons to fit. */
    @media (width < 40rem) {
        .mx-table :global(.game-column.game-column) {
            min-width: calc(100vw - 20px);
        }

        .mx-table :global(div:has(+ .game-column)) {
            width: 260px;
            min-width: 260px;
        }
    }

    .fliers {
        position: fixed;
        inset: 0;
        z-index: 40;
        pointer-events: none;
        overflow: hidden;
    }

    .flier {
        position: absolute;
        left: 0;
        top: 0;
        will-change: transform;
    }

    .flier :global(svg) {
        width: 100%;
        height: 100%;
    }

    .action-card {
        display: flex;
        flex-direction: column;
        margin: 0 8px;
        border-radius: 12px;
        background: var(--mx-panel);
        box-shadow:
            inset 0 0 0 1px var(--mx-panel-edge),
            var(--mx-panel-shadow);
    }

    .fullscreen-backdrop {
        background: var(--mx-table-deep);
        position: fixed;
        inset: 0;
        z-index: -2;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
