<script lang="ts">
  import Avatar from '../components/Avatar.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import { getSessionGame } from '../games';
  import { playerRecords, type PlayerRecord } from '../lib/records';
  import type { Person, Session } from '../lib/types';

  interface Props {
    /** Every finished game on the device. */
    sessions: Session[];
    /** Saved players: names, emoji and merges. */
    people: Person[];
    onback: () => void;
    /** Count saved player `id` as `into` from now on. */
    onmerge: (id: string, into: string) => void;
    /** Undo a merge. */
    onsplit: (id: string) => void;
  }

  let { sessions, people, onback, onmerge, onsplit }: Props = $props();

  const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const num = new Intl.NumberFormat();

  const everyone = $derived(playerRecords(sessions, getSessionGame, people));
  const saved = $derived(new Set(people.map((p) => p.id)));
  /** Avatar color: the seat from their latest game, the same whichever game is filtered. */
  const seatOf = $derived(new Map(everyone.map((r) => [r.key, r.seat])));

  /** Game types with finished games, most played first. */
  const gameChips = $derived.by(() => {
    const counts = new Map<string, { id: string; name: string; icon: string; count: number }>();
    for (const s of sessions) {
      const g = getSessionGame(s);
      if (!g) continue;
      const c = counts.get(s.gameId) ?? { id: s.gameId, name: g.name, icon: g.icon, count: 0 };
      c.count++;
      counts.set(s.gameId, c);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  });

  let gameFilter = $state<string | null>(null);
  const records = $derived(
    gameFilter === null ? everyone : playerRecords(sessions.filter((s) => s.gameId === gameFilter), getSessionGame, people),
  );

  let selectedKey = $state<string | null>(null);
  const selected = $derived(records.find((r) => r.key === selectedKey) ?? null);

  /** The player list shown to merge into the selected player. */
  let choosingMerge = $state(false);
  let merging = $state<PlayerRecord | null>(null);
  const mergeCandidates = $derived(
    selected ? everyone.filter((r) => r.key !== selected.key && saved.has(r.key)) : [],
  );

  function select(key: string | null) {
    selectedKey = key;
    choosingMerge = false;
  }

  const pct = (r: PlayerRecord) => Math.round((r.wins / r.games) * 100);
  const times = (n: number) => (n === 1 ? 'game' : 'games');

  function extra(r: PlayerRecord): string {
    if (r.streak >= 2) return `${r.streak} in a row`;
    if (r.lastWin) return `last won ${dateFmt.format(r.lastWin)}`;
    return 'no wins yet';
  }
</script>

<main class="screen">
  <div class="top-bar">
    {#if selected}
      <button type="button" class="icon-btn" aria-label="Back to player records" onclick={() => select(null)}>←</button>
      <p class="crumb">Player records</p>
    {:else}
      <button type="button" class="icon-btn" aria-label="Back to games" onclick={onback}>←</button>
    {/if}
  </div>

  {#if selected}
    {@const r = selected}
    <div class="who">
      <Avatar name={r.name} seat={seatOf.get(r.key) ?? 0} emoji={r.emoji} size={64} />
      <div>
        <h1>{r.name}</h1>
        <p class="meta">{r.games} {times(r.games)} since {dateFmt.format(r.firstPlayed)}</p>
      </div>
    </div>

    <div class="tiles">
      <div class="tile">
        <p class="tile-label">Wins</p>
        <p class="tile-value">{r.wins} <span>· {pct(r)}%</span></p>
      </div>
      <div class="tile">
        <p class="tile-label">Win streak</p>
        <p class="tile-value">{r.streak} <span>· best {r.bestStreak}</span></p>
      </div>
    </div>

    <h2 class="section-label">By game</h2>
    <ul class="panel">
      {#each r.byGame as g (g.gameId)}
        <li class="game-row">
          <span class="game-icon" aria-hidden="true">{g.icon}</span>
          <span class="text">
            <strong>{g.name}</strong>
            <span class="meta">Best {num.format(g.best)}{g.lowWins ? ' · lowest wins' : ''}</span>
          </span>
          <span class="record">{g.wins} of {g.played}</span>
        </li>
      {/each}
    </ul>

    {#if r.rivals.length > 0}
      <h2 class="section-label">Head to head</h2>
      <p class="note">Who finished higher in games they both played</p>
      <ul class="rivals">
        {#each r.rivals as rival (rival.key)}
          <li>
            <div class="rival-head">
              <Avatar name={rival.name} seat={seatOf.get(rival.key) ?? 0} emoji={everyone.find((e) => e.key === rival.key)?.emoji} size={28} />
              <span class="rival-name">vs {rival.name}</span>
              <strong>{rival.ahead}–{rival.behind}</strong>
            </div>
            {#if rival.ahead + rival.behind > 0}
              <div class="split" aria-hidden="true">
                {#if rival.ahead > 0}<span style:flex={rival.ahead} style:background="var(--amber)"></span>{/if}
                {#if rival.behind > 0}<span style:flex={rival.behind} style:background="var(--line-strong)"></span>{/if}
              </div>
            {/if}
            {#if rival.played > rival.ahead + rival.behind}
              <span class="meta">{rival.played - rival.ahead - rival.behind} tied</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    {#if saved.has(r.key)}
      <h2 class="section-label">Same person?</h2>
      {#if r.mergedFrom.length > 0}
        <ul class="panel">
          {#each r.mergedFrom as m (m.id)}
            <li class="merged-row">
              <span class="text">
                <strong>{m.name}</strong>
                <span class="meta">Counted as {r.name}</span>
              </span>
              <button type="button" class="btn btn-ghost small" onclick={() => onsplit(m.id)}>Split off</button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if mergeCandidates.length > 0}
        {#if choosingMerge}
          <p class="note">Pick who is really {r.name}. Their games will count as {r.name}’s.</p>
          <ul class="list">
            {#each mergeCandidates as c (c.key)}
              <li>
                <button type="button" class="card" onclick={() => (merging = c)}>
                  <Avatar name={c.name} seat={seatOf.get(c.key) ?? 0} emoji={c.emoji} size={36} />
                  <span class="text">
                    <strong>{c.name}</strong>
                    <span class="meta">{c.games} {times(c.games)} · last won {c.lastWin ? dateFmt.format(c.lastWin) : 'never'}</span>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
          <button type="button" class="btn btn-ghost btn-block merge-btn" onclick={() => (choosingMerge = false)}>Cancel</button>
        {:else}
          <button type="button" class="btn btn-ghost btn-block merge-btn" onclick={() => (choosingMerge = true)}>
            Merge with another player
          </button>
        {/if}
      {/if}
    {/if}
  {:else}
    <h1 class="title">Player records</h1>

    {#if everyone.length === 0}
      <p class="empty">Finish a game and everyone who played shows up here.</p>
    {:else}
      {#if gameChips.length > 1}
        <div class="filters">
          <button type="button" class="filter" aria-pressed={gameFilter === null} onclick={() => (gameFilter = null)}>All games</button>
          {#each gameChips as g (g.id)}
            <button type="button" class="filter" aria-pressed={gameFilter === g.id} onclick={() => (gameFilter = g.id)}>
              {g.icon} {g.name}
            </button>
          {/each}
        </div>
      {/if}

      <ol class="list">
        {#each records as r (r.key)}
          <li>
            <button type="button" class="card" onclick={() => select(r.key)}>
              <Avatar name={r.name} seat={seatOf.get(r.key) ?? 0} emoji={r.emoji} size={40} />
              <span class="text">
                <strong>{r.name}</strong>
                <span class="meta">{r.games} {times(r.games)} · {pct(r)}% · {extra(r)}</span>
              </span>
              <span class="wins">
                <strong>{r.wins}</strong>
                <span>{r.wins === 1 ? 'win' : 'wins'}</span>
              </span>
            </button>
          </li>
        {/each}
      </ol>
      <p class="note foot">Counts finished games on this device. Someone listed twice? Open them to merge.</p>
    {/if}
  {/if}
  <div class="bottom-space"></div>
</main>

<ConfirmDialog
  open={merging !== null}
  title={merging && selected ? `Merge ${merging.name} into ${selected.name}?` : ''}
  message={merging && selected
    ? `${merging.name}’s ${merging.games} ${times(merging.games)} will count as ${selected.name}’s. You can split them apart again here.`
    : ''}
  confirmLabel="Merge"
  onconfirm={() => {
    if (merging && selected) onmerge(merging.key, selected.key);
    merging = null;
    choosingMerge = false;
  }}
  oncancel={() => (merging = null)}
/>

<style>
  .crumb {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .empty,
  .note {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--muted);
  }
  .note {
    margin: -4px 0 10px;
    font-size: 13px;
  }
  .note.foot {
    margin: 16px 4px 0;
  }
  .filters {
    display: flex;
    gap: 8px;
    margin: -4px -20px 16px;
    padding: 0 20px 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .filter {
    flex: none;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
    font-weight: 650;
    cursor: pointer;
  }
  .filter[aria-pressed='true'] {
    border-color: var(--amber);
    background: var(--amber);
    color: var(--on-amber);
  }
  .list,
  .rivals,
  .panel {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list,
  .rivals {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card {
    width: 100%;
    min-height: 68px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .text strong {
    font-size: 17px;
  }
  .meta {
    font-size: 14px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .wins {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-variant-numeric: tabular-nums;
  }
  .wins strong {
    font-size: 20px;
  }
  .wins span {
    font-size: 12px;
    color: var(--muted);
  }
  .who {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  .who h1 {
    margin: 0;
    font-size: 34px;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }
  .who .meta {
    margin: 4px 0 0;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .tile {
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .tile-label {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .tile-value {
    margin: 4px 0 0;
    font-size: 24px;
    font-weight: 800;
  }
  .tile-value span {
    font-size: 15px;
    font-weight: 650;
    color: var(--muted);
  }
  .panel {
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    overflow: hidden;
  }
  .game-row {
    min-height: 56px;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .game-row + .game-row {
    border-top: 1px solid var(--line);
  }
  .game-icon {
    width: 28px;
    flex: none;
    text-align: center;
    font-size: 22px;
  }
  .game-row .meta {
    font-size: 13px;
  }
  .record {
    font-size: 15px;
    font-weight: 750;
    white-space: nowrap;
  }
  .rivals li {
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rival-head {
    display: flex;
    align-items: center;
    gap: 10px;
    font-variant-numeric: tabular-nums;
  }
  .rival-name {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .split {
    display: flex;
    gap: 2px;
    height: 8px;
  }
  .split span {
    border-radius: 4px;
  }
  .rivals .meta {
    font-size: 13px;
  }
  .merged-row {
    min-height: 60px;
    padding: 8px 8px 8px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .merged-row + .merged-row {
    border-top: 1px solid var(--line);
  }
  .small {
    min-height: 44px;
    font-size: 14px;
  }
  .merge-btn {
    margin-top: 10px;
    min-height: 48px;
    font-size: 15px;
    border-style: dashed;
  }
  .bottom-space {
    height: calc(28px + env(safe-area-inset-bottom));
  }
</style>
