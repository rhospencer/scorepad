<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { lobbyApi } from '../lib/lobbyClient';
  import type { LiveRound, Scoreboard } from '../lib/lobbyTypes';
  import { ordinal } from '../lib/scoreboard';

  /** A phone player's Skull King round: send a bid, then (after bids lock) tricks won and bonuses. */
  interface Props {
    code: string;
    me: { id: string; token: string };
    round: LiveRound;
    submitted: boolean;
    scoreboard: Scoreboard | null;
  }

  let { code, me, round, submitted, scoreboard }: Props = $props();

  const num = new Intl.NumberFormat();
  const trick = $derived(round.trick!);
  const phase = $derived(trick.phase);
  const counts = $derived(Array.from({ length: trick.cards + 1 }, (_, i) => i));

  // What's being entered; reset when the round, game or phase changes.
  let pick = $state<number | null>(null);
  let captures = $state<Record<string, number>>({});
  let editing = $state(false);
  let busy = $state(false);
  let error = $state('');
  let sent = $state<{ key: string; label: string } | null>(null);
  let entryKey = $state('');

  const key = $derived(`${round.gameId}:${round.round}:${phase}`);
  $effect.pre(() => {
    if (key !== entryKey) {
      entryKey = key;
      pick = null;
      captures = {};
      editing = false;
      error = '';
    }
  });

  const mine = $derived(round.players.find((p) => p.lobbyId === me.id));
  const myState = $derived(mine?.state ?? 'open');
  const myBid = $derived(mine && trick.bids ? trick.bids[mine.seat] : null);
  const myStanding = $derived(scoreboard?.rows.find((r) => r.lobbyId === me.id));
  const lastRound = $derived(myStanding?.last ?? null);
  const sentHere = $derived(sent && sent.key === key ? sent : null);
  const bonusTotal = $derived(trick.bonuses.reduce((s, b) => s + b.points * (captures[b.id] ?? 0), 0));
  const inCount = $derived(round.players.filter((p) => p.state === 'approved').length);
  const screen = $derived.by(() => {
    if (myState === 'approved') return 'approved';
    if (submitted && !editing) return 'waiting';
    return 'entry';
  });

  function step(id: string, delta: 1 | -1) {
    const next = Math.max(0, Math.min(trick.cards, (captures[id] ?? 0) + delta));
    const copy = { ...captures };
    if (next === 0) delete copy[id];
    else copy[id] = next;
    captures = copy;
  }

  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (pick === null || busy) return;
    busy = true;
    error = '';
    try {
      const base = { gameId: round.gameId, round: round.round, value: 0, special: false, phase };
      if (phase === 'bid') {
        await lobbyApi.submitScore(code, me.id, me.token, { ...base, bid: pick });
        sent = { key, label: `Bid ${pick}` };
      } else {
        await lobbyApi.submitScore(code, me.id, me.token, { ...base, tricks: pick, captures });
        sent = { key, label: `Won ${pick}${bonusTotal ? ` · +${bonusTotal} bonus` : ''}` };
      }
      editing = false;
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<section class="round" aria-live="polite">
  {#if round.round > 0 && lastRound !== null && phase === 'bid' && screen === 'entry'}
    <p class="last" class:loss={lastRound < 0}>
      Last round: {lastRound > 0 ? `+${num.format(lastRound)}` : num.format(lastRound)}
    </p>
  {/if}

  <header class="head">
    <div>
      <p class="eyebrow">{scoreboard?.gameName ?? ''} · {round.title}</p>
      <h1>{phase === 'bid' ? 'Place your bid' : 'How did it go?'}</h1>
      <p class="note">{[phase === 'bid' ? 'Bidding' : 'Playing', round.dealer ? `${round.dealer} deals` : ''].filter(Boolean).join(' · ')}</p>
    </div>
    {#if myStanding}
      <div class="standing">
        <span class="place">{ordinal(myStanding.rank)}</span>
        <span class="sub">{num.format(myStanding.total)}</span>
      </div>
    {/if}
  </header>

  {#if phase === 'play' && myBid !== null}
    <p class="my-bid">You bid <strong>{myBid}</strong></p>
  {/if}

  {#if screen === 'entry'}
    {#if myState === 'sentBack' && !submitted}
      <div class="alert" role="alert">
        <strong>The host sent your {phase === 'bid' ? 'bid' : 'tricks'} back</strong>
        <span>Check with the table and send it again.</span>
      </div>
    {/if}
    <form class="card" onsubmit={send}>
      <p class="prompt" id="pick-label">{round.prompt}</p>
      <div class="numbers" role="radiogroup" aria-labelledby="pick-label">
        {#each counts as n (n)}
          <button type="button" role="radio" aria-checked={pick === n} class="n" onclick={() => (pick = n)}>{n}</button>
        {/each}
      </div>
      {#if phase === 'play'}
        <div class="bonuses">
          <p class="prompt">Bonus captures</p>
          {#each trick.bonuses as b (b.id)}
            {@const c = captures[b.id] ?? 0}
            <div class="bonus-row">
              <span class="b-label">{b.label} <span class="b-pts">+{b.points}</span></span>
              <button type="button" class="step" aria-label="One fewer: {b.label}" disabled={c === 0} onclick={() => step(b.id, -1)}>−</button>
              <span class="b-count">{c}</span>
              <button type="button" class="step" aria-label="One more: {b.label}" onclick={() => step(b.id, 1)}>+</button>
            </div>
          {/each}
          <p class="fine">Bonuses only count if you make your bid.</p>
        </div>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="send">
        <button type="submit" class="btn btn-primary btn-block" disabled={pick === null || busy}>
          {pick === null ? (phase === 'bid' ? 'Pick your bid' : 'Pick your tricks') : phase === 'bid' ? `Send bid: ${pick}` : `Send: won ${pick}`}
        </button>
        {#if editing}
          <button type="button" class="btn btn-ghost btn-block" onclick={() => (editing = false)}>Keep what I sent</button>
        {/if}
      </div>
    </form>
  {:else if screen === 'waiting'}
    <div class="card center">
      {#if mine}<Avatar name={mine.name} seat={mine.seat} emoji={mine.emoji} size={80} />{/if}
      {#if sentHere}<span class="sent-value">{sentHere.label}</span>{/if}
      <span class="pill amber">Waiting for the host to approve</span>
      <button type="button" class="btn btn-block" onclick={() => (editing = true)}>Change it</button>
    </div>
  {:else}
    <div class="card center">
      {#if mine}<Avatar name={mine.name} seat={mine.seat} emoji={mine.emoji} size={80} />{/if}
      <span class="pill teal">{phase === 'bid' ? 'Bid locked in' : 'Approved'}</span>
      <p class="fine">
        {phase === 'bid' ? 'Bids are revealed when everyone’s in.' : 'Waiting for the rest of the table.'}
        {inCount} of {round.players.length} in.
      </p>
    </div>
  {/if}

  <h2 class="section-label">{phase === 'play' ? 'Bids this round' : `This round · ${inCount} of ${round.players.length} in`}</h2>
  <ul class="table">
    {#each round.players as p (p.seat)}
      {@const isMe = p.lobbyId === me.id}
      <li>
        <span class="av">
          <Avatar name={p.name} seat={p.seat} emoji={p.emoji} size={40} />
          {#if p.state === 'approved'}
            <span class="mark" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
            </span>
          {/if}
        </span>
        <span class="who" class:me={isMe}>{isMe ? 'You' : p.name}</span>
        {#if phase === 'play' && trick.bids}
          <span class="bid-chip">Bid {trick.bids[p.seat] ?? '–'}</span>
        {/if}
        <span class="visually-hidden">{p.state === 'approved' ? 'in' : 'not in yet'}</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .round {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .last {
    margin: 0 0 14px;
    padding: 10px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--teal) 12%, transparent);
    border: 1px solid var(--teal);
    color: var(--teal);
    font-weight: 700;
    font-size: 14px;
  }
  .last.loss {
    background: color-mix(in srgb, var(--coral) 12%, transparent);
    border-color: var(--coral);
    color: var(--coral-text);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .head h1 {
    margin: 0;
    font-size: 30px;
    line-height: 1.05;
  }
  .note {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 14px;
  }
  .standing {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex: none;
  }
  .place {
    font-size: 22px;
    font-weight: 800;
    color: var(--amber);
  }
  .sub {
    font-size: 13px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .my-bid {
    margin: 0 0 12px;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--surface);
    border: 1px solid var(--amber);
    font-size: 16px;
  }
  .my-bid strong {
    color: var(--amber);
    font-size: 20px;
  }
  .alert {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    padding: 14px 16px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--coral) 14%, transparent);
    border: 1px solid var(--coral);
    color: var(--coral-text);
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 22px;
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .card.center {
    align-items: center;
    text-align: center;
    padding: 24px 16px;
  }
  .prompt {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 8px;
  }
  .n {
    min-height: 52px;
    border-radius: 14px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--text);
    font-size: 22px;
    font-weight: 800;
    cursor: pointer;
  }
  .n[aria-checked='true'] {
    border-color: var(--amber);
    background: var(--amber);
    color: var(--on-amber);
  }
  .bonuses {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
    border-top: 1px solid var(--line);
  }
  .bonuses .prompt {
    margin-top: 8px;
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
  }
  .error {
    margin: 0;
    color: var(--coral);
    font-weight: 650;
    text-align: center;
  }
  .send {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .fine {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .sent-value {
    font-size: 28px;
    font-weight: 800;
  }
  .pill {
    padding: 8px 14px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 15px;
  }
  .pill.amber {
    background: color-mix(in srgb, var(--amber) 14%, transparent);
    color: var(--amber);
  }
  .pill.teal {
    background: color-mix(in srgb, var(--teal) 14%, transparent);
    color: var(--teal);
  }
  .table {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .table li {
    width: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .av {
    position: relative;
    display: inline-flex;
  }
  .mark {
    position: absolute;
    right: -4px;
    bottom: -4px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--teal);
    color: var(--on-teal);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .who {
    font-size: 12px;
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .who.me {
    color: var(--amber);
    font-weight: 700;
  }
  .bid-chip {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }
</style>
