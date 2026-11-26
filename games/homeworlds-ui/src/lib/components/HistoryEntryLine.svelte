<script lang="ts">
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import type { TurnOrCall } from '$lib/history/historyEntries.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import StepText from './StepText.svelte'

    // A turn as one line: the player, then each thing they did. Brief shows the latest step only.
    let { entry, brief = false }: { entry: TurnOrCall; brief?: boolean } = $props()

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const steps = $derived(entry.kind === 'call' ? [] : brief ? entry.steps.slice(-1) : entry.steps)
</script>

{#if entry.kind === 'call'}
    <CalledGameDescription action={entry.action} />
{:else}<span
        ><span class="font-semibold">{nameOf(entry.playerId)}</span
        >{#each steps as step, index (step.id)}{#if index > 0}<span>,</span>{/if}<StepText
                {step}
                {brief}
            />{/each}</span
    >{/if}
