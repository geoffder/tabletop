<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerCard from './PlayerCard.svelte'

    const session = getGameSession()
</script>

<div class="flex flex-col gap-3">
    {#each session.gameState.players as playerState (playerState.playerId)}
        <PlayerCard {playerState} />
    {/each}
</div>
