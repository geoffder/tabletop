<script lang="ts">
    import { ALLIANCES, COUNTRY_NAMES, type Award } from '@tabletop/web-of-power'
    import type { FinalEntry, InterimEntry } from '$lib/history/historyEntries.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { entry }: { entry: InterimEntry | FinalEntry } = $props()

    const session = getGameSession()

    type Row = { label: string; awards: Award[] }
    type Group = { title: string; rows: Row[] }

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const groups: Group[] = $derived.by(() => {
        const cloisters: Group = {
            title: 'Cloisters',
            rows: entry.cloisters
                .filter(({ awards }) => awards.length > 0)
                .map(({ country, awards }) => ({ label: COUNTRY_NAMES[country], awards }))
        }
        if (entry.kind === 'interim') return [cloisters]
        const alliances: Group = {
            title: 'Alliances',
            rows: entry.alliances.map(({ alliance, awards }) => ({
                label: `${alliance} · ${ALLIANCES[alliance - 1].map((c) => COUNTRY_NAMES[c]).join('–')}`,
                awards
            }))
        }
        const chains: Group = {
            title: 'Chains',
            rows: entry.chains.map(({ playerId, abbeys }) => ({
                label: `${abbeys.length} cloisters`,
                awards: [{ playerId, points: abbeys.length }]
            }))
        }
        return [cloisters, alliances, chains].filter((group) => group.rows.length > 0)
    })
</script>

<div class="breakdown">
    {#each groups as group (group.title)}
        <div class="group-title">{group.title}</div>
        {#each group.rows as row (row.label)}
            <div class="row">
                <span class="label">{row.label}</span>
                <span class="awards">
                    {#each row.awards as award (award.playerId)}
                        <span class="award">
                            <span
                                class="dot"
                                style:background={session.colors.getPlayerBgColorValue(
                                    award.playerId
                                )}
                            ></span>{nameOf(award.playerId)}
                            <b>{award.points}</b>
                        </span>
                    {/each}
                </span>
            </div>
        {/each}
    {:else}
        <div class="row"><span class="label">No points</span></div>
    {/each}
</div>

<style>
    .breakdown {
        margin: 0 8px 8px 29px;
        font-size: 13px;
        line-height: 1.35;
    }

    .group-title {
        margin-top: 4px;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--wop-ink-quiet);
    }

    .row {
        display: flex;
        gap: 8px;
        padding: 1px 0;
    }

    .label {
        flex: 0 0 auto;
        min-width: 84px;
        color: var(--wop-ink-quiet);
    }

    .awards {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 10px;
    }

    .award {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 2px;
    }
</style>
