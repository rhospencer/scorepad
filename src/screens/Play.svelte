<script lang="ts">
  import BidTricks from '../surfaces/BidTricks.svelte';
  import RoundGrid from '../surfaces/RoundGrid.svelte';
  import type { Submission } from '../lib/lobbyTypes';
  import type { GameModule, Session } from '../lib/types';

  interface Props {
    game: GameModule;
    session: Session;
    onchange: (session: Session) => void;
    onexit: () => void;
    onresults: () => void;
    submissions?: Record<string, Submission>;
    onsendback?: (lobbyId: string) => void;
  }

  let { game, session, onchange, onexit, onresults, submissions, onsendback }: Props = $props();
</script>

<!-- The game module picks the scoring surface. New surfaces plug in here. -->
{#if game.surface === 'round-grid'}
  {#key session.id}
    <RoundGrid {game} {session} {onchange} {onexit} {onresults} {submissions} {onsendback} />
  {/key}
{:else if game.surface === 'bid-tricks'}
  {#key session.id}
    <BidTricks {game} {session} {onchange} {onexit} {onresults} {submissions} {onsendback} />
  {/key}
{:else}
  <main class="screen">
    <p class="eyebrow">{game.name}</p>
    <h1 class="title">Not built yet</h1>
    <p>The {game.surface} scoring screen is still on the roadmap.</p>
    <button type="button" class="btn" onclick={onexit}>Back to games</button>
  </main>
{/if}
