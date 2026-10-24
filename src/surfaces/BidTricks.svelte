<script lang="ts">
  import type { Snippet } from 'svelte';
  import Avatar from '../components/Avatar.svelte';
  import ScoreSheet from '../components/ScoreSheet.svelte';
  import ThemePicker from '../components/ThemePicker.svelte';
  import type { Submission } from '../lib/lobbyTypes';
  import { isFinished, totals } from '../lib/scoring';
  import { dealerIndex, standings } from '../lib/session';
  import {
    allBidsIn,
    allTricksIn,
    approveTrickSubmission,
    bonusPoints,
    changeCapture,
    pendingTrickSubmissions,
    recordTrickRound,
    sendTrickBack,
    setTrickField,
    trickDraftFor,
    trickScore,
    tricksTaken,
  } from '../lib/tricks';
  import type { GameModule, RoundDraft, Session } from '../lib/types';
  import { viewport } from '../lib/viewport.svelte';

  /**
   * Scoring screen for bid-and-tricks games (Skull King): enter everyone's bid,
   * lock the bids, play the round, then enter tricks won and bonus captures.
   */
  interface Props {
    game: GameModule;
    session: Session;
    onchange: (session: Session) => void;
    onexit: () => void;
    onresults: () => void;
    submissions?: Record<string, Submission>;
    onsendback?: (lobbyId: string) => void;
    /** Extra buttons for the top bar (add a player, join QR). */
    tools?: Snippet;
    /** Show the QR code that lets this player (typed in by the host) score from their own phone. */
    onphoneplayer?: (seat: number) => void;
    /** Seats that can show a phone QR: typed-in players, and phones nobody has picked up yet. */
    phoneSeats?: boolean[];
  }

  let { game, session, onchange, onexit, onresults, submissions, onsendback, tools, onphoneplayer, phoneSeats = [] }: Props = $props();

  const rules = $derived(game.bidTricks!);
  const num = new Intl.NumberFormat();
  const signed = (n: number) => (n > 0 ? `+${num.format(n)}` : n < 0 ? `−${num.format(-n)}` : '0');

  // Read once at the start; the screen keeps its own state after that.
  const initialTab = (): 'round' | 'sheet' => (isFinished(game, session.scores) ? 'sheet' : 'round');
  const initialDraft = () => trickDraftFor(session, session.scores.length);
  let tab = $state<'round' | 'sheet'>(initialTab());
  /** A past round being fixed, or null for the round in progress. */
  let editing = $state<number | null>(null);
  let draft = $state<RoundDraft>(initialDraft());
  /** Player whose bonus panel is open. */
  let bonusFor = $state<number | null>(null);

  const round = $derived(editing ?? session.scores.length);
  const roundCount = $derived(game.rounds?.length ?? 0);
  const cards = $derived(rules.cards(round));
  const phase = $derived(draft.phase ?? 'bid');
  const entries = $derived(draft.tricks ?? []);
  const allScored = $derived(isFinished(game, session.scores) && editing === null);
  const dealer = $derived(dealerIndex(game, session, round));
  const running = $derived(totals(session.scores, session.players.length));
  const table = $derived(standings(game, session));
  const isLast = $derived(editing === null && round === roundCount - 1);
  const bidsIn = $derived(allBidsIn(entries));
  const tricksIn = $derived(allTricksIn(entries));
  const taken = $derived(tricksTaken(entries));

  // Phone submissions (only for the round in progress).
  const hasPhones = $derived(session.players.some((p) => p.lobbyId));
  const pending = $derived(
    editing === null && hasPhones ? pendingTrickSubmissions(session, draft, submissions) : session.players.map(() => null),
  );
  const pendingCount = $derived(pending.filter(Boolean).length);
  const missing = $derived(
    session.players
      .filter((_, i) => !pending[i] && (phase === 'bid' ? entries[i]?.bid === null : entries[i]?.tricks === null))
      .map((p) => p.name),
  );

  function update(next: RoundDraft) {
    draft = next;
    // Keep the round in progress in the session so a refresh doesn't lose it.
    if (editing === null) onchange({ ...session, draft: next });
  }

  function onNumber(i: number, field: 'bid' | 'tricks', el: HTMLInputElement) {
    const digits = el.value.replace(/\D/g, '').slice(0, 2);
    const value = digits === '' ? null : Math.min(Number(digits), cards);
    el.value = value === null ? '' : String(value);
    const next = setTrickField(game, entries, i, field, value, round);
    update({ ...draft, tricks: next, sentBack: draft.sentBack?.filter((p) => p !== i) });
  }

  function capture(i: number, id: string, delta: 1 | -1) {
    update({ ...draft, tricks: changeCapture(entries, i, id, delta) });
  }

  function approve(i: number) {
    const sub = pending[i];
    if (sub) update(approveTrickSubmission(game, draft, i, sub, round));
  }

  function approveAll() {
    let next = draft;
    pending.forEach((sub, i) => {
      if (sub) next = approveTrickSubmission(game, next, i, sub, round);
    });
    update(next);
  }

  function sendBack(i: number) {
    const id = session.players[i].lobbyId;
    update(sendTrickBack(draft, i));
    if (id) onsendback?.(id);
  }

  function lockBids() {
    if (bidsIn) update({ ...draft, phase: 'play', sentBack: undefined });
  }

  function reopenBids() {
    bonusFor = null;
    update({ ...draft, phase: 'bid' });
  }

  function finishRound() {
    if (!tricksIn) return;
    const next = recordTrickRound(game, session, round, $state.snapshot(entries));
    editing = null;
    bonusFor = null;
    draft = trickDraftFor(next, next.scores.length);
    onchange(next);
    window.scrollTo({ top: 0 });
  }

  function editRound(r: number) {
    editing = r;
    bonusFor = null;
    draft = trickDraftFor(session, r);
    tab = 'round';
    window.scrollTo({ top: 0 });
  }

  function cancelEdit() {
    editing = null;
    bonusFor = null;
    draft = trickDraftFor(session, session.scores.length);
  }
</script>

{#snippet entry()}
  {#if allScored}
    <p class="eyebrow">{game.name}</p>
    <h1 class="title">All {roundCount} rounds scored</h1>
    <p class="muted">Tap a round on the score sheet to fix a score.</p>
    <div class="actions">
      <button type="button" class="btn btn-primary btn-block" onclick={onresults}>See results</button>
    </div>
  {:else}
    {#if editing !== null}
      <div class="editing" role="status">
        <span>Fixing round {editing + 1}</span>
        <button type="button" class="btn btn-ghost small" onclick={cancelEdit}>Cancel</button>
      </div>
    {/if}

    <header class="round-card">
      <p class="eyebrow">Round {round + 1} of {roundCount}</p>
      <div class="round-main">
        <h1>{game.rounds?.[round]?.label ?? `${cards} cards`}</h1>
        <span class="phase" class:play={phase === 'play'}>{phase === 'bid' ? 'Bidding' : 'Playing'}</span>
      </div>
      {#if dealer !== null}
        <p class="dealer"><strong>{session.players[dealer].name}</strong> deals</p>
      {/if}
    </header>

    <div class="label-row">
      <h2 class="section-label">{phase === 'bid' ? 'Bids' : 'Tricks won'}</h2>
      {#if pendingCount > 0}
        <button type="button" class="approve-all" onclick={approveAll}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 13l4 4 8-9" /><path d="M10 13l4 4 8-9" /></svg>
          Approve all ({pendingCount})
        </button>
      {/if}
    </div>

    <ol class="rows">
      {#each session.players as p, i (p.id)}
        {@const e = entries[i]}
        {@const sub = pending[i]}
        {@const wasSentBack = !sub && !!draft.sentBack?.includes(i)}
        {@const preview = e && e.bid !== null && e.tricks !== null ? trickScore(game, e, round) : null}
        <li class:pending={!!sub} class:sent-back={wasSentBack}>
          <div class="line">
            {#if onphoneplayer && phoneSeats[i]}
              <!-- Typed-in players: tap to show their own QR code and score from their phone. -->
              <button type="button" class="avatar-link" title="Score from their phone" aria-label="Let {p.name} score from their phone" onclick={() => onphoneplayer(i)}>
                <Avatar name={p.name} seat={i} emoji={p.emoji} />
                <span class="phone-badge" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg></span>
              </button>
            {:else}
              <Avatar name={p.name} seat={i} emoji={p.emoji} />
            {/if}
            <label class="who" for="{phase}-{i}">
              <span class="name">{p.name}</span>
              <span class="meta">
                {num.format(running[i])} total{#if dealer === i}<span class="badge">Dealer</span>{/if}
              </span>
              {#if sub}
                <span class="status amber" id="status-{i}">
                  {phase === 'bid' ? `Bid ${sub.bid}` : `Won ${sub.tricks}${sub.captures && Object.keys(sub.captures).length ? ' + bonus' : ''}`} · needs OK
                </span>
              {:else if wasSentBack}
                <span class="status coral" id="status-{i}">Sent back</span>
              {:else if phase === 'play' && e}
                <span class="status">
                  Bid {e.bid}{#if preview !== null}<span class:gain={preview > 0} class:loss={preview < 0}>&nbsp;· {signed(preview)}</span>{/if}
                </span>
              {:else if p.lobbyId && editing === null && e?.bid === null}
                <span class="status">Waiting…</span>
              {/if}
            </label>
            <input
              id="{phase}-{i}"
              class="score"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              placeholder={sub ? String(phase === 'bid' ? sub.bid : sub.tricks) : '–'}
              aria-describedby={sub || wasSentBack ? `status-${i}` : undefined}
              value={(phase === 'bid' ? e?.bid : e?.tricks) ?? ''}
              oninput={(ev) => onNumber(i, phase === 'bid' ? 'bid' : 'tricks', ev.currentTarget)}
            />
            {#if sub}
              <button type="button" class="review-btn ok" aria-label="Approve {p.name}’s {phase === 'bid' ? 'bid' : 'tricks'}" onclick={() => approve(i)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              </button>
              <button type="button" class="review-btn back" aria-label="Send {p.name}’s {phase === 'bid' ? 'bid' : 'tricks'} back" onclick={() => sendBack(i)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 010 10h-3" /></svg>
              </button>
            {:else if phase === 'play' && e}
              {@const bonus = bonusPoints(game, e.captures)}
              <button
                type="button"
                class="bonus-btn"
                class:has={bonus > 0}
                aria-expanded={bonusFor === i}
                aria-label="Bonus captures for {p.name}"
                onclick={() => (bonusFor = bonusFor === i ? null : i)}>{bonus > 0 ? `+${bonus}` : 'Bonus'}</button
              >
            {/if}
          </div>
          {#if phase === 'play' && bonusFor === i && e}
            <div class="bonus-panel">
              {#each rules.bonuses as b (b.id)}
                {@const count = e.captures[b.id] ?? 0}
                <div class="bonus-row">
                  <span class="b-label">{b.label} <span class="b-pts">+{b.points}</span></span>
                  <button type="button" class="step" aria-label="One fewer: {b.label}" disabled={count === 0} onclick={() => capture(i, b.id, -1)}>−</button>
                  <span class="b-count" aria-live="polite">{count}</span>
                  <button type="button" class="step" aria-label="One more: {b.label}" onclick={() => capture(i, b.id, 1)}>+</button>
                </div>
              {/each}
              <p class="b-note">Bonuses only count if {p.name} makes their bid.</p>
            </div>
          {/if}
        </li>
      {/each}
    </ol>

    {#if phase === 'play' && tricksIn && taken !== cards}
      <p class="warn" role="status">Tricks add up to {taken}, but {cards} {cards === 1 ? 'was' : 'were'} played. Double-check before finishing.</p>
    {/if}

    <div class="actions">
      {#if (phase === 'bid' ? !bidsIn : !tricksIn) && (pendingCount > 0 || missing.length > 0)}
        <p class="finish-hint" role="status">
          {[pendingCount > 0 ? `${pendingCount} waiting for your OK` : '', missing.length > 0 ? `${missing.join(', ')} still needed` : '']
            .filter(Boolean)
            .join(' · ')}
        </p>
      {/if}
      {#if phase === 'bid'}
        <button type="button" class="btn btn-primary btn-block" disabled={!bidsIn} onclick={lockBids}>Lock bids and play</button>
      {:else}
        <button type="button" class="btn btn-primary btn-block" disabled={!tricksIn} onclick={finishRound}>
          {editing !== null ? `Save round ${editing + 1}` : isLast ? 'Finish game' : 'Finish round'}
        </button>
        {#if editing === null}
          <button type="button" class="btn btn-ghost btn-block quiet" onclick={reopenBids}>Change bids</button>
        {/if}
      {/if}
    </div>
  {/if}
{/snippet}

<main class="screen wide">
  <div class="top-bar">
    <button type="button" class="icon-btn" aria-label="Back to games (game is saved)" onclick={onexit}>←</button>
    {#if viewport.wide}
      <p class="game-name">{game.name}</p>
    {:else}
      <div class="tabs" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={tab === 'round'} onclick={() => (tab = 'round')}>Round</button>
        <button type="button" role="tab" aria-selected={tab === 'sheet'} onclick={() => (tab = 'sheet')}>Sheet</button>
      </div>
    {/if}
    {@render tools?.()}
    <ThemePicker />
  </div>

  {#if viewport.wide}
    <div class="split">
      <div class="entry">{@render entry()}</div>
      <div class="board">
        <ol class="strip" aria-label="Standings">
          {#each table as s (s.player.id)}
            <li class:lead={s.rank === 1}>
              <span class="rk">{s.rank}</span>
              <Avatar name={s.player.name} seat={s.index} emoji={s.player.emoji} size={32} />
              <span class="nm">
                <span>{s.player.name}</span>
                <small>{s.rank === 1 ? 'Leading' : `${num.format(s.behind)} behind`}</small>
              </span>
              <span class="tot">{num.format(s.total)}</span>
            </li>
          {/each}
        </ol>
        <ScoreSheet {game} {session} onpickround={editRound} showNames />
      </div>
    </div>
  {:else if tab === 'sheet'}
    <p class="eyebrow">{game.name}</p>
    <h1 class="title">Score sheet</h1>
    <ScoreSheet {game} {session} onpickround={editRound} />
  {:else}
    {@render entry()}
  {/if}
</main>

<style>
  .game-name {
    flex: 1;
    margin: 0;
    font-size: 20px;
    font-weight: 800;
  }
  .tabs {
    flex: 1;
    display: flex;
    padding: 4px;
    gap: 4px;
    border-radius: 14px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .tabs button {
    flex: 1;
    min-height: 40px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    font-weight: 650;
    cursor: pointer;
  }
  .tabs button[aria-selected='true'] {
    background: var(--surface-2);
    color: var(--text);
  }
  .split {
    display: grid;
    grid-template-columns: minmax(400px, 500px) minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }
  .entry {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .board {
    position: sticky;
    top: 16px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .strip {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 10px;
  }
  .strip li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
  }
  .strip li.lead {
    border-color: var(--amber);
  }
  .rk {
    width: 16px;
    font-weight: 800;
    color: var(--muted);
  }
  .lead .rk {
    color: var(--amber);
  }
  .nm {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    font-weight: 700;
    font-size: 14px;
  }
  .nm span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nm small {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }
  .tot {
    font-size: 20px;
    font-weight: 800;
  }
  .muted {
    color: var(--muted);
  }
  .editing {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding: 4px 4px 4px 16px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--teal) 12%, transparent);
    border: 1px solid var(--teal);
    color: var(--teal);
    font-weight: 650;
  }
  .small {
    min-height: 44px;
    font-size: 15px;
    border: 0;
    color: var(--text);
  }
  .round-card {
    padding: 16px 18px;
    border-radius: 20px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .round-main {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }
  .round-card h1 {
    margin: 0;
    font-size: 34px;
    line-height: 1.1;
  }
  .phase {
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--amber);
    color: var(--on-amber);
    font-weight: 750;
    font-size: 15px;
  }
  .phase.play {
    background: var(--teal);
    color: var(--on-teal);
  }
  .dealer {
    margin: 10px 0 0;
    color: var(--muted);
  }
  .dealer strong {
    color: var(--text);
  }
  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 20px 0 10px;
  }
  .label-row .section-label {
    margin: 0;
  }
  .approve-all {
    min-height: 44px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    border: 1px solid var(--teal);
    background: color-mix(in srgb, var(--teal) 12%, transparent);
    color: var(--teal);
    font-weight: 750;
    cursor: pointer;
  }
  /* About 7 players show; past that the list scrolls so the buttons stay in view. */
  .rows {
    list-style: none;
    margin: -3px -6px -3px -3px;
    padding: 3px 6px 3px 3px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 560px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .rows li {
    padding: 6px 6px 6px 12px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .rows li.pending {
    border-color: var(--amber);
  }
  .rows li.sent-back {
    border-color: var(--coral);
  }
  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
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
  .meta {
    font-size: 13px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .badge {
    padding: 1px 7px;
    border-radius: 999px;
    border: 1px solid var(--teal);
    color: var(--teal);
    font-size: 11px;
    font-weight: 700;
  }
  .status {
    font-size: 12px;
    font-weight: 650;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .status.amber {
    color: var(--amber);
  }
  .status.coral {
    color: var(--coral);
  }
  .gain {
    color: var(--teal);
  }
  .loss {
    color: var(--coral);
  }
  .score {
    width: 72px;
    height: 56px;
    flex: none;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    font-size: 24px;
    font-weight: 750;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .score:focus {
    border-color: var(--amber);
    outline: none;
  }
  .score::placeholder {
    color: var(--muted);
    opacity: 0.5;
  }
  .pending .score {
    border: 2px dashed var(--amber);
  }
  .pending .score::placeholder {
    color: var(--amber);
    opacity: 1;
  }
  .review-btn {
    width: 44px;
    height: 56px;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    cursor: pointer;
  }
  .review-btn.ok {
    border: 0;
    background: var(--teal);
    color: var(--on-teal);
  }
  .review-btn.back {
    border: 1px solid var(--coral);
    background: transparent;
    color: var(--coral);
  }
  .bonus-btn {
    min-width: 72px;
    height: 56px;
    flex: none;
    padding: 0 10px;
    border-radius: 12px;
    border: 1px dashed var(--line-strong);
    background: transparent;
    color: var(--muted);
    font-weight: 750;
    cursor: pointer;
  }
  .bonus-btn.has {
    border: 1px solid var(--amber);
    color: var(--amber);
  }
  .bonus-btn[aria-expanded='true'] {
    background: var(--surface-2);
  }
  .bonus-panel {
    margin: 8px 0 4px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bonus-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .b-label {
    flex: 1;
    min-width: 0;
    font-size: 14px;
  }
  .b-pts {
    color: var(--amber);
    font-weight: 750;
  }
  .step {
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: 12px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--text);
    font-size: 20px;
    font-weight: 700;
    cursor: pointer;
  }
  .step:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .b-count {
    width: 24px;
    text-align: center;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .b-note {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .warn {
    margin: 12px 0 0;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--amber);
    color: var(--amber);
    font-weight: 650;
    font-size: 14px;
  }
  .finish-hint {
    margin: 0;
    text-align: center;
    font-size: 14px;
    color: var(--muted);
  }
  .quiet {
    min-height: 44px;
    font-size: 15px;
    color: var(--muted);
  }
</style>
