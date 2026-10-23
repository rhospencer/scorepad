<script lang="ts">
  import Avatar from '../components/Avatar.svelte';
  import ThemePicker from '../components/ThemePicker.svelte';
  import ScoreSheet from '../components/ScoreSheet.svelte';
  import { outConflict, pendingSubmissions } from '../lib/liveRound';
  import type { Submission } from '../lib/lobbyTypes';
  import { finalRound, isFinished, totals } from '../lib/scoring';
  import { viewport } from '../lib/viewport.svelte';
  import {
    approveSubmission,
    cheatSheetText,
    dealerIndex,
    draftComplete,
    draftFor,
    recordRound,
    outKeepsScore,
    sendBack,
    setEntry,
    skippedPlayers,
    standings,
    toggleOut,
  } from '../lib/session';
  import type { GameModule, RoundDraft, Session } from '../lib/types';

  interface Props {
    game: GameModule;
    session: Session;
    /** Every change to the session (including the unfinished round) goes through here. */
    onchange: (session: Session) => void;
    onexit: () => void;
    onresults: () => void;
    /** Scores phones sent, by lobby id (only when players joined by phone). */
    submissions?: Record<string, Submission>;
    /** Tell the player's phone its score was sent back. */
    onsendback?: (lobbyId: string) => void;
  }

  let { game, session, onchange, onexit, onresults, submissions, onsendback }: Props = $props();

  // A finished game opens on the sheet, since there's no round left to enter.
  let tab = $state<'round' | 'sheet'>(initialTab());
  /** A past round being fixed, or null when entering the next round. */
  let editing = $state<number | null>(null);
  let draft = $state<RoundDraft>(initialDraft());
  let rowsEl = $state<HTMLOListElement>();

  function initialTab() {
    return isFinished(game, session.scores) ? 'sheet' : 'round';
  }

  function initialDraft() {
    return draftFor(session, session.scores.length);
  }

  const round = $derived(editing ?? session.scores.length);
  const roundCount = $derived(game.rounds?.length ?? null);
  const allScored = $derived(isFinished(game, session.scores) && editing === null);
  const target = $derived(game.winner.rule === 'first-to-target' ? game.winner.target : null);
  /** Lowest-wins games that end when someone reaches a score (Kombio "to 100"). */
  const endAt = $derived(game.winner.rule === 'lowest-total' ? (game.winner.endAt ?? null) : null);
  const meta = $derived(game.rounds?.[round]);
  const dealer = $derived(dealerIndex(game, session, round));
  const cheat = $derived(cheatSheetText(game, session));
  const running = $derived(totals(session.scores, session.players.length));
  const table = $derived(standings(game, session));
  const outRule = $derived(game.roundGrid?.out);
  const quick = $derived(game.roundGrid?.quickScore);
  const num = new Intl.NumberFormat();
  const final = $derived(finalRound(game, session.scores));
  const isFinal = $derived(final !== null && round === final.round);
  const skip = $derived(skippedPlayers(game, session, round));
  const lastTurnNames = $derived(session.players.filter((_, i) => !skip[i]).map((p) => p.name));
  const isLast = $derived(
    editing === null && ((roundCount !== null && round === roundCount - 1) || isFinal),
  );

  // ---- Scores sent from phones (only for the round in progress) ----
  const hasPhones = $derived(session.players.some((p) => p.lobbyId));
  const pending = $derived(
    editing === null && hasPhones
      ? pendingSubmissions(game, session, draft, submissions)
      : session.players.map(() => null),
  );
  const pendingCount = $derived(pending.filter(Boolean).length);
  const clash = $derived(editing === null ? outConflict(game, session, draft, pending) : []);
  /** What Approve all will take: everything pending except clashing "went out" claims. */
  const approvable = $derived(pending.filter((sub) => sub && !(sub.special && clash.length > 0)).length);
  const missing = $derived(
    session.players.filter((_, i) => !skip[i] && draft.entries[i] === null && !pending[i]).map((p) => p.name),
  );
  const complete = $derived(draftComplete(draft, skip));

  function pendingText(sub: Submission): string {
    if (!sub.special) return num.format(sub.value);
    return outRule ? outRule.label : (quick?.label ?? num.format(sub.value));
  }

  function approve(i: number) {
    const sub = pending[i];
    if (sub) update(approveSubmission(game, draft, i, sub));
  }

  /** Approve every pending score, except "went out" claims that clash (the host picks one). */
  function approveAll() {
    let next = draft;
    pending.forEach((sub, i) => {
      if (sub && !(sub.special && clash.length > 0)) next = approveSubmission(game, next, i, sub);
    });
    update(next);
  }

  function sendBackRow(i: number) {
    const id = session.players[i].lobbyId;
    update(sendBack(draft, i));
    if (id) onsendback?.(id);
  }

  function update(next: RoundDraft) {
    draft = next;
    // Keep the unfinished round in the session so a refresh doesn't lose it.
    if (editing === null) onchange({ ...session, draft: next });
  }

  function onInput(i: number, el: HTMLInputElement) {
    // A leading minus is allowed in games with negative scores (Kombio's special hands).
    const negative = !!game.roundGrid?.allowNegative && el.value.trim().startsWith('-');
    const digits = el.value.replace(/\D/g, '').slice(0, game.roundGrid?.entryDigits ?? 5);
    const shown = (negative ? '-' : '') + digits;
    if (shown !== el.value) el.value = shown;
    const value = digits === '' ? null : (negative ? -1 : 1) * Number(digits);
    update(setEntry(draft, i, value, outKeepsScore(game)));
  }

  /** What the round's adjustment will do (e.g. KOMBIO +10s), once every score is in. */
  const adjustNote = $derived.by(() => {
    const adjust = game.roundGrid?.adjust;
    if (!adjust || draft.out === null || editing !== null) return null;
    if (draft.entries.some((v) => v === null)) return null;
    const raw = draft.entries as number[];
    const after = adjust(raw, draft.out);
    const changed = after.flatMap((v, i) => (v !== raw[i] ? [{ name: session.players[i].name, diff: v - raw[i] }] : []));
    if (changed.length === 0) return null;
    const groups = new Map<number, string[]>();
    for (const c of changed) groups.set(c.diff, [...(groups.get(c.diff) ?? []), c.name]);
    const caller = session.players[draft.out].name;
    return `${caller} called ${outRule?.label}: ` + [...groups].map(([d, names]) => `${names.join(', ')} ${d > 0 ? '+' : ''}${d}`).join(' · ');
  });

  /** Enter jumps to the next empty score. */
  function nextOnEnter(e: KeyboardEvent, i: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = [...(rowsEl?.querySelectorAll<HTMLInputElement>('input') ?? [])];
    const next = inputs.slice(i + 1).find((el) => !el.readOnly && el.value === '');
    if (next) next.focus();
    else (e.currentTarget as HTMLInputElement).blur();
  }

  function finishRound() {
    const next = recordRound(game, session, round, $state.snapshot(draft));
    editing = null;
    draft = draftFor(next, next.scores.length);
    onchange(next);
    window.scrollTo({ top: 0 });
  }

  function editRound(r: number) {
    editing = r;
    draft = draftFor(session, r);
    tab = 'round';
    window.scrollTo({ top: 0 });
  }

  function cancelEdit() {
    editing = null;
    draft = draftFor(session, session.scores.length);
  }
</script>

{#snippet entry()}
  {#if allScored}
    <p class="eyebrow">{game.name}</p>
    <h1 class="title">{roundCount ? `All ${roundCount} rounds scored` : `Someone reached ${num.format(target ?? endAt ?? 0)}`}</h1>
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
      <p class="eyebrow">Round {round + 1}{roundCount ? ` of ${roundCount}` : ''}{target ? ` · first to ${num.format(target)}` : ''}{endAt ? ` · ends at ${num.format(endAt)}` : ''}</p>
      <div class="round-main">
        <h1>{isFinal ? 'Final turns' : (meta?.label ?? `Round ${round + 1}`)}</h1>
        {#if meta?.note}<span class="wild">{meta.note}</span>{/if}
      </div>
      {#if isFinal && final}
        <p class="dealer">
          <strong>{session.players[final.reachedBy].name}</strong> reached {num.format(target ?? 0)}. Last turn for
          <strong>{lastTurnNames.join(', ')}</strong>.
        </p>
      {/if}
      {#if dealer !== null}
        <p class="dealer"><strong>{session.players[dealer].name}</strong> deals</p>
      {/if}
    </header>

    {#if cheat}<p class="cheat">{cheat}</p>{/if}

    {#if clash.length > 0}
      <p class="clash" role="alert">{clash.join(' and ')} both say they went out. Approve one; send the other back.</p>
    {/if}

    <div class="label-row">
      <h2 class="section-label">{game.roundGrid?.entryLabel ?? 'Score'}</h2>
      {#if approvable > 0}
        <button type="button" class="approve-all" onclick={approveAll}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 13l4 4 8-9" /><path d="M10 13l4 4 8-9" /></svg>
          Approve all ({approvable})
        </button>
      {/if}
    </div>
    <ol class="rows" bind:this={rowsEl}>
      {#each session.players as p, i (p.id)}
        {@const isOut = draft.out === i}
        {@const sub = pending[i]}
        {@const wasSentBack = !sub && draft.entries[i] === null && !!draft.sentBack?.includes(i)}
        <li class:is-out={isOut} class:skipped={skip[i]} class:pending={!!sub} class:sent-back={wasSentBack}>
          <Avatar name={p.name} seat={i} emoji={p.emoji} />
          <label class="who" for="score-{i}">
            <span class="name">{p.name}</span>
            <span class="meta">
              {num.format(running[i])} total{#if dealer === i}<span class="badge">Dealer</span>{/if}
            </span>
            {#if sub}
              <span class="status amber" id="status-{i}">{sub.special && outRule ? 'Went out' : `Sent ${pendingText(sub)}`} · needs OK</span>
            {:else if wasSentBack}
              <span class="status coral" id="status-{i}">Sent back</span>
            {:else if p.lobbyId && editing === null && draft.entries[i] === null && !skip[i]}
              <span class="status">Waiting…</span>
            {/if}
          </label>
          {#if skip[i]}
            <span class="done">Done</span>
          {:else}
          <input
            id="score-{i}"
            class="score"
            class:long={(game.roundGrid?.entryDigits ?? 5) > 5}
            type="text"
            inputmode={game.roundGrid?.allowNegative ? 'text' : 'numeric'}
            autocomplete="off"
            enterkeyhint="next"
            placeholder={sub ? pendingText(sub) : '–'}
            aria-describedby={sub || wasSentBack ? `status-${i}` : undefined}
            readonly={isOut && outRule?.score !== undefined}
            value={draft.entries[i] ?? ''}
            oninput={(e) => onInput(i, e.currentTarget)}
            onkeydown={(e) => nextOnEnter(e, i)}
          />
          {#if sub}
            <button type="button" class="review-btn ok" aria-label="Approve {p.name}’s score" onclick={() => approve(i)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
            </button>
            <button type="button" class="review-btn back" aria-label="Send {p.name}’s score back" onclick={() => sendBackRow(i)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 010 10h-3" /></svg>
            </button>
          {:else if outRule}
            <button
              type="button"
              class="out-btn"
              aria-pressed={isOut}
              aria-label={outRule.score === undefined ? `${p.name} called ${outRule.label}` : `${p.name} went ${outRule.label.toLowerCase()}`}
              onclick={() => update(toggleOut(game, draft, i))}>{outRule.label}</button
            >
          {/if}
          {#if quick && !sub}
            {@const isQuick = draft.entries[i] === quick.score}
            <button
              type="button"
              class="out-btn"
              aria-pressed={isQuick}
              aria-label="{p.name}: {quick.label}"
              onclick={() => update(setEntry(draft, i, isQuick ? null : quick.score))}>{quick.label}</button
            >
          {/if}
          {/if}
        </li>
      {/each}
    </ol>

    {#if adjustNote}
      <p class="adjust-note" role="status">{adjustNote}</p>
    {/if}

    <div class="actions">
      {#if !complete && editing === null && hasPhones}
        <p class="finish-hint" role="status">
          {[pendingCount > 0 ? `${pendingCount} waiting for your OK` : '', missing.length > 0 ? `${missing.join(', ')} still needed` : '']
            .filter(Boolean)
            .join(' · ')}
        </p>
      {/if}
      <button type="button" class="btn btn-primary btn-block" disabled={!complete} onclick={finishRound}>
        {editing !== null ? `Save round ${editing + 1}` : isLast ? 'Finish game' : 'Finish round'}
      </button>
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
        <button type="button" role="tab" aria-selected={tab === 'sheet'} onclick={() => (tab = 'sheet')}>Score sheet</button>
      </div>
    {/if}
    <ThemePicker />
  </div>

  {#if viewport.wide}
    <!-- Desktop: enter the round on the left, watch the whole game on the right. -->
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
  .split {
    display: grid;
    grid-template-columns: minmax(380px, 480px) minmax(0, 1fr);
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
  .wild {
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--amber);
    color: var(--on-amber);
    font-weight: 750;
    font-size: 15px;
  }
  .dealer {
    margin: 10px 0 0;
    color: var(--muted);
  }
  .dealer strong {
    color: var(--text);
  }
  .cheat {
    margin: 12px 2px 0;
    font-size: 14px;
    color: var(--muted);
  }
  .section-label {
    margin-top: 20px;
  }
  /* About 7 players show; past that the list scrolls so Finish round stays in view. */
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
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 68px;
    padding: 6px 6px 6px 12px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 20px;
    margin-bottom: 10px;
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
  .clash {
    margin: 12px 0 0;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--coral);
    background: color-mix(in srgb, var(--coral) 12%, transparent);
    color: var(--coral-text);
    font-weight: 650;
  }
  .status {
    font-size: 12px;
    font-weight: 650;
    color: var(--muted);
  }
  .status.amber {
    color: var(--amber);
  }
  .status.coral {
    color: var(--coral);
  }
  .rows li.pending {
    border-color: var(--amber);
  }
  .rows li.pending .score {
    border: 2px dashed var(--amber);
  }
  .rows li.pending .score::placeholder {
    color: var(--amber);
    opacity: 1;
  }
  .rows li.sent-back {
    border-color: var(--coral);
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
  .adjust-note {
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
  .rows li.skipped {
    opacity: 0.6;
  }
  .done {
    padding: 0 14px;
    color: var(--muted);
    font-weight: 650;
  }
  .rows li.is-out {
    border-color: var(--amber);
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
  .score {
    width: 84px;
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
  /* Money games: room for 1,000,000-sized entries. */
  .score.long {
    width: 128px;
    font-size: 20px;
  }
  .score:focus {
    border-color: var(--amber);
    outline: none;
  }
  .score::placeholder {
    color: var(--muted);
    opacity: 0.5;
  }
  .score[readonly] {
    color: var(--amber);
    background: transparent;
  }
  .out-btn {
    min-width: 64px;
    padding: 0 10px;
    height: 56px;
    flex: none;
    border-radius: 12px;
    border: 1px dashed var(--line-strong);
    background: transparent;
    color: var(--muted);
    font-weight: 750;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .out-btn[aria-pressed='true'] {
    border: 1px solid var(--amber);
    background: var(--amber);
    color: var(--on-amber);
  }
</style>
