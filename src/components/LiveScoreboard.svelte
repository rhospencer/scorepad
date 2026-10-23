<script lang="ts">
  import { flip } from 'svelte/animate';
  import Avatar from './Avatar.svelte';
  import type { Scoreboard } from '../lib/lobbyTypes';
  import { ordinal } from '../lib/scoreboard';

  /** What a phone shows during the game: its own standing on top, then everyone's. */
  interface Props {
    board: Scoreboard;
    /** This phone's lobby player id; null for a spectator. */
    meId: string | null;
  }

  let { board, meId }: Props = $props();

  const me = $derived(meId ? board.rows.find((r) => r.lobbyId === meId) : undefined);
  const iWon = $derived(board.finished && !!me && me.rank === 1);
  const num = new Intl.NumberFormat();
  const reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function joinNames(names: string[]) {
    return names.length <= 2 ? names.join(' & ') : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
  }

  /** Points from the latest round, signed so it reads as a change. */
  function delta(last: number | null): string {
    if (last === null) return '–';
    return last > 0 ? `+${num.format(last)}` : num.format(last);
  }
</script>

<section class="board" aria-live="polite">
  <p class="eyebrow">{board.gameName} · live</p>
  {#if board.finished}
    <h1 class="headline">
      {#if iWon}You win!{:else if board.winners.length === 1}{board.winners[0]} wins!{:else}{joinNames(board.winners)} tie!{/if}
    </h1>
  {:else}
    <h1 class="headline">{board.status}</h1>
  {/if}
  <p class="rule">{board.finished ? board.status : board.rule}</p>

  {#if me}
    <div class="me-card" class:winner={iWon}>
      <Avatar name={me.name} seat={me.seat} emoji={me.emoji} size={64} />
      <div class="me-text">
        <span class="place">{ordinal(me.rank)}</span>
        <span class="sub">
          {#if me.behind === 0}{board.finished ? 'Top score' : 'In the lead'}{:else}{num.format(me.behind)} behind{/if}
        </span>
      </div>
      <span class="me-total">{num.format(me.total)}</span>
    </div>
  {/if}

  <h2 class="section-label">Standings</h2>
  <ol class="rows">
    {#each board.rows as r (r.lobbyId ?? `seat-${r.seat}`)}
      <li class:me={r.lobbyId !== null && r.lobbyId === meId} animate:flip={{ duration: reduceMotion ? 0 : 350 }}>
        <span class="rank">{r.rank}</span>
        <Avatar name={r.name} seat={r.seat} emoji={r.emoji} size={36} />
        <span class="who">
          <span class="name">{r.name}{#if r.lobbyId !== null && r.lobbyId === meId}<span class="you">&nbsp;· you</span>{/if}</span>
          <span class="last">last round {delta(r.last)}</span>
        </span>
        <span class="total">{num.format(r.total)}</span>
      </li>
    {/each}
  </ol>
</section>

<style>
  .headline {
    margin: 0;
    font-size: 30px;
    line-height: 1.1;
  }
  .rule {
    margin: 6px 0 16px;
    color: var(--muted);
  }
  .me-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px 14px 14px;
    border-radius: 20px;
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .me-card.winner {
    border-color: var(--amber);
  }
  .me-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .place {
    font-size: 28px;
    font-weight: 800;
    color: var(--amber);
  }
  .sub {
    color: var(--muted);
    font-size: 14px;
  }
  .me-total {
    font-size: 34px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rows li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 6px 16px 6px 12px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .rows li.me {
    border-color: var(--amber);
  }
  .rank {
    width: 20px;
    font-weight: 800;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .you {
    color: var(--amber);
    font-weight: 650;
  }
  .last {
    font-size: 13px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .total {
    font-size: 20px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
</style>
