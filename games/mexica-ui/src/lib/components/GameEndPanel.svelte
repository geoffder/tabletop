<script lang="ts">
    import { assert } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SourceIcon from './SourceIcon.svelte'
    import {
        scoreBreakdown,
        type ScoreSources,
        SOURCES,
        totalOf
    } from '$lib/scoring/scoreBreakdown.js'

    const session = getGameSession()

    const winners = $derived.by(() => {
        const ids = session.gameState.winningPlayerIds
        assert(ids.length > 0, 'A finished game names its winners')
        return ids
    })

    const nameOf = (playerId: string) =>
        playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)

    const ranking = $derived(session.gameState.players.toSorted((a, b) => b.score - a.score || 0))

    // Where each player's points came from; a source nobody scored from is left out.
    const breakdown = $derived(
        scoreBreakdown(
            session.actions,
            ranking.map((player) => player.playerId)
        )
    )
    const LABELS: Record<keyof ScoreSources, { long: string }> = {
        founding: { long: 'Founding' },
        firstPeriod: { long: 'Districts at the first period’s end' },
        finalFounded: { long: 'Founded districts at the game’s end' },
        finalUnfounded: { long: 'Unfounded districts at the game’s end' },
        palace: { long: 'Palace' }
    }
    const shown = $derived(
        SOURCES.filter((source) => [...breakdown.values()].some((sources) => sources[source] > 0))
    )
    // Points the game's history does not show, as in a position set up part way through a game.
    const earlierOf = (playerId: string) =>
        session.gameState.getPlayerState(playerId).score - totalOf(sourcesOf(playerId))
    const anyEarlier = $derived(ranking.some((player) => earlierOf(player.playerId) !== 0))
    const sourcesOf = (playerId: string): ScoreSources =>
        breakdown.get(playerId) ?? {
            founding: 0,
            firstPeriod: 0,
            finalFounded: 0,
            finalUnfounded: 0,
            palace: 0
        }
</script>

<!-- Inside the action panel: the winner over where each player's points came from. -->
<div class="ending">
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else}
        <div class="winner">
            {#if winners.length === 1}
                {winners[0] === session.myPlayer?.id ? 'You win' : `${nameOf(winners[0])} wins`}
            {:else}
                {winners.map(nameOf).join(' and ')} share the win
            {/if}
        </div>
        <table class="breakdown">
            <thead>
                <tr>
                    <th></th>
                    {#each shown as source (source)}
                        <th class="source" title={LABELS[source].long}
                            ><SourceIcon {source} /><span class="sr-only"
                                >{LABELS[source].long}</span
                            ></th
                        >
                    {/each}
                    {#if anyEarlier}<th
                            ><span class="long">Earlier</span><span class="short">Prior</span></th
                        >{/if}
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {#each ranking as player (player.playerId)}
                    <tr>
                        <th class="name">
                            <span
                                class="swatch"
                                style:background={session.playerFill(player.playerId)}
                            ></span><span class="who">{nameOf(player.playerId)}</span>
                        </th>
                        {#each shown as source (source)}
                            <td class="source">{sourcesOf(player.playerId)[source]}</td>
                        {/each}
                        {#if anyEarlier}<td>{earlierOf(player.playerId)}</td>{/if}
                        <td class="total">{player.score}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .ending {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        min-width: 0;
        color: var(--mx-ink);
        line-height: 1.2;
    }

    .winner {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .breakdown {
        margin-top: 4px;
        border-collapse: collapse;
        font-size: 14px;
        font-variant-numeric: tabular-nums;
        line-height: 1.25;
    }

    .breakdown th,
    .breakdown td {
        padding: 1px 8px;
        text-align: right;
        white-space: nowrap;
    }

    .breakdown thead th {
        font-size: 12px;
        font-weight: 600;
        color: var(--mx-ink-quiet);
        border-bottom: 1px solid var(--mx-panel-rule);
    }

    .breakdown .source {
        text-align: center;
    }

    .breakdown .name {
        text-align: left;
        font-weight: 600;
    }

    .breakdown .total {
        font-weight: 800;
    }

    .who {
        display: inline-block;
        max-width: 9em;
        overflow: hidden;
        text-overflow: ellipsis;
        vertical-align: bottom;
    }

    .swatch {
        display: inline-block;
        width: 9px;
        height: 9px;
        margin-right: 5px;
        border-radius: 2px;
        vertical-align: 0;
    }

    .short {
        display: none;
    }

    .winner {
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.04em;
    }

    @media (max-width: 639px) {
        .breakdown {
            font-size: 12px;
        }

        .breakdown th,
        .breakdown td {
            padding: 0 3px;
        }

        .who {
            max-width: 4.5em;
        }

        .long {
            display: none;
        }

        .short {
            display: inline;
        }

        .winner {
            font-size: 18px;
        }
    }
</style>
