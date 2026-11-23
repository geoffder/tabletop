<script lang="ts">
    import { cellName } from '@tabletop/mexica'
    import type { Step, TurnEntry } from '$lib/history/historyEntries.js'
    import { stepSegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'
    import PilliIcon from './PilliIcon.svelte'
    import DistrictIcon from './DistrictIcon.svelte'
    import MaskIcon from './MaskIcon.svelte'
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { evenColumns, fitPills, PREFERRED_COLUMNS, type PillFit } from './pillRows.js'

    // A whole turn in short, for the card while you wait: the player's name, then each action in
    // turn order as a pill of its piece and where it went, in rows that read across, then down.
    let { entry }: { entry: TurnEntry } = $props()

    // Three to a row at full size while they fit the card; a long turn takes more columns, and
    // smaller pills, rather than spill out of it.
    const ICON = 22
    let fit: PillFit & { steps?: readonly Step[] } = $state.raw({
        columns: PREFERRED_COLUMNS,
        scale: 1
    })
    // Until this turn is measured, the last turn's scale and three to a row.
    const columns = $derived(
        fit.steps === entry.steps ? fit.columns : evenColumns(entry.steps.length, PREFERRED_COLUMNS)
    )
    const icon = $derived(ICON * fit.scale)

    // Measures the pills as drawn, takes out the scale they were drawn at, and fits them to the
    // card the summary is centred in. Again for each new turn and each new size of card.
    const fitToCard: Attachment<HTMLElement> = (summary) => {
        const steps = entry.steps
        const card = summary.parentElement
        if (card === null) return
        const measure = () => {
            const pills = [...summary.querySelectorAll<HTMLElement>('.pill')]
            const rows = summary.querySelector<HTMLElement>('.rows')
            const head = summary.querySelector<HTMLElement>('b')
            if (pills.length === 0 || rows === null || head === null) {
                fit = { columns: PREFERRED_COLUMNS, scale: 1, steps }
                return
            }
            const drawn = untrack(() => fit.scale)
            const px = (value: string) => parseFloat(value) / drawn
            const rowStyle = getComputedStyle(rows)
            const cardStyle = getComputedStyle(card)
            const next = fitPills(
                {
                    widths: pills.map((pill) => pill.getBoundingClientRect().width / drawn),
                    pillHeight:
                        Math.max(...pills.map((pill) => pill.getBoundingClientRect().height)) /
                        drawn,
                    headWidth: head.getBoundingClientRect().width / drawn,
                    headHeight: head.getBoundingClientRect().height / drawn,
                    headGap: px(getComputedStyle(summary).rowGap),
                    columnGap: px(rowStyle.columnGap),
                    rowGap: px(rowStyle.rowGap)
                },
                {
                    width:
                        card.clientWidth -
                        parseFloat(cardStyle.paddingLeft) -
                        parseFloat(cardStyle.paddingRight) -
                        1,
                    height:
                        card.clientHeight -
                        parseFloat(cardStyle.paddingTop) -
                        parseFloat(cardStyle.paddingBottom) -
                        1
                }
            )
            const now = untrack(() => fit)
            if (
                now.steps !== steps ||
                next.columns !== now.columns ||
                Math.abs(next.scale - now.scale) > 0.005
            ) {
                fit = { ...next, steps }
            }
        }
        const observer = new ResizeObserver(measure)
        observer.observe(card)
        return () => observer.disconnect()
    }

    const session = getGameSession()
    const fill = $derived(session.playerFill(entry.playerId))
    const nameOf = (playerId: string) =>
        playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)

    function where(step: Step): string {
        switch (step.kind) {
            case 'start':
                return cellName(step.cell)
            case 'move':
                return `${step.teleport ? '⇝' : '→'}${cellName(step.to)}`
            case 'canal':
                return step.cells.map(cellName).join('–')
            case 'bridge':
            case 'temple':
                return cellName(step.cell)
            case 'moveBridge':
                return `${cellName(step.from)}→${cellName(step.to)}`
            case 'token':
                return '+1'
            case 'found':
                return `${cellName(step.cell)} +${step.points}`
        }
    }

    // The action in words, as the history panel puts it, for screen readers and a hover.
    const spoken = (step: Step) =>
        stepSegments(step)
            .map((segment) => (segment.kind === 'text' ? segment.text : nameOf(segment.playerId)))
            .join('')
</script>

<span class="summary" style:font-size="{fit.scale}em" {@attach fitToCard}
    ><b>{nameOf(entry.playerId)}</b>{#if entry.steps.length === 0}<span
            >{entry.ended ? 'ended the turn' : 'is thinking'}</span
        >{:else}<span class="rows" style:--columns={columns} style:--icon="{icon}px"
            >{#each entry.steps as step, index (index)}<span
                    class="pill"
                    title={spoken(step)}
                    aria-label={spoken(step)}
                    ><span class="icon"
                        >{#if step.kind === 'start' || step.kind === 'move'}<PilliIcon
                                {fill}
                                size={icon}
                            />{:else if step.kind === 'canal'}<PieceIcon
                                piece="canal"
                                {fill}
                                size={icon}
                            />{:else if step.kind === 'bridge' || step.kind === 'moveBridge'}<PieceIcon
                                piece="bridge"
                                {fill}
                                size={icon}
                            />{:else if step.kind === 'temple'}<PieceIcon
                                piece={step.level}
                                {fill}
                                size={icon}
                            />{:else if step.kind === 'token'}<MaskIcon
                                size={icon}
                            />{:else}<DistrictIcon tokenId={step.tokenId} size={icon} />{/if}</span
                    >{where(
                        step
                    )}{#if step.kind === 'found'}{#each step.visitors as visitor (visitor.playerId)}<span
                                class="visitor">{nameOf(visitor.playerId)} +{visitor.points}</span
                            >{/each}{/if}</span
                >{/each}</span
        >{/if}</span
>

<style>
    /* In ems throughout, so the whole summary scales with its font size. */
    .summary {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 0.27em;
    }

    .rows {
        display: grid;
        grid-template-columns: repeat(var(--columns), auto);
        justify-items: start;
        column-gap: 0.4em;
        row-gap: 0.27em;
    }

    .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.2em;
        padding: 0.07em 0.45em 0.07em 0.25em;
        border-radius: 999px;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        background: var(--mx-panel-inset);
        box-shadow: inset 0 0 0 1px var(--mx-panel-edge);
    }

    .icon {
        display: inline-flex;
        width: var(--icon);
        height: var(--icon);
        align-items: center;
        justify-content: center;
    }

    .visitor {
        margin-left: 0.27em;
        font-size: 0.85em;
        opacity: 0.8;
    }
</style>
