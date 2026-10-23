<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { lobbyApi } from '../lib/lobbyClient';
  import type { LiveRound, Scoreboard } from '../lib/lobbyTypes';
  import { ordinal } from '../lib/scoreboard';

  /** A phone player's view of the round in progress: send a score, then wait for the host's OK. */
  interface Props {
    code: string;
    me: { id: string; token: string };
    round: LiveRound;
    /** True once the server has this phone's score for the round. */
    submitted: boolean;
    scoreboard: Scoreboard | null;
  }

  let { code, me, round, submitted, scoreboard }: Props = $props();

  const num = new Intl.NumberFormat();

  // What's being entered. Reset whenever the host moves to another round or game.
  let typed = $state('');
  let taps = $state<{ label: string; value: number }[]>([]);
  let special = $state(false);
  let editing = $state(false);
  let busy = $state(false);
  let error = $state('');
  /** What this phone last sent, to show while waiting. */
  let sent = $state<{ key: string; value: number; special: boolean } | null>(null);
  let entryKey = $state('');

  const key = $derived(`${round.gameId}:${round.round}`);
  $effect.pre(() => {
    if (key !== entryKey) {
      entryKey = key;
      typed = '';
      taps = [];
      special = false;
      editing = false;
      error = '';
    }
  });

  const mine = $derived(round.players.find((p) => p.lobbyId === me.id));
  const myState = $derived(mine?.state ?? 'open');
  const value = $derived(special ? (round.special?.score ?? 0) : taps.length > 0 ? taps.reduce((a, t) => a + t.value, 0) : Number(typed || 0));
  const hasValue = $derived(special || taps.length > 0 || typed !== '');
  const specialTaken = $derived(!!round.special?.exclusive && !!round.special.takenBy);
  const lastRound = $derived(scoreboard?.rows.find((r) => r.lobbyId === me.id)?.last ?? null);
  const myStanding = $derived(scoreboard?.rows.find((r) => r.lobbyId === me.id));
  const sentHere = $derived(sent && sent.key === key ? sent : null);
  const screen = $derived.by(() => {
    if (myState === 'sittingOut') return 'sitting-out';
    if (myState === 'approved') return 'approved';
    if (submitted && !editing) return 'waiting';
    return 'entry';
  });
  const others = $derived(round.players.filter((p) => p.state !== 'sittingOut'));
  const inCount = $derived(others.filter((p) => p.state === 'approved').length);

  function onType(el: HTMLInputElement) {
    const digits = el.value.replace(/\D/g, '').slice(0, 5);
    if (digits !== el.value) el.value = digits;
    typed = digits;
    taps = [];
    special = false;
  }

  function tap(k: { label: string; value: number }) {
    if (taps.length === 0 && typed !== '') taps = [{ label: typed, value: Number(typed) }];
    taps = [...taps, k];
    typed = '';
    special = false;
  }

  function undo() {
    taps = taps.slice(0, -1);
  }

  function clearAll() {
    taps = [];
    typed = '';
    special = false;
  }

  function toggleSpecial() {
    special = !special;
    if (special) {
      taps = [];
      typed = '';
    }
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!hasValue || busy) return;
    busy = true;
    error = '';
    try {
      await lobbyApi.submitScore(code, me.id, me.token, { gameId: round.gameId, round: round.round, value, special });
      sent = { key, value, special };
      editing = false;
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  function change() {
    if (sentHere) {
      special = sentHere.special;
      typed = sentHere.special ? '' : String(sentHere.value);
      taps = [];
    }
    editing = true;
  }

  function shown(v: { value: number; special: boolean }) {
    return v.special ? (round.special?.label ?? '0') : num.format(v.value);
  }
</script>

<section class="round" aria-live="polite">
  {#if round.round > 0 && lastRound !== null && screen === 'entry' && myState !== 'sentBack'}
    <p class="last">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
      Last round: {lastRound > 0 ? `+${num.format(lastRound)}` : num.format(lastRound)}
    </p>
  {/if}

  <header class="head">
    <div>
      <p class="eyebrow">{scoreboard?.gameName ?? ''} · {round.title}</p>
      <h1>{screen === 'entry' ? 'Your turn' : screen === 'waiting' ? 'Sent!' : screen === 'approved' ? 'Locked in' : 'Sit tight'}</h1>
      {#if round.note || round.dealer}
        <p class="note">{[round.note, round.dealer ? `${round.dealer} deals` : ''].filter(Boolean).join(' · ')}</p>
      {/if}
    </div>
    {#if myStanding}
      <div class="standing">
        <span class="place">{ordinal(myStanding.rank)}</span>
        <span class="sub">{num.format(myStanding.total)}{myStanding.behind > 0 ? ` · ${num.format(myStanding.behind)} behind` : ''}</span>
      </div>
    {/if}
  </header>

  {#if screen === 'entry'}
    {#if myState === 'sentBack' && !submitted}
      <div class="alert" role="alert">
        <strong>The host sent your score back</strong>
        <span>{sentHere ? `You sent ${shown(sentHere)}. ` : ''}Check with the table and send it again.</span>
      </div>
    {/if}
    <form class="card" onsubmit={submit}>
      {#if mine}<Avatar name={mine.name} seat={mine.seat} emoji={mine.emoji} size={64} />{/if}
      <label class="prompt" for="my-score">{round.prompt}</label>
      <input
        id="my-score"
        class="big"
        class:muted-input={special}
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        autocomplete="off"
        placeholder="0"
        disabled={special}
        value={special ? '0' : taps.length > 0 ? String(value) : typed}
        oninput={(e) => onType(e.currentTarget)}
      />
      {#if round.keypad.length > 0}
        <!-- Always takes its space, so the buttons below never move between taps. -->
        <div class="tally">
          <span class="sum">{taps.length > 0 ? taps.map((t) => t.label).join(' + ') : 'Tap to add up'}</span>
          <button type="button" class="mini" onclick={undo} disabled={taps.length === 0}>Undo</button>
          <button type="button" class="mini" onclick={clearAll} disabled={!hasValue}>Clear</button>
        </div>
      {/if}
      {#if round.keypad.length > 0}
        <div class="keypad" class:cards={round.keypad.length > 6} role="group" aria-label="Add to your score">
          {#each round.keypad as k (k.label)}
            <button type="button" onclick={() => tap(k)} disabled={special}>{k.label}</button>
          {/each}
        </div>
      {/if}
      {#if round.special}
        <button
          type="button"
          class="special"
          aria-pressed={special}
          disabled={specialTaken && !special}
          onclick={toggleSpecial}
        >
          {specialTaken && !special ? `${round.special.takenBy} went out` : round.special.label}
        </button>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="send">
        <button type="submit" class="btn btn-primary btn-block" disabled={!hasValue || busy}>
          {hasValue ? (special ? `Send: ${round.special?.label}` : `Send ${num.format(value)}`) : 'Enter your score'}
        </button>
        {#if editing}
          <button type="button" class="btn btn-ghost btn-block" onclick={() => (editing = false)}>Keep what I sent</button>
        {/if}
        <p class="fine">The host approves every score before the round ends.</p>
      </div>
    </form>
  {:else if screen === 'waiting'}
    <div class="card center">
      {#if mine}<Avatar name={mine.name} seat={mine.seat} emoji={mine.emoji} size={88} />{/if}
      {#if sentHere}
        <span class="prompt">You sent</span>
        <span class="sent-value">{shown(sentHere)}</span>
      {/if}
      <span class="pill amber">Waiting for the host to approve</span>
    </div>
    <div class="send">
      <button type="button" class="btn btn-block" onclick={change}>Change my score</button>
      <p class="fine">You can change it until the host approves it.</p>
    </div>
  {:else if screen === 'approved'}
    <div class="card center">
      {#if mine}<Avatar name={mine.name} seat={mine.seat} emoji={mine.emoji} size={88} />{/if}
      <span class="pill teal">Approved</span>
      <p class="fine">Waiting for the rest of the table. {inCount} of {others.length} in.</p>
    </div>
  {:else}
    <div class="card center">
      <p class="fine">You already took your last turn. Watch the others finish.</p>
    </div>
  {/if}

  <h2 class="section-label">This round · {inCount} of {others.length} in</h2>
  <ul class="table">
    {#each others as p (p.seat)}
      {@const isMe = p.lobbyId === me.id}
      <li class:dim={p.lobbyId === null && p.state !== 'approved'}>
        <span class="av">
          <Avatar name={p.name} seat={p.seat} emoji={p.emoji} size={40} />
          {#if p.state === 'approved'}
            <span class="mark ok" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
            </span>
          {/if}
        </span>
        <span class="who" class:me={isMe}>{isMe ? 'You' : p.name}</span>
        <span class="visually-hidden">
          {p.state === 'approved' ? 'approved' : p.state === 'sentBack' ? 'sent back' : p.lobbyId === null ? 'host is entering' : 'not in yet'}
        </span>
      </li>
    {/each}
  </ul>
  {#if others.some((p) => p.lobbyId === null)}
    <p class="fine left">Players without a phone get their score from the host.</p>
  {/if}
</section>

<style>
  .round {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .last {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 14px;
    padding: 10px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--teal) 12%, transparent);
    border: 1px solid var(--teal);
    color: var(--teal);
    font-weight: 700;
    font-size: 14px;
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .head h1 {
    margin: 0;
    font-size: 32px;
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
  .alert strong {
    color: var(--coral-text);
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 18px 16px;
    border-radius: 22px;
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .card.center {
    padding: 24px 16px;
    text-align: center;
  }
  .prompt {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .big {
    width: 100%;
    height: 80px;
    border-radius: 18px;
    border: 2px solid var(--amber);
    background: var(--bg);
    color: var(--text);
    font-size: 44px;
    font-weight: 800;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .big:focus {
    outline: none;
  }
  .big::placeholder {
    color: var(--muted);
    opacity: 0.4;
  }
  .muted-input {
    border-color: var(--line);
    color: var(--muted);
  }
  .tally {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sum {
    flex: 1;
    min-width: 0;
    color: var(--muted);
    font-size: 14px;
    /* One line, so the buttons below never shift. The total is in the box above. */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mini:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .mini {
    min-height: 36px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text);
    font-weight: 650;
    cursor: pointer;
  }
  .keypad {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .keypad.cards {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .keypad button {
    min-height: 44px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-size: 15px;
    font-weight: 750;
    cursor: pointer;
  }
  .keypad button:disabled {
    opacity: 0.35;
  }
  .special {
    width: 100%;
    min-height: 52px;
    border-radius: 14px;
    border: 1px dashed var(--line-strong);
    background: transparent;
    color: var(--text);
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
  }
  .special[aria-pressed='true'] {
    border: 1px solid var(--amber);
    background: var(--amber);
    color: var(--on-amber);
  }
  .special:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .error {
    margin: 0;
    color: var(--coral);
    font-weight: 650;
    text-align: center;
  }
  .send {
    width: 100%;
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .fine {
    margin: 0;
    text-align: center;
    font-size: 13px;
    color: var(--muted);
  }
  .fine.left {
    text-align: left;
    margin-top: 8px;
  }
  .sent-value {
    font-size: 56px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
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
    width: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .table li.dim {
    opacity: 0.5;
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
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mark.ok {
    background: var(--teal);
    color: var(--on-teal);
  }
  .who {
    font-size: 12px;
    max-width: 56px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .who.me {
    color: var(--amber);
    font-weight: 700;
  }
</style>
