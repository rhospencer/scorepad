<script lang="ts">
  import Avatar from '../components/Avatar.svelte';
  import Confetti from '../components/Confetti.svelte';
  import ScoreSheet from '../components/ScoreSheet.svelte';
  import { sessionWinners, standings } from '../lib/session';
  import { ruleText } from '../lib/scoreboard';
  import { gameStats } from '../lib/stats';
  import { viewport } from '../lib/viewport.svelte';
  import type { GameModule, Session } from '../lib/types';

  interface Props {
    game: GameModule;
    session: Session;
    onrematch: () => void;
    onnewgame: () => void;
    /** Go back to the scoring screen to fix a score. */
    onedit: () => void;
  }

  let { game, session, onrematch, onnewgame, onedit }: Props = $props();

  const table = $derived(standings(game, session));
  const winners = $derived(sessionWinners(game, session));
  const winnerNames = $derived(winners.map((i) => session.players[i].name));
  const stats = $derived(gameStats(game, session));
  const num = new Intl.NumberFormat();
  const best = $derived(table[0]?.total ?? 0);
  const rule = $derived(ruleText(game));
  let showSheet = $state(false);

  function joinNames(names: string[]) {
    return names.length <= 2 ? names.join(' & ') : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
  }
</script>

<Confetti />

<main class="screen wide">
  <div class="top-bar">
    <button type="button" class="icon-btn" aria-label="Back to games" onclick={onnewgame}>←</button>
    <p class="crumb">{game.name} · game over</p>
  </div>

  <div class="layout" class:split={viewport.wide}>
    <div class="left">
      <section class="hero" aria-live="polite">
        {#if winners.length === 1}
          {@const w = session.players[winners[0]]}
          <span class="winner-face"><Avatar name={w.name} seat={winners[0]} emoji={w.emoji} size={88} /></span>
        {:else}
          <span class="crown" aria-hidden="true">♛</span>
        {/if}
        <p class="label">{winners.length === 1 ? 'Winner' : 'Tie'}</p>
        <h1>{winners.length === 1 ? winnerNames[0] : joinNames(winnerNames)}</h1>
        <p class="sub">{num.format(best)} points · {rule.toLowerCase()}</p>
      </section>

      <h2 class="section-label">Final standings</h2>
      <ol class="standings">
        {#each table as row (row.player.id)}
          <li class:first={row.rank === 1}>
            <span class="rank">{row.rank}</span>
            <Avatar name={row.player.name} seat={row.index} emoji={row.player.emoji} size={36} />
            <span class="who">
              <span class="name">{row.player.name}</span>
              {#if row.behind > 0}<span class="gap">{num.format(row.behind)} behind</span>{/if}
            </span>
            <span class="total">{num.format(row.total)}</span>
          </li>
        {/each}
      </ol>

      {#if !viewport.wide}
        {@render statCards()}
        <button type="button" class="btn btn-ghost btn-block toggle-sheet" aria-expanded={showSheet} onclick={() => (showSheet = !showSheet)}>
          {showSheet ? 'Hide' : 'Show'} score sheet
        </button>
        {#if showSheet}
          <ScoreSheet {game} {session} />
          <button type="button" class="link" onclick={onedit}>Fix a score</button>
        {/if}
      {/if}

      <div class="actions">
        <button type="button" class="btn btn-primary btn-block" onclick={onrematch}>Rematch, same players</button>
        <button type="button" class="btn btn-block" onclick={onnewgame}>Back to games</button>
      </div>
    </div>

    {#if viewport.wide}
      <div class="right">
        {@render statCards()}
        <h2 class="section-label">Score sheet</h2>
        <ScoreSheet {game} {session} showNames />
        <button type="button" class="link" onclick={onedit}>Fix a score</button>
      </div>
    {/if}
  </div>
</main>

{#snippet statCards()}
  {#if stats.length > 0}
    <dl class="stats">
      {#each stats as stat (stat.label)}
        <div class="stat">
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}
{/snippet}

<style>
  .crumb {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .layout.split {
    display: grid;
    grid-template-columns: minmax(360px, 440px) minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }
  .left {
    display: flex;
    flex-direction: column;
  }
  .right {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .right .section-label {
    margin-top: 20px;
  }
  /* The winner gets an outlined card, not a filled one. */
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 20px 24px;
    border-radius: 24px;
    border: 2px solid var(--amber);
    background: var(--surface);
    text-align: center;
  }
  .winner-face {
    display: inline-flex;
    border-radius: 50%;
    box-shadow: 0 0 0 4px var(--surface), 0 0 0 7px var(--amber);
  }
  .crown {
    font-size: 56px;
    line-height: 1;
    color: var(--amber);
  }
  .label {
    margin: 14px 0 2px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--amber);
  }
  .hero h1 {
    margin: 0;
    font-size: 44px;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }
  .sub {
    margin: 8px 0 0;
    color: var(--muted);
    font-weight: 650;
  }
  .stats {
    margin: 16px 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }
  .right .stats {
    margin-top: 0;
  }
  .stat {
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .stat dt {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .stat dd {
    margin: 4px 0 0;
    font-size: 16px;
    font-weight: 800;
  }
  .standings {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .standings li {
    min-height: 56px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
  }
  .standings li.first {
    border-color: var(--amber);
  }
  .rank {
    width: 28px;
    height: 28px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 14px;
    font-weight: 750;
  }
  .first .rank {
    background: var(--amber);
    color: var(--on-amber);
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name {
    font-size: 17px;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .gap {
    color: var(--muted);
    font-size: 13px;
  }
  .total {
    min-width: 44px;
    text-align: right;
    font-size: 22px;
    font-weight: 800;
  }
  .toggle-sheet {
    margin: 16px 0 12px;
    min-height: 48px;
    font-size: 15px;
    color: var(--muted);
  }
  .link {
    align-self: center;
    min-height: 48px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: var(--teal);
    font-weight: 650;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
