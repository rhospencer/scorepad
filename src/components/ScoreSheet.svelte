<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { sitsOut, totals } from '../lib/scoring';
  import { sessionWinners } from '../lib/session';
  import type { GameModule, Session } from '../lib/types';

  interface Props {
    game: GameModule;
    session: Session;
    /** Called when a scored round is tapped, to edit it. Omit for a read-only sheet. */
    onpickround?: (round: number) => void;
    /** Desktop: names under the avatars in the header (there's room). */
    showNames?: boolean;
  }

  let { game, session, onpickround, showNames = false }: Props = $props();

  const roundCount = $derived(Math.max(game.rounds?.length ?? 0, session.scores.length));
  const num = new Intl.NumberFormat();
  const playerTotals = $derived(totals(session.scores, session.players.length));
  const leaders = $derived(session.scores.length > 0 ? new Set(sessionWinners(game, session)) : new Set<number>());
</script>

<div class="wrap">
  <table>
    <thead>
      <tr>
        <th scope="col" class="round-col">Rd</th>
        {#each session.players as p, i (p.id)}
          <th scope="col" class:leader={leaders.has(i)} title={p.name}>
            <span class="head-cell">
              <Avatar name={p.name} seat={i} emoji={p.emoji} size={28} />
              {#if showNames}<span class="head-name">{p.name}</span>{:else}<span class="visually-hidden">{p.name}</span>{/if}
            </span>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each { length: roundCount } as _, r}
        {@const scored = r < session.scores.length}
        {@const isNext = r === session.scores.length}
        <tr class:future={!scored} class:next={isNext}>
          <th scope="row" class="round-col">
            {#if scored && onpickround}
              <button type="button" class="round-btn" aria-label="Edit round {r + 1}" onclick={() => onpickround(r)}>
                {r + 1}<small>{game.rounds?.[r]?.label ?? ''}</small>
              </button>
            {:else}
              <span class="round-btn">{r + 1}<small>{game.rounds?.[r]?.label ?? ''}</small></span>
            {/if}
          </th>
          {#each session.players as p, i (p.id)}
            {@const out = scored && session.outs[r] === i}
            <td class:out>
              {#if scored && sitsOut(game, session.scores, r, i)}
                <span aria-hidden="true">–</span><span class="visually-hidden">no turn</span>
              {:else if scored}
                {@const t = session.tricks?.[r]?.[i]}
                <span class:neg={session.scores[r][i] < 0}>{num.format(session.scores[r][i])}</span>
                {#if out}<span class="visually-hidden">({game.roundGrid?.out?.label ?? 'out'})</span>{/if}
                {#if t && t.bid !== null && t.tricks !== null}
                  <!-- Bid-and-tricks games: bid / tricks won, so a miss is easy to spot. -->
                  <small class="bt" class:miss={t.bid !== t.tricks}>
                    <span class="visually-hidden">bid</span>{t.bid}<span aria-hidden="true">/</span><span class="visually-hidden">, won</span>{t.tricks}
                  </small>
                {/if}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <th scope="row" class="round-col">Total</th>
        {#each playerTotals as t, i}
          <td class:leader={leaders.has(i)}>{num.format(t)}</td>
        {/each}
      </tr>
    </tfoot>
  </table>
</div>
{#if game.roundGrid?.out}
  <p class="legend">
    <span class="swatch"></span>
    {game.roundGrid.out.score === undefined ? `called ${game.roundGrid.out.label}` : `went ${game.roundGrid.out.label.toLowerCase()}`}{onpickround ? ' · tap a round number to fix it' : ''}
  </p>
{/if}

<style>
  .neg {
    color: var(--coral);
  }
  .bt {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    line-height: 1.1;
  }
  .bt.miss {
    color: var(--coral);
  }
  .head-cell {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .head-name {
    max-width: 96px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text);
  }
  .wrap {
    overflow-x: auto;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0 6px;
    height: 44px;
    text-align: center;
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
  }
  thead th {
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  td {
    font-size: 16px;
  }
  /* Pinned so round numbers stay visible when 6–7 players scroll sideways. */
  .round-col {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--surface);
    width: 52px;
    text-align: left;
    padding-left: 12px;
    color: var(--muted);
    font-size: 14px;
  }
  .round-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    min-height: 44px;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 700;
    line-height: 1.1;
    cursor: pointer;
  }
  span.round-btn {
    cursor: default;
  }
  small {
    font-size: 10px;
    font-weight: 500;
    opacity: 0.8;
  }
  .future td,
  .future th {
    opacity: 0.45;
  }
  .next th {
    color: var(--amber);
    opacity: 1;
  }
  td.out {
    color: var(--amber);
    font-weight: 800;
    background: color-mix(in srgb, var(--amber) 12%, transparent);
  }
  .leader {
    color: var(--teal);
  }
  tfoot th,
  tfoot td {
    border-bottom: 0;
    height: 52px;
    font-weight: 800;
    font-size: 18px;
    background: var(--surface-2);
  }
  tfoot th {
    font-size: 13px;
  }
  .legend {
    margin: 10px 2px 0;
    font-size: 13px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--amber) 35%, transparent);
    border: 1px solid var(--amber);
  }
</style>
