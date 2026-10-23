<script lang="ts">
  import Avatar from '../components/Avatar.svelte';
  import GameDetail from '../components/GameDetail.svelte';
  import ThemePicker from '../components/ThemePicker.svelte';
  import { viewport } from '../lib/viewport.svelte';
  import { games, getGame } from '../games';
  import { sessionWinners } from '../lib/session';
  import type { GameModule, Session } from '../lib/types';

  interface Props {
    inProgress: Session[];
    recent: Session[];
    /** Shown when the device won't let us save (e.g. some private browsing modes). */
    saveFailed?: boolean;
    onpick: (game: GameModule) => void;
    onopen: (session: Session) => void;
    ondelete: (session: Session) => void;
  }

  let { inProgress, recent, saveFailed = false, onpick, onopen, ondelete }: Props = $props();

  const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

  function names(s: Session) {
    return s.players.map((p) => p.name).join(', ');
  }

  function progress(s: Session) {
    const total = getGame(s.gameId)?.rounds?.length;
    return `Round ${Math.min(s.scores.length + 1, total ?? Infinity)}${total ? ` of ${total}` : ''}`;
  }

  function outcome(s: Session) {
    const game = getGame(s.gameId);
    if (!game) return '';
    const w = sessionWinners(game, s).map((i) => s.players[i].name);
    return w.length === 1 ? `${w[0]} won` : `${w.join(' & ')} tied`;
  }

  // Desktop: the game shown in the detail pane. Phones go straight to setup instead.
  // Nothing is selected until a game is clicked; the pane shows a prompt until then.
  let selectedId = $state<string | null>(null);
  const selected = $derived(games.find((g) => g.id === selectedId) ?? null);

  function pickGame(game: GameModule) {
    if (viewport.wide) selectedId = game.id;
    else onpick(game);
  }

  function confirmDelete(s: Session) {
    const what = s.finishedAt ? 'this finished game' : 'this game in progress';
    if (confirm(`Delete ${what}? This can't be undone.`)) ondelete(s);
  }
</script>

<main class="screen wide">
  <div class="layout" class:split={viewport.wide}>
    <div class="side">
      <div class="brand">
        <p class="eyebrow">Scorepad</p>
        <ThemePicker />
      </div>

      {#if saveFailed}
        <p class="warn" role="alert">This browser isn't letting Scorepad save. Scores will be lost if you close the page.</p>
      {/if}

      {#if inProgress.length > 0}
        <h1 class="title">Keep playing</h1>
        <ul class="list">
          {#each inProgress as s (s.id)}
            <li class="row">
              <button type="button" class="card resume" onclick={() => onopen(s)}>
                <span class="faces" aria-hidden="true">
                  {#each s.players.slice(0, 4) as p, i (p.id)}
                    <Avatar name={p.name} seat={i} emoji={p.emoji} size={26} />
                  {/each}
                </span>
                <span class="card-text">
                  <strong>{getGame(s.gameId)?.name ?? s.gameId}</strong>
                  <span class="meta">{progress(s)} · {names(s)}</span>
                </span>
              </button>
              <button type="button" class="icon-btn" aria-label="Delete this game" onclick={() => confirmDelete(s)}>×</button>
            </li>
          {/each}
        </ul>
        <h2 class="section-label">{viewport.wide ? 'Games' : 'New game'}</h2>
      {:else}
        <h1 class="title">{viewport.wide ? 'Games' : 'Pick a game'}</h1>
      {/if}

      <ul class="list">
        {#each games as game (game.id)}
          <li>
            <button
              type="button"
              class="card game"
              aria-pressed={viewport.wide ? game.id === selected?.id : undefined}
              onclick={() => pickGame(game)}
            >
              <span class="card-text">
                <strong>{game.name}</strong>
                <span class="meta">{game.mode} · {game.players.min}–{game.players.max}+ players</span>
              </span>
              {#if viewport.wide}
                <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              {/if}
            </button>
          </li>
        {/each}
      </ul>

      {#if recent.length > 0}
        <h2 class="section-label">Recent games</h2>
        <ul class="list">
          {#each recent as s (s.id)}
            <li class="row">
              <button type="button" class="card" onclick={() => onopen(s)}>
                <span class="card-text">
                  <strong>{getGame(s.gameId)?.name ?? s.gameId} · {outcome(s)}</strong>
                  <span class="meta">{dateFmt.format(s.finishedAt)} · {names(s)}</span>
                </span>
              </button>
              <button type="button" class="icon-btn" aria-label="Delete this game" onclick={() => confirmDelete(s)}>×</button>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="bottom-space"></div>
    </div>

    {#if viewport.wide}
      <div class="main-pane">
        {#if selected}
          <GameDetail game={selected} onstart={() => onpick(selected)} />
        {:else}
          <div class="empty">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
            <h2>Pick a game</h2>
            <p>Choose one on the left to see how it’s played and start a new game.</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>

<style>
  .brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }
  .brand .eyebrow {
    margin: 0;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .layout.split {
    display: grid;
    grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }
  /* The list scrolls on its own beside the detail pane. */
  /* The divider runs the full height to the right of the games list. */
  .split .side {
    position: sticky;
    top: 0;
    min-height: calc(100dvh - 28px);
    max-height: 100dvh;
    overflow-y: auto;
    padding-right: 32px;
    border-right: 1px solid color-mix(in srgb, var(--line-strong) 55%, var(--line));
  }
  .empty {
    min-height: 60dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    color: var(--muted);
  }
  .empty h2 {
    margin: 8px 0 0;
    font-size: 28px;
    color: var(--text);
  }
  .empty p {
    margin: 0;
    max-width: 340px;
    line-height: 1.5;
  }
  .main-pane {
    padding: 8px 0 40px;
  }
  .card {
    width: 100%;
    min-width: 0;
    min-height: 64px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }
  .card.resume {
    border-color: var(--amber);
  }
  .card.game[aria-pressed='true'] {
    border-color: var(--amber);
    background: var(--surface-2);
  }
  .card-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .faces {
    display: flex;
    flex: none;
  }
  .faces > :global(* + *) {
    margin-left: -8px;
  }
  .faces > :global(*) {
    box-shadow: 0 0 0 2px var(--surface);
  }
  .chev {
    flex: none;
    color: var(--muted);
  }
  strong {
    font-size: 17px;
  }
  .meta {
    max-width: 100%;
    font-size: 14px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .warn {
    margin: 0 0 16px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--amber);
    color: var(--amber);
    font-size: 14px;
  }
  .bottom-space {
    height: calc(28px + env(safe-area-inset-bottom));
  }
</style>
